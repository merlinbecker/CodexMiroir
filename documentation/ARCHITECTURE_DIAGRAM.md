# Architecture Diagram - Security Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          User's Browser                          │
│                                                                  │
│  URL: https://app.azurewebsites.net/?code=MASTER_KEY           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                Frontend (Alpine.js)                     │   │
│  │                                                          │   │
│  │  1. Extract function key from URL                       │   │
│  │     - Query param: ?code=KEY                            │   │
│  │     - Fragment: #code=KEY                               │   │
│  │                                                          │   │
│  │  2. Check localStorage for username                     │   │
│  │     - Found: Load it                                    │   │
│  │     - Not found: Prompt user                            │   │
│  │                                                          │   │
│  │  3. Build API URLs with relative paths                  │   │
│  │     - Add function key: ?code=KEY                       │   │
│  │                                                          │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Relative Path Requests
                          │ GET /api/timeline/u_merlin?code=KEY
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Azure Function App                            │
│                  (Same Host, Same Domain)                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Static File Server (serveStatic)                       │   │
│  │  authLevel: "anonymous"                                 │   │
│  │  Route: {*path}                                         │   │
│  │                                                          │   │
│  │  Serves: /, /index.html, /app.js, /styles.css          │   │
│  │  No authentication required ✅                          │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  API Functions (7 endpoints)                            │   │
│  │  authLevel: "admin" - MASTER KEY REQUIRED 🔒           │   │
│  │                                                          │   │
│  │  Routes:                                                │   │
│  │  • GET  /api/timeline/{userId}                          │   │
│  │  • GET  /api/tasks/{userId}/{taskId}                    │   │
│  │  • POST /api/tasks/{userId}                             │   │
│  │  • PUT  /api/tasks/{userId}/{taskId}                    │   │
│  │  • POST /api/timeline/{userId}/assign                   │   │
│  │  • POST /api/timeline/{userId}/autofill                 │   │
│  │  • POST /api/timeline/{userId}/prioritize               │   │
│  │                                                          │   │
│  │  Validation: Checks ?code= parameter                    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────┬───────────────────────────────────────┘
                          │
                          │ Cosmos DB Queries
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Azure Cosmos DB                             │
│                                                                  │
│  ┌─────────────────┐          ┌─────────────────┐             │
│  │  Timeline        │          │  Tasks          │             │
│  │  Container       │          │  Container      │             │
│  │                  │          │                 │             │
│  │  • Day documents │          │  • Task docs    │             │
│  │  • Slots         │          │  • Metadata     │             │
│  │  • Assignments   │          │  • Status       │             │
│  └─────────────────┘          └─────────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow

### Static File Request (No Auth)
```
User Browser                    Azure Functions
     │                               │
     │  GET /index.html             │
     ├──────────────────────────────>│
     │                               │
     │                          serveStatic
     │                          authLevel: anonymous
     │                          ✅ No auth check
     │                               │
     │  200 OK + HTML               │
     │<──────────────────────────────┤
     │                               │
```

### API Request (With Master Key)
```
User Browser                    Azure Functions                Cosmos DB
     │                               │                              │
     │  GET /api/timeline/u_merlin   │                              │
     │      ?code=MASTER_KEY         │                              │
     ├──────────────────────────────>│                              │
     │                               │                              │
     │                          getTimeline                         │
     │                          authLevel: admin                    │
     │                          🔒 Check master key                 │
     │                          ✅ Key valid                         │
     │                               │                              │
     │                               │  Query timeline              │
     │                               ├─────────────────────────────>│
     │                               │                              │
     │                               │  Return results              │
     │                               │<─────────────────────────────┤
     │                               │                              │
     │  200 OK + JSON                │                              │
     │<──────────────────────────────┤                              │
     │                               │                              │
```

### API Request (Without Key) - REJECTED
```
User Browser                    Azure Functions
     │                               │
     │  GET /api/timeline/u_merlin   │
     │      (no code parameter)      │
     ├──────────────────────────────>│
     │                               │
     │                          getTimeline
     │                          authLevel: admin
     │                          🔒 Check master key
     │                          ❌ No key found
     │                               │
     │  401 Unauthorized             │
     │<──────────────────────────────┤
     │                               │
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Azure Functions Authorization (Built-in)           │
│ - Validates master key from ?code= parameter                │
│ - Managed by Azure Functions runtime                        │
│ - No custom code needed                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: User Separation (Application Logic)                │
│ - Each user has their own userId (e.g., u_merlin)           │
│ - Cosmos DB queries filtered by userId                      │
│ - No cross-user data access possible                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Cosmos DB Security                                  │
│ - Connection string with account key                        │
│ - Stored in Azure Function App settings                     │
│ - Never exposed to frontend                                 │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow - Username Management

```
First Visit:
┌─────────┐     ┌──────────────┐     ┌─────────────┐
│ Browser │────>│ localStorage │────>│ Empty       │
└─────────┘     └──────────────┘     └─────────────┘
     │                                       │
     │                                       │
     ▼                                       ▼
┌─────────────────────┐          ┌───────────────────┐
│ Prompt: "Enter      │          │ User enters:      │
│ username"           │<─────────│ "u_merlin"        │
└─────────────────────┘          └───────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│ localStorage.setItem('codexmiroir_userId', 'u_merlin')│
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────┐
│ App continues with  │
│ userId = 'u_merlin' │
└─────────────────────┘

Subsequent Visits:
┌─────────┐     ┌──────────────┐     ┌─────────────────┐
│ Browser │────>│ localStorage │────>│ 'u_merlin'     │
└─────────┘     └──────────────┘     └─────────────────┘
     │
     ▼
┌─────────────────────┐
│ No prompt needed!   │
│ Auto-load username  │
└─────────────────────┘
```

## Key Features

### ✅ Advantages

1. **Single URL**: Share one URL with master key included
2. **No Configuration**: Frontend has no hardcoded backend URL
3. **Persistent User**: Username saved across sessions
4. **Secure API**: All endpoints require master key
5. **Same Host**: Frontend and backend on same domain (no CORS)
6. **Relative Paths**: Code works in dev and prod without changes

### ⚠️ Considerations

1. **Key Visibility**: Master key visible in URL (use HTTPS)
2. **Single Key**: One key for all API access (rotation needed for security)
3. **localStorage Only**: Username lost if browser data cleared
4. **No Auth System**: Just username separation, no password

## Example URLs

### Development (Local)
```
Frontend:  http://localhost:7071/
           - No key needed (authLevel ignored)
           - Username prompted/loaded from localStorage

API Call:  http://localhost:7071/api/timeline/u_merlin
           - No key needed (authLevel ignored in local mode)
```

### Production (Azure)
```
Frontend:  https://myapp.azurewebsites.net/?code=MASTER_KEY_HERE
           - Key extracted from URL
           - Username prompted/loaded from localStorage

API Call:  https://myapp.azurewebsites.net/api/timeline/u_merlin?code=MASTER_KEY_HERE
           - Key automatically included by frontend
           - Validated by Azure Functions runtime
```

## Key Takeaways

🔒 **Security**: Master key required for all API endpoints  
🚀 **Simplicity**: No frontend configuration needed  
💾 **Persistence**: Username saved in localStorage  
🌐 **Portability**: Same code works everywhere  
📝 **Documentation**: Comprehensive guides available  

See documentation for more details:
- [SECURITY_SETUP.md](./SECURITY_SETUP.md) - Deployment and security
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing procedures
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Complete changes
