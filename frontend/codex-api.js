// API Client für CodexMiroir mit Token-basierter Authentifizierung
class CodexApiClient {
    constructor() {
        this.baseUrl = '/api/codex';
    }
    
    // Holt TokenManager-Instanz
    getTokenManager() {
        if (!window.tokenManager) {
            throw new Error('TokenManager not yet initialized');
        }
        return window.tokenManager;
    }
    
    // Generiert vollständige API-URL mit Token
    getApiUrl(action) {
        const token = this.getTokenManager().getToken();
        return `${this.baseUrl}/${token}?action=${action}`;
    }
    
    // Generiert Task-ID
    generateTaskId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `T-${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`;
    }
    
    // Berechnet nächsten verfügbaren Slot
    getNextSlot(list) {
        const now = new Date();
        const currentWeek = now.getFullYear() + "-W" + String(Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0');
        
        if (list === "pro") {
            return `${currentWeek}-Mon-AM`;
        } else {
            return `${currentWeek}-Mon-PM`;
        }
    }
    
    // Task erstellen
    async createTask(taskData) {
        const list = taskData.mode === 'professional' ? 'pro' : 'priv';
        const taskId = this.generateTaskId();
        
        const codexTask = {
            list,
            id: taskId,
            title: taskData.title,
            created_at_iso: new Date().toISOString(),
            scheduled_slot: this.getNextSlot(list),
            category: taskData.category || (list === 'pro' ? 'allgemein' : 'projekt'),
            deadline_iso: taskData.due_date ? new Date(taskData.due_date).toISOString() : null,
            project: taskData.project || '',
            duration_slots: Math.ceil((taskData.estimatedMinutes || 210) / 210)
        };
        
        const response = await fetch(this.getApiUrl('createTask'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(codexTask)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Task creation failed');
        }
        
        const result = await response.json();
        
        // Konvertiere zurück zu Frontend-Format
        return {
            id: taskId,
            title: taskData.title,
            description: taskData.description || '',
            status: 'pending',
            priority: taskData.priority || 'medium',
            created_at: codexTask.created_at_iso,
            category: taskData.category || 'General',
            estimatedMinutes: taskData.estimatedMinutes || 210,
            mode: taskData.mode
        };
    }
    
    // Tasks abrufen
    async getTasks() {
        const tasks = [];
        
        // Hole pro und private Tasks
        for (const list of ['pro', 'priv']) {
            try {
                const response = await fetch(this.getApiUrl('report'), {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ list })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // Konvertiere Codex-Format zu Frontend-Format
                    if (data.tasks && Array.isArray(data.tasks)) {
                        data.tasks.forEach(task => {
                            tasks.push({
                                id: this.extractTaskId(task.task),
                                title: this.extractTaskTitle(task.task),
                                status: 'pending',
                                priority: 'medium',
                                created_at: new Date().toISOString(),
                                category: task.category || 'General',
                                estimatedMinutes: 210,
                                mode: list === 'pro' ? 'professional' : 'private',
                                slot: task.slot,
                                deadline: task.deadline
                            });
                        });
                    }
                }
            } catch (error) {
                console.warn(`Failed to load ${list} tasks:`, error);
            }
        }
        
        return tasks;
    }
    
    // Task abschließen
    async completeTask(taskId) {
        // Finde Task in aktueller Liste um taskPathAbs zu bestimmen
        const tasks = await this.getTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (!task) {
            throw new Error('Task not found');
        }
        
        const list = task.mode === 'professional' ? 'pro' : 'priv';
        const year = new Date().getFullYear();
        const date = new Date().toISOString().slice(0, 10);
        const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const taskPathAbs = `users/${this.getTokenManager().getToken()}/codex-miroir/${list}/tasks/${year}/${date}--${taskId}-${slug}.md`;
        
        const response = await fetch(this.getApiUrl('completeTask'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                list,
                taskPathAbs,
                closed_at_iso: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Task completion failed');
        }
        
        return await response.json();
    }
    
    // Task löschen (über completeTask)
    async deleteTask(taskId) {
        return this.completeTask(taskId);
    }
    
    // Hilfsfunktionen zum Parsen von Task-Strings
    extractTaskId(taskString) {
        const match = taskString.match(/T-\w+/);
        return match ? match[0] : `T-${Date.now()}`;
    }
    
    extractTaskTitle(taskString) {
        const match = taskString.match(/T-\w+:\s*(.+)/);
        return match ? match[1].trim() : taskString;
    }
    
    // Voice Commands
    async processVoiceCommand(text, list = 'pro') {
        const response = await fetch(this.getApiUrl('processCommand'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text, list })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Voice command processing failed');
        }
        
        return await response.json();
    }
    
    // Aktuelle Task für Voice
    async getCurrentTask(list = 'pro') {
        const response = await fetch(this.getApiUrl('getCurrentTask'), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ list })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get current task');
        }
        
        return await response.json();
    }
}

// Globale API-Client-Instanz
window.codexApi = new CodexApiClient();