# Phase 2: Core Migration - Task Management & Markdown Storage

## Übersicht
Diese Phase migriert die Kernfunktionalität des Task Managements von der datenbankbasierten Lösung zu einem markdown-basierten System auf Azure Storage.

## Ziele
- Task Management vollständig zu Markdown migriert
- CRUD Operations für Tasks funktional
- UI komplett zu JavaScript migriert
- Basic Calendar System implementiert

## Aufgaben

### 2.1 Markdown Storage System
**Geschätzter Aufwand**: 8 Stunden

#### Markdown Schema Definition
```markdown
# Business Tasks - User: {USER_ID}

## Metadata
```yaml
created: 2024-01-20T10:00:00Z
lastModified: 2024-01-20T15:30:00Z
totalTasks: 12
activeTasks: 1
completedTasks: 8
```

## Active Tasks
### task-{ID} | {TITLE}
- **Status**: active
- **Type**: task | meeting
- **Estimated**: {MINUTES} minutes
- **Remaining**: {MINUTES} minutes  
- **Deadline**: {ISO_DATE}
- **Priority**: high | medium | low
- **Created**: {ISO_DATE}
- **Started**: {ISO_DATE}

{DESCRIPTION}

## Pending Tasks
### task-{ID} | {TITLE}
- **Status**: pending
- **Type**: task | meeting
- **Estimated**: {MINUTES} minutes
- **Deadline**: {ISO_DATE}
- **Priority**: high | medium | low
- **Created**: {ISO_DATE}
- **Order**: {NUMBER}

{DESCRIPTION}

## Completed Tasks
### task-{ID} | {TITLE} ✓
- **Status**: completed
- **Type**: task | meeting
- **Estimated**: {MINUTES} minutes
- **Actual**: {MINUTES} minutes
- **Completed**: {ISO_DATE}
- **Created**: {ISO_DATE}

{DESCRIPTION}
```

#### Markdown Parser Implementation
```javascript
// markdown-parser.js
class MarkdownTaskParser {
  constructor() {
    this.taskRegex = /^### task-(\w+) \| (.+?)$/gm;
    this.metaRegex = /^- \*\*(\w+)\*\*: (.+)$/gm;
    this.yamlRegex = /```yaml\n([\s\S]*?)\n```/;
  }
  
  parseTaskFile(markdownContent) {
    const metadata = this.parseMetadata(markdownContent);
    const activeTasks = this.parseSection(markdownContent, 'Active Tasks');
    const pendingTasks = this.parseSection(markdownContent, 'Pending Tasks');
    const completedTasks = this.parseSection(markdownContent, 'Completed Tasks');
    
    return {
      metadata,
      active: activeTasks,
      pending: pendingTasks,
      completed: completedTasks
    };
  }
  
  parseSection(content, sectionName) {
    const sectionRegex = new RegExp(`## ${sectionName}\\n([\\s\\S]*?)(?=##|$)`);
    const match = content.match(sectionRegex);
    
    if (!match) return [];
    
    return this.parseTasksFromSection(match[1]);
  }
  
  parseTasksFromSection(sectionContent) {
    const tasks = [];
    const taskMatches = [...sectionContent.matchAll(this.taskRegex)];
    
    for (const match of taskMatches) {
      const taskId = match[1];
      const title = match[2].replace(' ✓', '');
      const taskContent = this.extractTaskContent(sectionContent, match.index);
      
      tasks.push({
        id: taskId,
        title,
        ...this.parseTaskMeta(taskContent),
        description: this.extractDescription(taskContent)
      });
    }
    
    return tasks;
  }
  
  generateTaskFile(userId, tasks) {
    const { active, pending, completed } = tasks;
    const metadata = this.generateMetadata(tasks);
    
    return `# Business Tasks - User: ${userId}

## Metadata
\`\`\`yaml
${this.generateYamlMetadata(metadata)}
\`\`\`

## Active Tasks
${this.generateTaskSection(active)}

## Pending Tasks
${this.generateTaskSection(pending)}

## Completed Tasks
${this.generateTaskSection(completed, true)}
`;
  }
}
```

### 2.2 Task Service Migration
**Geschätzter Aufwand**: 10 Stunden

#### Task Service Implementation
```javascript
// task-service.js
class TaskService {
  constructor(storageService, markdownParser) {
    this.storage = storageService;
    this.parser = markdownParser;
  }
  
