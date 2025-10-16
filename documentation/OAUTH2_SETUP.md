# OAuth2 Authentication Setup

## Overview

CodexMiroir uses GitHub OAuth2 authentication instead of Azure Function Keys. This means:

1. All Azure Function endpoints are set to `authLevel: "anonymous"`
2. Authentication is handled via GitHub OAuth2 tokens sent in the `Authorization` header or session cookie
3. User identity is extracted from the GitHub token
4. Tasks are stored in user-specific folders: `<GITHUB_BASE_PATH>/<userId>/tasks/`

## Authentication Method

CodexMiroir uses the **OAuth2 Authorization Code Flow** for all authentication.

Users click "Login with GitHub" and are redirected to GitHub's OAuth authorization page. After granting access, they are redirected back with an access token.

**Callback URL**: `https://your-app.azurewebsites.net/auth/github/callback`

**Endpoints**:
- `/auth/github` - Initiates OAuth flow, redirects to GitHub
- `/auth/github/callback` - Handles callback from GitHub, exchanges code for token

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
1. Shows a "Login with GitHub" button if no token is present
2. Redirects to `/auth/github` when user clicks login
3. Receives token via URL parameter after successful OAuth flow
4. Stores the token in localStorage
5. Sends the token in the `Authorization: Bearer <token>` header with every API request
6. The userId is automatically extracted from the token by the backend

Example from `app.js`:
```javascript
// Initialize with token from URL (after OAuth callback)
init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.functionKey = urlParams.get('token') || '';
    
    if (!this.functionKey) {
        this.functionKey = localStorage.getItem('codexmiroir_token') || '';
    }
    
    if (!this.functionKey) {
        // Show login button
        document.getElementById('loginBtn').style.display = 'inline-block';
        return;
    }
    
    localStorage.setItem('codexmiroir_token', this.functionKey);
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
   - **Authorization callback URL**: `https://your-app.azurewebsites.net/auth/github/callback`
4. Click "Register application"
5. Save the **Client ID** and generate a **Client Secret**
6. Configure environment variables in Azure:
   ```bash
   az functionapp config appsettings set \
     --name your-function-app \
     --resource-group your-resource-group \
     --settings \
       "GITHUB_OAUTH_CLIENT_ID=your_client_id" \
       "GITHUB_OAUTH_CLIENT_SECRET=your_client_secret" \
       "GITHUB_OAUTH_REDIRECT_URI=https://your-app.azurewebsites.net/auth/github/callback"
   ```

**For local development**, add to `local.settings.json`:
```json
{
  "Values": {
    "GITHUB_OAUTH_CLIENT_ID": "your-github-oauth-client-id",
    "GITHUB_OAUTH_CLIENT_SECRET": "your-github-oauth-client-secret",
    "GITHUB_OAUTH_REDIRECT_URI": "http://localhost:7071/auth/github/callback"
  }
}
```

**Callback URLs to register in GitHub OAuth App**:
- Production: `https://your-app.azurewebsites.net/auth/github/callback`
- Local development: `http://localhost:7071/auth/github/callback`

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
   - `read:user` scope for reading GitHub username
   - `public_repo` scope for writing to public repositories (or `repo` for private repos)

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
- Verify the token has the correct scopes (`read:user`, `public_repo` or `repo`)
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
