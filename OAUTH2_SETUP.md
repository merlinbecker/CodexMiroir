# OAuth2 Authentication Setup

## Overview

CodexMiroir now uses GitHub OAuth2 authentication instead of Azure Function Keys. This means:

1. All Azure Function endpoints are set to `authLevel: "anonymous"`
2. Authentication is handled via GitHub OAuth2 tokens sent in the `Authorization` header or session cookie
3. User identity is extracted from the GitHub token
4. Tasks are stored in user-specific folders: `<GITHUB_BASE_PATH>/<userId>/tasks/`

## How It Works

### Backend (Azure Functions)

Each function handler now:
1. Calls `validateAuth(request)` to extract and validate the OAuth2 token
2. Gets the `userId` (GitHub username) from the token
3. Uses the `userId` to determine the correct storage path for tasks

The authentication module supports two methods for providing the token:
- **Authorization header**: `Authorization: Bearer <token>` (preferred)
- **Session cookie**: `session=<token>` (fallback)

The Authorization header takes priority if both are present.

Example from `createTask.js`:
```javascript
import { validateAuth } from "../shared/auth.js";

app.http("createTask", {
  methods: ["POST"],
  authLevel: "anonymous",  // Changed from "function"
  route: "api/tasks",
  handler: async (request, context) => {
    // Validate OAuth2 token and extract userId
    const { userId, error } = await validateAuth(request);
    if (error) {
      return error;
    }
    
    // Use userId for storage path
    const path = `${BASE}/${userId}/tasks/${filename}`;
    // ...
  }
});
```

### Frontend (Web App)

The frontend now:
1. Accepts OAuth token via URL parameter `?token=YOUR_TOKEN` or hash `#token=YOUR_TOKEN`
2. Stores the token in localStorage
3. Sends the token in the `Authorization: Bearer <token>` header with every API request
4. The userId is automatically extracted from the token by the backend

Alternatively, the token can be provided via a session cookie, which is useful for browser-based flows.

Example from `app.js`:
```javascript
// Initialize with token from URL
init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.functionKey = urlParams.get('token') || '';
    
    if (this.functionKey) {
        localStorage.setItem('codexmiroir_token', this.functionKey);
    }
    // ...
}

// Make API requests with Authorization header
apiRequest(path, options = {}) {
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${this.functionKey}`
    };
    return {
        url: `/${path}`,
        options: { ...options, headers }
    };
}
```

## Setting Up GitHub OAuth

### 1. Create a GitHub OAuth App

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: CodexMiroir
   - **Homepage URL**: `https://your-app.azurewebsites.net`
   - **Authorization callback URL**: `https://your-app.azurewebsites.net`
4. Click "Register application"
5. Save the **Client ID** and generate a **Client Secret**

### 2. Generate a Personal Access Token (PAT)

For development/testing, you can use a Personal Access Token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "CodexMiroir Dev")
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `read:user` (Read user profile data)
5. Click "Generate token"
6. **Copy the token immediately** (you won't be able to see it again)

### 3. Use the Token

There are two ways to provide the token:

#### Option A: Authorization Header (recommended)

Access the app with the token in the URL:
```
https://your-app.azurewebsites.net/?token=ghp_YOUR_TOKEN_HERE
```

Or use the hash format:
```
https://your-app.azurewebsites.net/#token=ghp_YOUR_TOKEN_HERE
```

The app will store the token in localStorage and send it via the `Authorization: Bearer` header with all API requests.

#### Option B: Session Cookie

Alternatively, you can set a session cookie:
```javascript
document.cookie = "session=ghp_YOUR_TOKEN_HERE; path=/; secure; samesite=strict";
```

The backend will automatically extract the token from the `session` cookie if no Authorization header is present. This is useful for:
- OAuth flows that set cookies automatically
- Browser-based authentication flows
- Integration with existing session management systems

**Note**: The Authorization header takes priority if both are present.

## Storage Structure

Tasks are now stored in user-specific folders:

```
GitHub Repository Structure:
  codexMiroir/                    (GITHUB_BASE_PATH)
    ├── username1/                (GitHub username)
    │   └── tasks/
    │       ├── 0000-task1.md
    │       ├── 0001-task2.md
    │       └── ...
    ├── username2/
    │   └── tasks/
    │       └── ...
    └── ...

Azure Blob Storage Cache:
  codex-cache/                    (Container)
    ├── raw/
    │   ├── username1/
    │   │   └── tasks/
    │   │       ├── 0000-task1.md
    │   │       └── ...
    │   └── username2/
    │       └── tasks/
    │           └── ...
    ├── artifacts/
    │   ├── username1/
    │   │   └── timeline_*.json
    │   └── username2/
    │       └── timeline_*.json
    └── state/
        ├── username1/
        │   ├── nextId.txt
        │   └── lastHeadSha.txt
        └── username2/
            ├── nextId.txt
            └── lastHeadSha.txt
```

## Security Considerations

1. **Token Storage**: Tokens are stored in localStorage. This is acceptable for development but consider using more secure storage for production.

2. **Token Scope**: Use tokens with minimal necessary scopes. For CodexMiroir:
   - `repo` scope for accessing repository
   - `read:user` scope for reading user profile

3. **HTTPS Only**: Always use HTTPS in production to protect tokens in transit.

4. **Token Rotation**: Regularly rotate tokens and implement token expiration handling.

5. **Rate Limiting**: GitHub API has rate limits. The app respects these limits.

## Troubleshooting

### "Missing Authorization header" Error
- Make sure you're accessing the app with `?token=...` in the URL
- Check that the token is stored in localStorage (`localStorage.getItem('codexmiroir_token')`)

### "GitHub API error: 401" Error
- Your token might be expired or invalid
- Generate a new token and access the app with the new token in the URL

### "Directory not found" Error
- The user's folder doesn't exist in the GitHub repository yet
- Create it manually: `mkdir -p codexMiroir/<username>/tasks` and commit

### Tasks Not Loading
- Check browser console for errors
- Verify the token has the correct scopes (`repo`, `read:user`)
- Ensure the GitHub repository path is configured correctly in Azure Function App settings

## Migration from Function Keys

If you were using function keys before:

1. **Backend**: All functions are now anonymous, no function key needed
2. **Frontend**: Replace `?code=...` with `?token=...` in URLs
3. **Tasks**: Existing tasks in `codexMiroir/tasks/` need to be moved to `codexMiroir/<username>/tasks/`
4. **State**: ID counters in `state/nextId.txt` need to be copied to `state/<username>/nextId.txt`

## Environment Variables

No new environment variables are needed. Existing variables remain the same:

- `GITHUB_OWNER`: GitHub username or organization
- `GITHUB_REPO`: Repository name
- `GITHUB_TOKEN`: GitHub Personal Access Token (for backend GitHub API access)
- `GITHUB_BASE_PATH`: Base path in repository (default: `codex-miroir`)
- `AZURE_BLOB_CONN`: Azure Blob Storage connection string
- `AZURE_BLOB_CONTAINER`: Blob container name (default: `codex-cache`)
