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
            log: context.log,
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
            log: context.log,
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