/**
 * OAuth2 Authentication Helper
 * 
 * This module provides utilities for GitHub OAuth2 authentication,
 * extracting and validating user information from bearer tokens.
 */

/**
 * Extract userId from Authorization header or session cookie
 * @param {HttpRequest} request - Azure Functions HTTP request object
 * @returns {Promise<string>} - GitHub username (login)
 * @throws {Error} - If token is missing or invalid
 */
export async function extractUserId(request) {
  let token;

  // 1st attempt: Extract token from Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  }

  // 2nd attempt: Extract token from session cookie (fallback)
  if (!token) {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/session=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (!token) {
    throw new Error("Missing token (Authorization header or session cookie)");
  }
  
  // Call GitHub API to get user info
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CodexMiroir"
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`GitHub API error: ${response.status} ${errorText}`);
    }
    
    const userData = await response.json();
    
    if (!userData.login) {
      throw new Error("Invalid user data from GitHub API");
    }
    
    // Return the GitHub username (login)
    return userData.login;
  } catch (error) {
    if (error.message.includes("GitHub API error")) {
      throw error;
    }
    throw new Error(`Failed to authenticate with GitHub: ${error.message}`);
  }
}

/**
 * Middleware to validate OAuth2 token and extract userId
 * @param {HttpRequest} request - Azure Functions HTTP request object
 * @returns {Promise<{userId: string, error: null} | {userId: null, error: object}>}
 */
export async function validateAuth(request) {
  try {
    const userId = await extractUserId(request);
    return { userId, error: null };
  } catch (error) {
    return {
      userId: null,
      error: {
        status: 401,
        jsonBody: {
          ok: false,
          error: error.message
        }
      }
    };
  }
}
