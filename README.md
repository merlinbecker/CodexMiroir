# CodexMiroir - Azure Function Only

Azure Function-only PWA implementation of the CodexMiroir task management system.

## 🔒 Security Update

**All API endpoints are now secured with Master Key authentication!**

- Functions require `authLevel: "admin"` 
- Access the app with: `https://your-app.azurewebsites.net/?code=YOUR_MASTER_KEY`
- Username is stored in localStorage for convenience
- See [SECURITY_SETUP.md](./SECURITY_SETUP.md) for deployment details

## Architecture Overview

Single Azure Function app serving:
1. **API endpoints** at `/api/*` - Task management API secured with master key
2. **Frontend PWA** at `/` (root) - Static PWA accessible without authentication

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
- **API Functions**: `/api/*` - All API endpoints secured with master key (`authLevel: "admin"`)
  - `/api/timeline/{userId}` - Timeline operations
  - `/api/tasks/{userId}` - Task CRUD operations
- **Static Function**: `{*path}` - Serves frontend assets (anonymous access)

### 3. Authentication
- Master key required for all API calls
- Frontend extracts key from URL: `?code=YOUR_KEY` or `#code=YOUR_KEY`
- Username stored in localStorage, prompted if missing
- See [SECURITY_SETUP.md](./SECURITY_SETUP.md) for details

## Deployment

### Prerequisites
- Azure Functions Core Tools v4
- Node.js 18+
- Azure account and resource group

### Azure Function Deployment
```bash
# Deploy from root directory
func azure functionapp publish your-function-app-name

# Configure environment variables (Cosmos DB settings)
az functionapp config appsettings set \
  --name your-function-app-name \
  --resource-group your-resource-group \
  --settings \
    "COSMOS_CONNECTION_STRING=your-cosmos-connection-string" \
    "COSMOS_DB=codexmiroir" \
    "COSMOS_TIMELINE=timeline" \
    "COSMOS_TASKS=tasks" \
    "USERS_CSV=u_merlin" \
    "DAY_HORIZON=30"

# Get the master key for accessing the API
az functionapp keys list \
  --name your-function-app-name \
  --resource-group your-resource-group
```

**Important**: After deployment, share the URL with the master key:
```
https://your-function-app.azurewebsites.net/?code=YOUR_MASTER_KEY
```

See [SECURITY_SETUP.md](./SECURITY_SETUP.md) for detailed deployment guide.

## Testing

Run the comprehensive test suite:
```bash
npm test
```

For manual testing, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)

Tests include:
- Task data validation
- Date utilities
- Voice command processing
- Table management logic

## Frontend Access

Once deployed, access the app with your master key:
- **Frontend**: `https://your-function-app.azurewebsites.net/?code=YOUR_MASTER_KEY`
- Username will be requested on first visit and stored in localStorage

For local development:
```bash
npm install
npm start
```
Then open: `http://localhost:7071/`

See [FUNCTION_APP_README.md](./FUNCTION_APP_README.md) for detailed local development guide.

## Benefits

1. **Unified Deployment** - Single Azure Function app hosts both frontend and backend
2. **Cost Effective** - No separate hosting for frontend
3. **Simplified Configuration** - One domain, one SSL certificate
4. **PWA Support** - Service worker and manifest included
5. **SPA Routing** - Client-side routing works correctly