  async getTasks(userId, mode = 'business') {
    const fileName = `${mode}-tasks.md`;
    const content = await this.storage.getUserFile(userId, fileName);
    
    if (!content) {
      return { active: [], pending: [], completed: [] };
    }
    
    return this.parser.parseTaskFile(content);
  }
  
  async getActiveTask(userId, mode = 'business') {
    const tasks = await this.getTasks(userId, mode);
    return tasks.active[0] || null;
  }
  
  async createTask(userId, mode, taskData) {
    const tasks = await this.getTasks(userId, mode);
    const newTask = {
      id: this.generateTaskId(),
      ...taskData,
      status: 'pending',
      created: new Date().toISOString(),
      order: tasks.pending.length
    };
    
    tasks.pending.push(newTask);
    await this.saveTasks(userId, mode, tasks);
    
    return newTask;
  }
  
  async updateTask(userId, mode, taskId, updates) {
    const tasks = await this.getTasks(userId, mode);
    const task = this.findTask(tasks, taskId);
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    Object.assign(task, updates);
    
    // Handle status changes
    if (updates.status) {
      this.moveTaskBetweenLists(tasks, task, updates.status);
    }
    
    await this.saveTasks(userId, mode, tasks);
    return task;
  }
  
  async deleteTask(userId, mode, taskId) {
    const tasks = await this.getTasks(userId, mode);
    const removed = this.removeTaskFromAllLists(tasks, taskId);
    
    if (removed) {
      await this.saveTasks(userId, mode, tasks);
    }
    
    return removed;
  }
  
  async activateNextTask(userId, mode) {
    const tasks = await this.getTasks(userId, mode);
    
    // Deactivate current active task
    tasks.active.forEach(task => {
      task.status = 'completed';
      task.completed = new Date().toISOString();
      tasks.completed.unshift(task);
    });
    tasks.active = [];
    
    // Activate next pending task
    if (tasks.pending.length > 0) {
      const nextTask = tasks.pending.shift();
      nextTask.status = 'active';
      nextTask.started = new Date().toISOString();
      tasks.active = [nextTask];
    }
    
    await this.saveTasks(userId, mode, tasks);
    return tasks.active[0] || null;
  }
  
  async reorderTasks(userId, mode, taskIds) {
    const tasks = await this.getTasks(userId, mode);
    
    // Reorder pending tasks based on taskIds array
    const reorderedPending = [];
    taskIds.forEach((id, index) => {
      const task = tasks.pending.find(t => t.id === id);
      if (task) {
        task.order = index;
        reorderedPending.push(task);
      }
    });
    
    tasks.pending = reorderedPending;
    await this.saveTasks(userId, mode, tasks);
  }
  
  // Private helper methods
  generateTaskId() {
    return 'task-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  findTask(tasks, taskId) {
    return [...tasks.active, ...tasks.pending, ...tasks.completed]
      .find(task => task.id === taskId);
  }
  
  async saveTasks(userId, mode, tasks) {
    const fileName = `${mode}-tasks.md`;
    const content = this.parser.generateTaskFile(userId, tasks);
    await this.storage.saveUserFile(userId, fileName, content);
  }
}
```

### 2.3 API Endpoints Migration
**Geschätzter Aufwand**: 6 Stunden

#### Azure Functions HTTP Triggers
```javascript
// functions/api-tasks.js
const { app } = require('@azure/functions');

// Get tasks for user and mode
app.http('getTasks', {
  methods: ['GET'],
  route: 'api/tasks/{userId}/{mode?}',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const { userId, mode = 'business' } = request.params;
      const taskService = container.resolve('taskService');
      
      if (!await isValidUser(userId)) {
        return { status: 401, jsonBody: { error: 'Invalid user' } };
      }
      
      const tasks = await taskService.getTasks(userId, mode);
      
      return {
        status: 200,
        jsonBody: {
          active: tasks.active[0] || null,
          pending: tasks.pending,
          completed: tasks.completed.slice(0, 10) // Last 10 completed
        }
      };
    } catch (error) {
      return handleError(error, context);
    }
  }
});

// Create new task
app.http('createTask', {
  methods: ['POST'],
  route: 'api/tasks/{userId}/{mode?}',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const { userId, mode = 'business' } = request.params;
      const taskData = await request.json();
      const taskService = container.resolve('taskService');
      
      if (!await isValidUser(userId)) {
        return { status: 401, jsonBody: { error: 'Invalid user' } };
      }
      
      const newTask = await taskService.createTask(userId, mode, taskData);
      
      return {
        status: 201,
        jsonBody: newTask
      };
    } catch (error) {
      return handleError(error, context);
    }
  }
});

