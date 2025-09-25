const { app } = require('@azure/functions');

// Import the existing function handlers
const codexHandler = require('./codex/index.js');
const staticHandler = require('./static/index.js');

// Register the codex API function
app.http('codex', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    route: 'api/codex',
    handler: async (request, context) => {
        // Create a compatibility layer for the existing function
        let body = {};
        try {
            const bodyText = await request.text();
            if (bodyText) {
                body = JSON.parse(bodyText);
            }
        } catch {
            // If parsing fails, keep empty object
        }

        const req = {
            method: request.method,
            url: request.url,
            query: Object.fromEntries(request.query.entries()),
            body: body,
            headers: Object.fromEntries(request.headers.entries()),
            params: request.params
        };

        const mockContext = {
            log: (...args) => console.log('[CODEX]', ...args),
            res: null
        };

        await codexHandler(mockContext, req);
        
        return {
            status: mockContext.res.status || 200,
            headers: mockContext.res.headers || { 'Content-Type': 'application/json' },
            jsonBody: mockContext.res.body
        };
    }
});

// Register the tasks/chunk endpoint that the frontend uses
app.http('tasks-chunk', {
    methods: ['POST', 'PUT', 'DELETE', 'GET'],
    authLevel: 'anonymous',
    route: 'api/tasks/chunk',
    handler: async (request, context) => {
        try {
            const method = request.method;
            
            if (method === 'GET') {
                // Return mock tasks for development
                return {
                    status: 200,
                    jsonBody: [
                        {
                            id: 'T-001',
                            title: 'Sample Task 1',
                            description: 'This is a sample task',
                            status: 'pending',
                            priority: 'high',
                            created_at: new Date().toISOString(),
                            category: 'Development'
                        },
                        {
                            id: 'T-002', 
                            title: 'Sample Task 2',
                            description: 'Another sample task',
                            status: 'in_progress',
                            priority: 'medium',
                            created_at: new Date().toISOString(),
                            category: 'Testing'
                        }
                    ]
                };
            }
            
            if (method === 'POST') {
                const taskData = await request.json();
                context.log('[TASKS-CHUNK] Received task data:', taskData);
                
                // For development, just return success without actually creating the task
                const taskId = `T-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
                
                // Check if we have all required environment variables for production
                const hasProductionConfig = process.env.AZURE_BLOB_CONN && process.env.API_KEY;
                
                if (hasProductionConfig) {
                    // Production path: use real storage
                    const list = taskData.mode === 'professional' ? 'pro' : 'priv';
                    const { createTask, getNextSlot } = require('./codex/functions.js');
                    
                    const codexTaskData = {
                        list,
                        id: taskId,
                        title: taskData.title,
                        created_at_iso: new Date().toISOString(),
                        scheduled_slot: getNextSlot(list),
                        category: taskData.category || (list === 'pro' ? 'allgemein' : 'projekt'),
                        deadline_iso: taskData.due_date ? new Date(taskData.due_date).toISOString() : null,
                        project: taskData.project || '',
                        duration_slots: Math.ceil((taskData.estimatedMinutes || 210) / 210)
                    };
                    
                    await createTask(codexTaskData);
                } else {
                    // Development mode: just log the task
                    context.log('[DEV MODE] Would create task:', {
                        id: taskId,
                        title: taskData.title,
                        mode: taskData.mode
                    });
                }

                return {
                    status: 201,
                    jsonBody: {
                        success: true,
                        task: {
                            id: taskId,
                            title: taskData.title,
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                            estimatedMinutes: taskData.estimatedMinutes || 210
                        }
                    }
                };
            }
            
            if (method === 'PUT') {
                const taskData = await request.json();
                context.log('[TASKS-CHUNK] Update task:', taskData);
                
                return {
                    status: 200,
                    jsonBody: { success: true, message: 'Task updated' }
                };
            }
            
            if (method === 'DELETE') {
                const taskId = request.query.get('id');
                context.log('[TASKS-CHUNK] Delete task:', taskId);
                
                return {
                    status: 200,
                    jsonBody: { success: true, message: 'Task deleted' }
                };
            }

        } catch (error) {
            context.log.error('[TASKS-CHUNK] Error:', error);
            return {
                status: 500,
                jsonBody: { error: error.message }
            };
        }
    }
});

// Helper function to get next available slot
function getNextSlot(list) {
    const now = new Date();
    const currentWeek = now.getFullYear() + "-W" + String(Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0');
    
    if (list === "pro") {
        return `${currentWeek}-Mon-AM`;
    } else {
        return `${currentWeek}-Mon-PM`;
    }
}

// Register the static file serving function
app.http('static', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: '{*path}',
    handler: async (request, context) => {
        // Create a compatibility layer for the existing function
        const req = {
            method: request.method,
            url: request.url,
            params: {
                path: request.params.path || ''
            }
        };

        const mockContext = {
            log: (...args) => console.log('[STATIC]', ...args),
            res: null
        };

        await staticHandler(mockContext, req);
        
        const response = {
            status: mockContext.res.status || 200,
            headers: mockContext.res.headers || {}
        };

        if (mockContext.res.isRaw) {
            response.body = mockContext.res.body;
        } else {
            response.jsonBody = mockContext.res.body;
        }
        
        return response;
    }
});