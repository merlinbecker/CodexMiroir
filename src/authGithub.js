import { app } from "@azure/functions";
import crypto from "crypto";

const CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = process.env.GITHUB_OAUTH_REDIRECT_URI || `${process.env.WEBSITE_HOSTNAME || 'http://localhost:7071'}/auth/github/callback`;

/**
 * OAuth Login Initiierung
 * Leitet den Benutzer zur GitHub OAuth-Seite weiter
 */
app.http("authGithub", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/github",
  handler: async (request, context) => {
    if (!CLIENT_ID) {
      context.log("[OAuth] GITHUB_OAUTH_CLIENT_ID not configured");
      return {
        status: 500,
        jsonBody: { 
          ok: false, 
          error: "OAuth not configured. Please set GITHUB_OAUTH_CLIENT_ID environment variable." 
        }
      };
    }

    // Build GitHub OAuth authorization URL
    // Minimal scopes: read:user for username, public_repo for writing to public repos
    // Use 'repo' instead of 'public_repo' if you need access to private repositories
    const scopes = "read:user,public_repo";
    const state = crypto.randomUUID(); // CSRF protection
    
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    context.log("[OAuth] Redirecting to GitHub OAuth:", authUrl.toString());

    // Store state in cookie for validation in callback (CSRF protection)
    return {
      status: 302,
      headers: {
        "Location": authUrl.toString(),
        "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
      }
    };
  }
});

/**
 * OAuth Callback Handler
 * Empfängt den Authorization Code von GitHub und tauscht ihn gegen ein Access Token
 */
app.http("authGithubCallback", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "auth/github/callback",
  handler: async (request, context) => {
    try {
      if (!CLIENT_ID || !CLIENT_SECRET) {
        context.log("[OAuth Callback] OAuth not configured");
        return {
          status: 500,
          body: "OAuth not configured. Please set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET."
        };
      }

      // Parse query parameters
      const url = new URL(request.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      // Check for OAuth errors
      if (error) {
        context.log("[OAuth Callback] GitHub returned error:", error);
        return {
          status: 400,
          body: `OAuth error: ${error}`
        };
      }

      if (!code) {
        context.log("[OAuth Callback] No authorization code received");
        return {
          status: 400,
          body: "No authorization code received"
        };
      }

      // Verify state (CSRF protection)
      const cookieHeader = request.headers.get("cookie");
      const stateMatch = cookieHeader?.match(/oauth_state=([^;]+)/);
      const storedState = stateMatch?.[1];

      if (!storedState || storedState !== state) {
        context.log("[OAuth Callback] State mismatch or missing");
        return {
          status: 400,
          body: "Invalid state parameter (CSRF check failed)"
        };
      }

      // Exchange authorization code for access token
      context.log("[OAuth Callback] Exchanging code for token");
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          redirect_uri: REDIRECT_URI
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        context.log("[OAuth Callback] Token exchange failed:", errorText);
        return {
          status: 500,
          body: `Failed to exchange code for token: ${errorText}`
        };
      }

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        context.log("[OAuth Callback] Token error:", tokenData.error_description);
        return {
          status: 400,
          body: `OAuth error: ${tokenData.error_description || tokenData.error}`
        };
      }

      const accessToken = tokenData.access_token;
      
      if (!accessToken) {
        context.log("[OAuth Callback] No access token in response");
        return {
          status: 500,
          body: "No access token received from GitHub"
        };
      }

      context.log("[OAuth Callback] Successfully obtained access token");

      // Optional: Verify token by fetching user info
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "CodexMiroir"
        }
      });

      if (!userResponse.ok) {
        context.log("[OAuth Callback] Failed to fetch user info");
      } else {
        const userData = await userResponse.json();
        context.log("[OAuth Callback] Authenticated user:", userData.login);
      }

      // Redirect to frontend with token
      // Option 1: Via URL parameter (will be stored in localStorage by frontend)
      const hostname = process.env.WEBSITE_HOSTNAME || 'localhost:7071';
      const protocol = hostname.includes('localhost') ? 'http' : 'https';
      const frontendUrl = new URL("/", `${protocol}://${hostname}`);
      frontendUrl.searchParams.set("token", accessToken);

      return {
        status: 302,
        headers: {
          "Location": frontendUrl.toString(),
          // Optional: Also set as cookie for cookie-based auth
          "Set-Cookie": `session=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`
        }
      };

    } catch (error) {
      context.error("[OAuth Callback] Unexpected error:", error);
      return {
        status: 500,
        body: `Internal server error: ${error.message}`
      };
    }
  }
});
