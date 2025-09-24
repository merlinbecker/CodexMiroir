# Azure Function Integration Setup

This document describes how the frontend has been integrated into the Azure Function app.

## Architecture Overview

The Azure Function app now serves both:
1. **API endpoints** at `/api/codex` - The existing task management API
2. **Frontend assets** at `/` (root) - The React client application

## Directory Structure

```
codex-miroir-fn/
├── host.json                    # Function app configuration
├── package.json                 # Dependencies
├── index.html                   # Main frontend entry point
├── manifest.json                # PWA manifest
├── sw.js                        # Service worker
├── assets/                      # Built CSS and JS assets
│   ├── index-B5Mxc1fT.css
│   └── index-BRPh6qcI.js
├── codex/                       # API function
│   ├── function.json           # Route: api/codex
│   └── index.js                # Task management API
└── static/                      # Static file serving function
    ├── function.json           # Route: {*path} (catch-all)
    └── index.js                # Static file server
```

## Configuration Changes

### 1. host.json
- Added `AZUREWEBJOBSDISABLEHOMEPAGE: true` to disable default Azure homepage
- Configured empty route prefix to allow root-level routing

### 2. Function Routes
- **API Function**: `/api/codex` - Handles all API requests with authentication
- **Static Function**: `{*path}` - Serves frontend assets and handles SPA routing

### 3. Static File Serving
- Serves `index.html` for root `/` and SPA routes
- Serves static assets (CSS, JS, images) with proper MIME types
- Implements cache headers (static assets cached, HTML not cached)
- Falls back to `index.html` for client-side routing

## Deployment

### Prerequisites
1. Build the frontend: `cd /path/to/project && npm run build`
2. Copy built assets to function directory (already done)

### Azure Function Deployment
```bash
cd codex-miroir-fn

# Deploy to Azure
func azure functionapp publish codex-miroir-fn

# Configure environment variables
az functionapp config appsettings set \
  --name codex-miroir-fn \
  --resource-group myResourceGroup \
  --settings \
    "AZURE_BLOB_CONN=..." \
    "API_KEY=your-secure-key" \
    "AZUREWEBJOBSDISABLEHOMEPAGE=true"
```

## Testing

The integration includes test files:
- `verify-setup.js` - Validates file structure and configuration
- `test-static.js` - Tests static file serving logic
- `test-api.js` - Validates API function still works

All tests pass ✅

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