// Update task
app.http('updateTask', {
  methods: ['PUT'],
  route: 'api/tasks/{userId}/{mode}/{taskId}',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const { userId, mode, taskId } = request.params;
      const updates = await request.json();
      const taskService = container.resolve('taskService');
      
      if (!await isValidUser(userId)) {
        return { status: 401, jsonBody: { error: 'Invalid user' } };
      }
      
      const updatedTask = await taskService.updateTask(userId, mode, taskId, updates);
      
      return {
        status: 200,
        jsonBody: updatedTask
      };
    } catch (error) {
      return handleError(error, context);
    }
  }
});

// Complete current task and activate next
app.http('completeCurrentTask', {
  methods: ['POST'],
  route: 'api/tasks/{userId}/{mode}/complete-current',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const { userId, mode } = request.params;
      const taskService = container.resolve('taskService');
      
      if (!await isValidUser(userId)) {
        return { status: 401, jsonBody: { error: 'Invalid user' } };
      }
      
      const nextTask = await taskService.activateNextTask(userId, mode);
      
      return {
        status: 200,
        jsonBody: { success: true, nextTask }
      };
    } catch (error) {
      return handleError(error, context);
    }
  }
});
```

### 2.4 Frontend JavaScript Migration
**Geschätzter Aufwand**: 12 Stunden

#### Task Manager Implementation (Vanilla JS)
```javascript
// public/app.js
class TaskManager {
  constructor() {
    this.userId = this.getUserIdFromUrl();
    this.currentMode = 'business';
    this.tasks = { active: null, pending: [], completed: [] };
    this.isLoading = false;
    
    this.init();
  }
  
  getUserIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user');
    
    if (!userId || userId.length !== 64) {
      this.showError('Invalid user ID. Please check your URL.');
      return null;
    }
    
