// CodexMiroir Task Management App
class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentMode = 'professional';
        this.isDarkMode = false;
        this.currentTaskId = null;
        
        // Warte auf das Laden der API-Client-Klassen
        this.waitForApiClient().then(() => {
            this.api = window.codexApi;
            this.init();
        });
    }
    
    async waitForApiClient() {
        // Warte bis codexApi verfügbar ist
        while (!window.codexApi) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    async init() {
        this.setupEventListeners();
        await this.loadTasks();
        this.updateStats();
    }
    
    setupEventListeners() {
        // Form submission
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTaskSubmit();
        });
        
        // Mode toggle
        document.getElementById('mode-toggle').addEventListener('click', () => {
            this.toggleMode();
        });
        
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Search and filters
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterTasks();
        });
        
        document.getElementById('status-filter').addEventListener('change', () => {
            this.filterTasks();
        });
        
        // Category filter (das priority-filter Element wird als category filter verwendet)
        document.getElementById('priority-filter').addEventListener('change', () => {
            this.filterTasks();
        });
        
        // Modal
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('task-modal').addEventListener('click', (e) => {
            if (e.target.id === 'task-modal') {
                this.closeModal();
            }
        });
    }
    
    async loadTasks() {
        try {
            this.showLoadingState();
            
            // Verwende den neuen API-Client
            const data = await this.api.getTasks();
            this.tasks = Array.isArray(data) ? data : [];
            
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.tasks = [];
        } finally {
            this.hideLoadingState();
            this.renderTasks();
        }
    }
    
    async handleTaskSubmit() {
        const title = document.getElementById('task-title').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const category = document.getElementById('task-category').value;
        const dueDate = document.getElementById('task-due-date').value;
        const project = document.getElementById('task-project').value.trim();
        
        if (!title) {
            this.showNotification('Task title is required', 'error');
            return;
        }
        
        const taskData = {
            title,
            description,
            category: category || 'allgemein',
            due_date: dueDate,
            project: project || '',
            mode: this.currentMode,
            estimatedMinutes: 210 // Standard 3.5h für Codex-System
        };
        
        try {
            this.showLoadingState();
            
            // Verwende den neuen API-Client
            const newTask = await this.api.createTask(taskData);
            
            this.tasks.unshift(newTask);
            this.renderTasks();
            this.updateStats();
            
            // Reset form
            document.getElementById('task-form').reset();
            this.showNotification('Task created successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating task:', error);
            this.showNotification(`Error creating task: ${error.message}`, 'error');
        } finally {
            this.hideLoadingState();
        }
    }
    
    async updateTaskStatus(taskId, newStatus) {
        try {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Da das Codex-System nur "geplant" und "abgeschlossen" kennt,
            // simulieren wir Status-Updates lokal oder schließen die Task ab
            if (newStatus === 'completed') {
                await this.api.completeTask(taskId);
                // Remove from local array
                this.tasks = this.tasks.filter(t => t.id !== taskId);
            } else {
                // Für andere Status-Updates: nur lokal aktualisieren
                const taskIndex = this.tasks.findIndex(t => t.id === taskId);
                if (taskIndex !== -1) {
                    this.tasks[taskIndex] = { 
                        ...this.tasks[taskIndex], 
                        status: newStatus, 
                        updated_at: new Date().toISOString() 
                    };
                }
            }
            
            this.renderTasks();
            this.updateStats();
            this.showNotification('Task updated successfully!', 'success');
            
        } catch (error) {
            console.error('Error updating task:', error);
            this.showNotification('Failed to update task', 'error');
        }
    }
    
    async deleteTask(taskId) {
        if (!confirm('Are you sure you want to delete this task?')) {
            return;
        }
        
        try {
            // Verwende den neuen API-Client
            await this.api.deleteTask(taskId);
            
            // Remove from local array
            this.tasks = this.tasks.filter(task => task.id !== taskId);
            this.renderTasks();
            this.updateStats();
            this.showNotification('Task deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showNotification(`Error deleting task: ${error.message}`, 'error');
        }
    }
    
    renderTasks() {
        const container = document.getElementById('tasks-container');
        const filteredTasks = this.getFilteredTasks();
        
        // Clear existing tasks (but keep loading/empty states)
        const existingTasks = container.querySelectorAll('.task-card');
        existingTasks.forEach(task => task.remove());
        
        if (filteredTasks.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideEmptyState();
        
        filteredTasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        });
    }
    
    createTaskElement(task) {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-card card p-4 rounded-lg status-${task.status || 'pending'} cursor-pointer`;
        taskDiv.dataset.taskId = task.id;
        
        const statusColor = this.getStatusColor(task.status);
        
        taskDiv.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <h3 class="font-semibold text-lg">${this.escapeHtml(task.title)}</h3>
                        ${task.slot ? `
                            <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                ${task.slot}
                            </span>
                        ` : ''}
                    </div>
                    ${task.description ? `<p class="text-muted-foreground mb-2">${this.escapeHtml(task.description)}</p>` : ''}
                    <div class="flex items-center gap-4 text-sm text-muted-foreground">
                        <span class="flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2"/>
                            </svg>
                            ${this.formatDate(task.created_at)}
                        </span>
                        ${task.deadline ? `
                            <span class="flex items-center gap-1 text-orange-600">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                Deadline: ${task.deadline}
                            </span>
                        ` : ''}
                        ${task.category ? `
                            <span class="px-2 py-1 bg-muted rounded-full text-xs">
                                ${this.escapeHtml(task.category)}
                            </span>
                        ` : ''}
                        <span class="text-xs text-blue-600">
                            ${task.mode === 'professional' ? '💼 Beruflich' : '🏠 Privat'}
                        </span>
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${statusColor}">
                        ${task.status === 'pending' ? 'GEPLANT' : 'ABGESCHLOSSEN'}
                    </span>
                </div>
            </div>
            
            <div class="flex items-center justify-between pt-3 border-t border-border">
                <div class="flex gap-2">
                    ${task.status !== 'completed' ? `
                        <button onclick="taskManager.updateTaskStatus('${task.id}', 'completed')" 
                                class="bg-green-600 text-white px-3 py-1 rounded-lg text-xs transition-colors hover:bg-green-700">
                            ✓ Abschließen
                        </button>
                    ` : ''}
                </div>
                <div class="flex gap-2">
                    <button onclick="taskManager.deleteTask('${task.id}')" 
                            class="text-red-600 hover:text-red-800 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                    <button onclick="taskManager.deleteTask('${task.id}')" 
                            class="text-muted-foreground hover:text-destructive transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        return taskDiv;
    }
    
    getFilteredTasks() {
        let filtered = [...this.tasks];
        
        // Search filter
        const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
        if (searchTerm) {
            filtered = filtered.filter(task =>
                task.title.toLowerCase().includes(searchTerm) ||
                (task.description && task.description.toLowerCase().includes(searchTerm)) ||
                (task.category && task.category.toLowerCase().includes(searchTerm))
            );
        }
        
        // Status filter
        const statusFilter = document.getElementById('status-filter').value;
        if (statusFilter) {
            filtered = filtered.filter(task => task.status === statusFilter);
        }
        
        // Category filter (statt Priority)
        const categoryFilter = document.getElementById('priority-filter').value;
        if (categoryFilter) {
            filtered = filtered.filter(task => task.category === categoryFilter);
        }
        
        // Sort by FIFO (creation date) - wie im Codex-System
        return filtered.sort((a, b) => {
            return new Date(a.created_at) - new Date(b.created_at); // FIFO: Ältere zuerst
        });
    }
    
    filterTasks() {
        this.renderTasks();
    }
    
    updateStats() {
        const totalTasks = this.tasks.length;
        const pendingTasks = this.tasks.filter(t => t.status === 'pending').length;
        const completedTasks = this.tasks.filter(t => t.status === 'completed').length;
        
        document.getElementById('stats-total').textContent = totalTasks;
        document.getElementById('stats-pending').textContent = pendingTasks;
        document.getElementById('stats-completed').textContent = completedTasks;
    }
    
    toggleMode() {
        this.currentMode = this.currentMode === 'professional' ? 'private' : 'professional';
        document.getElementById('mode-text').textContent = 
            this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1);
        
        this.showNotification(`Switched to ${this.currentMode} mode`, 'info');
    }
    
    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        document.body.classList.toggle('dark', this.isDarkMode);
        
        const themeIcon = document.querySelector('#theme-toggle svg');
        if (this.isDarkMode) {
            themeIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
            `;
        } else {
            themeIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            `;
        }
    }
    
    resetForm() {
        document.getElementById('task-form').reset();
    }
    
    setFormLoading(loading) {
        const submitButton = document.querySelector('#task-form button[type="submit"]');
        const spinner = document.getElementById('loading-spinner');
        
        if (loading) {
            submitButton.disabled = true;
            submitButton.classList.add('loading');
            spinner.classList.remove('hidden');
        } else {
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            spinner.classList.add('hidden');
        }
    }
    
    showLoadingState() {
        document.getElementById('loading-state').classList.remove('hidden');
        document.getElementById('empty-state').classList.add('hidden');
    }
    
    hideLoadingState() {
        document.getElementById('loading-state').classList.add('hidden');
    }
    
    showEmptyState() {
        document.getElementById('empty-state').classList.remove('hidden');
    }
    
    hideEmptyState() {
        document.getElementById('empty-state').classList.add('hidden');
    }
    
    showNotification(message, type = 'info') {
        // Simple notification implementation
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg z-50 ${this.getNotificationClass(type)}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    getNotificationClass(type) {
        const classes = {
            'success': 'bg-green-600 text-white',
            'error': 'bg-red-600 text-white',
            'info': 'bg-blue-600 text-white',
            'warning': 'bg-yellow-600 text-white'
        };
        return classes[type] || classes.info;
    }
    
    getStatusColor(status) {
        const colors = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'completed': 'bg-green-100 text-green-800'
        };
        return colors[status] || colors.pending;
    }
    
    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    editTask(taskId) {
        // Simple implementation - could be expanded with a proper modal form
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        const newTitle = prompt('Edit task title:', task.title);
        if (newTitle && newTitle !== task.title) {
            this.updateTask(taskId, { ...task, title: newTitle });
        }
    }
    
    async updateTask(taskId, updatedData) {
        try {
            // Da das Codex-System keine Updates unterstützt, simulieren wir das lokal
            const taskIndex = this.tasks.findIndex(task => task.id === taskId);
            if (taskIndex !== -1) {
                this.tasks[taskIndex] = { 
                    ...this.tasks[taskIndex], 
                    ...updatedData, 
                    updated_at: new Date().toISOString() 
                };
                this.renderTasks();
                this.updateStats();
                this.showNotification('Task updated successfully!', 'success');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            this.showNotification('Failed to update task', 'error');
        }
    }
    
    closeModal() {
        document.getElementById('task-modal').classList.add('hidden');
    }
}

// Initialize the task manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskManager = new TaskManager();
});

// Auto-refresh every 30 seconds
setInterval(() => {
    if (window.taskManager) {
        window.taskManager.loadTasks();
    }
}, 30000);