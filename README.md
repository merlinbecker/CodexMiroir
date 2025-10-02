# CodexMiroir - Azure Function Only

Azure Function-only PWA implementation of the CodexMiroir task management system.

## Architecture Overview

Single Azure Function app serving:
1. **API endpoints** at `/api/codex` - Task management API with voice integration
2. **Frontend PWA** at `/` (root) - Static PWA with offline functionality

### Azure Functions v4 Compatibility
This project has been updated to use the Azure Functions v4 Node.js programming model:
- **Main entry point**: `index.js` at root level registers all functions
- **No function.json files**: Configuration is done in code using the `@azure/functions` package
- **Backward compatible**: Existing function implementations remain unchanged
- **Requires**: Azure Functions Core Tools v4 and `@azure/functions` v4 package

## Directory Structure

```
/ (Root)
├── host.json                    # Function app configuration
├── package.json                 # Azure Function dependencies
├── index.js                     # Main entry point (Azure Functions v4)
├── manifest.json                # PWA manifest
├── sw.js                        # Service worker
├── frontend/                    # Frontend source files
│   ├── index.html              # PWA entry point
│   ├── app.js                  # Main application logic
│   ├── codex-api.js            # API client
│   ├── token-manager.js        # Token management
│   └── styles.css              # Application styles
├── codex/                       # API function implementation
│   ├── index.js                # Main API router
│   ├── markdownCrud.js         # CRUD operations
│   ├── llmActions.js           # AI/voice processing
│   └── helpers.js              # Utility functions
├── static/                      # Static file serving implementation
│   └── index.js                # Static file server
├── __tests__/                   # Jest test suite
├── documentation/               # Project documentation
└── test.js                      # Legacy test runner (use npm test instead)
```

## Configuration Changes

### 1. host.json
- Added `AZUREWEBJOBSDISABLEHOMEPAGE: true` to disable default Azure homepage
- Configured empty route prefix to allow root-level routing

### 2. Function Routes
- **API Function**: `/api/codex/{secure_token}` - Handles all API requests with token-based authentication
- **Static Function**: `{*path}` - Serves frontend assets and handles SPA routing

### 3. Static File Serving
- Serves `index.html` for root `/` and SPA routes
- Serves static assets (CSS, JS, images) with proper MIME types
- Implements cache headers (static assets cached, HTML not cached)
- Falls back to `index.html` for client-side routing

## Deployment

### Prerequisites
- Azure Functions Core Tools v4
- Node.js 18+
- Azure account and resource group

### Azure Function Deployment
```bash
# Deploy from root directory
func azure functionapp publish codex-miroir-fn

# Configure environment variables
az functionapp config appsettings set \
  --name codex-miroir-fn \
  --resource-group myResourceGroup \
  --settings \
    "AZURE_BLOB_CONN=your-storage-connection-string" \
    "OPENAI_API_KEY=your-openai-key" \
    "AZUREWEBJOBSDISABLEHOMEPAGE=true"
```

## Testing

Run the comprehensive test suite:
```bash
node test.js
```

Tests include:
- Voice command processing validation
- Task management API functionality  
- Static file serving logic
- PWA offline capabilities

All tests should pass ✅

## Frontend Access

Once deployed, the frontend will be available at:
- **Frontend**: `https://your-function-app.azurewebsites.net/`
- **API**: `https://your-function-app.azurewebsites.net/api/codex?action=...`

## Benefits

1. **Unified Deployment** - Single Azure Function app hosts both frontend and backend
2. **Cost Effective** - No separate hosting for frontend
3. **Simplified Configuration** - One domain, one SSL certificate
4. **PWA Support** - Service worker and manifest included
5. **SPA Routing** - Client-side routing works correctly