    return userId;
  }
  
  async init() {
    if (!this.userId) return;
    
    this.setupEventListeners();
    this.setupServiceWorker();
    await this.loadTasks();
    this.render();
  }
  
  setupEventListeners() {
    // Mode toggle
    document.getElementById('mode-toggle').addEventListener('click', () => {
      this.currentMode = this.currentMode === 'business' ? 'private' : 'business';
      this.updateTheme();
      this.loadTasks();
    });
    
    // Complete current task
    document.getElementById('complete-btn').addEventListener('click', () => {
      this.completeCurrentTask();
    });
    
    // Add new task
    document.getElementById('add-task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addTask();
    });
    
    // Voice control
    document.getElementById('voice-btn').addEventListener('click', () => {
      this.startVoiceControl();
    });
  }
  
  async loadTasks() {
    this.isLoading = true;
    this.render();
    
    try {
      const response = await fetch(`/api/tasks/${this.userId}/${this.currentMode}`);
      if (!response.ok) throw new Error('Failed to load tasks');
      
      this.tasks = await response.json();
    } catch (error) {
      this.showError('Failed to load tasks: ' + error.message);
    } finally {
      this.isLoading = false;
      this.render();
    }
  }
  
  async addTask() {
    const titleInput = document.getElementById('task-title');
    const descInput = document.getElementById('task-description');
    
    if (!titleInput.value.trim()) return;
    
    const taskData = {
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
      estimatedMinutes: 210, // 3.5 hours default
      type: 'task'
    };
    
    try {
      const response = await fetch(`/api/tasks/${this.userId}/${this.currentMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      
      if (!response.ok) throw new Error('Failed to create task');
      
      titleInput.value = '';
      descInput.value = '';
      await this.loadTasks();
    } catch (error) {
      this.showError('Failed to add task: ' + error.message);
    }
  }
  
  async completeCurrentTask() {
    if (!this.tasks.active) return;
    
    try {
      const response = await fetch(`/api/tasks/${this.userId}/${this.currentMode}/complete-current`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to complete task');
      
      await this.loadTasks();
    } catch (error) {
      this.showError('Failed to complete task: ' + error.message);
    }
  }
  
  updateTheme() {
    document.body.className = this.currentMode === 'business' ? 'theme-dark' : 'theme-light';
  }
  
  render() {
    this.renderCurrentTask();
    this.renderTaskQueue();
    this.renderModeToggle();
  }
  
  renderCurrentTask() {
    const container = document.getElementById('current-task');
    
    if (this.isLoading) {
      container.innerHTML = '<div class="loading">Loading...</div>';
      return;
    }
    
    if (!this.tasks.active) {
      container.innerHTML = '<div class="no-task">No active task</div>';
      return;
    }
    
    const task = this.tasks.active;
    container.innerHTML = `
      <div class="current-task">
        <h2>${this.escapeHtml(task.title)}</h2>
        <p>${this.escapeHtml(task.description)}</p>
        <div class="task-meta">
          <span>Remaining: ${task.remainingMinutes || task.estimatedMinutes} min</span>
          <span>Type: ${task.type}</span>
        </div>
        <button id="complete-btn" class="btn btn-primary">Complete Task</button>
      </div>
    `;
  }
  
  renderTaskQueue() {
    const container = document.getElementById('task-queue');
    
    if (this.isLoading) return;
    
    container.innerHTML = `
      <h3>Pending Tasks (${this.tasks.pending.length})</h3>
      ${this.tasks.pending.map(task => `
        <div class="task-item" data-task-id="${task.id}">
          <h4>${this.escapeHtml(task.title)}</h4>
          <p>${this.escapeHtml(task.description)}</p>
          <div class="task-meta">
            <span>${task.estimatedMinutes} min</span>
            <span>${task.type}</span>
            ${task.deadline ? `<span>Due: ${new Date(task.deadline).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
      `).join('')}
    `;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  showError(message) {
    // Toast notification or error display
    console.error(message);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TaskManager();
});
```

## Testing Strategy

### Integration Tests
```javascript
// test/integration/task-migration.test.js
describe('Task Migration', () => {
  let taskService;
  let mockStorage;
  
  beforeEach(() => {
    mockStorage = new MockStorageService();
    taskService = new TaskService(mockStorage, new MarkdownTaskParser());
  });
  
  test('should migrate tasks to markdown format', async () => {
    const userId = 'test-user-123';
    const taskData = {
      title: 'Test Task',
      description: 'Test Description',
      estimatedMinutes: 210
    };
    
    const newTask = await taskService.createTask(userId, 'business', taskData);
    const tasks = await taskService.getTasks(userId, 'business');
    
    expect(tasks.pending).toHaveLength(1);
    expect(tasks.pending[0].title).toBe('Test Task');
  });
  
  test('should handle task status transitions', async () => {
    const userId = 'test-user-123';
    
    // Create and activate task
    await taskService.createTask(userId, 'business', { title: 'Task 1', estimatedMinutes: 210 });
    const nextTask = await taskService.activateNextTask(userId, 'business');
    
    expect(nextTask.status).toBe('active');
    
    // Complete task
    await taskService.activateNextTask(userId, 'business');
    const tasks = await taskService.getTasks(userId, 'business');
    
    expect(tasks.completed).toHaveLength(1);
    expect(tasks.active).toHaveLength(0);
  });
});
```

## Deliverables

### Core Components
- [ ] Markdown Parser & Generator
- [ ] Task Service Implementation
- [ ] API Functions für Task CRUD
- [ ] Frontend JavaScript Migration
- [ ] Basic Calendar Integration

### Data Migration
- [ ] Migration Script für existierende Tasks
- [ ] Markdown Template Files
- [ ] Backup Strategy

### Testing
- [ ] Unit Tests für Task Service
- [ ] Integration Tests für API
- [ ] Frontend Tests für Task UI

## Performance Targets

### API Performance
- ✅ Task CRUD Operations < 200ms
- ✅ Markdown Parsing < 50ms
- ✅ File Storage Operations < 100ms

### Frontend Performance
- ✅ Initial Load < 1 Sekunde
- ✅ Task Updates < 300ms
- ✅ Smooth Animations (60fps)

## Risiken & Mitigation

### Markdown Parsing Komplexität
**Risiko**: Fehler beim Parsen von komplexen Markdown-Strukturen  
**Mitigation**: Umfassende Test-Cases und Validierung

### Data Migration Verluste
**Risiko**: Datenverlust bei Migration von DB zu Markdown  
**Mitigation**: Ausführliche Backup-Strategie und Rollback-Plan

### Frontend Compatibility
**Risiko**: JavaScript ohne Framework kann Browser-Kompatibilitätsprobleme haben  
**Mitigation**: Progressive Enhancement und Polyfills

---

**Geschätzter Gesamtaufwand**: 36 Stunden  
**Dauer**: 4-5 Arbeitstage  
**Abhängigkeiten**: Phase 1 abgeschlossen, Test-Daten verfügbar