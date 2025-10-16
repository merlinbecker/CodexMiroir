# OAuth2 Callback - Quick Reference

## Callback-URL für GitHub OAuth App

Wenn du eine GitHub OAuth App registrierst, verwende diese URLs:

### Produktion
```
https://your-app.azurewebsites.net/auth/github/callback
```

### Lokale Entwicklung
```
http://localhost:7071/auth/github/callback
```

⚠️ **Wichtig:** Erstelle **separate OAuth Apps** für Dev und Prod! GitHub erlaubt nur eine Callback-URL pro App.

## Was wurde implementiert?

✅ **Vollständiger OAuth2 Authorization Code Flow**
- `/auth/github` - Initiiert Login, leitet zu GitHub weiter
- `/auth/github/callback` - Empfängt Code, tauscht gegen Token aus
- Frontend Login-Button
- Frontend Logout-Funktion
- CSRF-Schutz mit State-Parameter
- **Dual-Auth**: URL-Parameter + Session-Cookie

## Credentials Management

### ❌ **NIEMALS committen:**
- `local.settings.json` (bereits in .gitignore)
- `.env` (bereits in .gitignore)
- Client Secrets
- Access Tokens

### ✅ **Produktion (Azure App Settings):**
```bash
az functionapp config appsettings set \
  --name codexmiroir-func \
  --resource-group codexmiroir-rg \
  --settings \
    "GITHUB_OAUTH_CLIENT_ID=Iv1.xxx" \
    "GITHUB_OAUTH_CLIENT_SECRET=ghp_xxx"
```

### ✅ **Lokal (local.settings.json):**
```bash
cp local.settings.json.example local.settings.json
# Trage deine Dev OAuth Credentials ein
```

## Schnellstart

### 1. GitHub OAuth App erstellen (DEV)
1. Gehe zu: https://github.com/settings/developers
2. "OAuth Apps" → "New OAuth App"
3. **Application name**: CodexMiroir (Dev)
4. **Homepage URL**: `http://localhost:7071`
5. **Authorization callback URL**: `http://localhost:7071/auth/github/callback`
6. Kopiere Client ID und Client Secret

### 2. Lokal konfigurieren
```bash
# 1. Kopiere Example-Config
cp local.settings.json.example local.settings.json

# 2. Editiere local.settings.json
# Trage Client ID und Secret ein

# 3. Starte App
npm start
```

### 3. Testen
1. Öffne http://localhost:7071
2. Klicke "Mit GitHub anmelden"
3. Autorisiere die App auf GitHub
4. Du wirst zurück zur App geleitet (eingeloggt) ✓

### 4. Für Produktion deployen

```bash
# 1. Erstelle Production OAuth App (separate App!)
#    Callback: https://your-app.azurewebsites.net/auth/github/callback

# 2. Deploy Code
func azure functionapp publish codexmiroir-func

# 3. Setze Production Credentials in Azure
az functionapp config appsettings set \
  --name codexmiroir-func \
  --resource-group codexmiroir-rg \
  --settings \
    "GITHUB_OAUTH_CLIENT_ID=<prod-client-id>" \
    "GITHUB_OAUTH_CLIENT_SECRET=<prod-client-secret>" \
    "GITHUB_OAUTH_REDIRECT_URI=https://your-app.azurewebsites.net/auth/github/callback"
```

## Benutzer-Flow

```
Benutzer ohne Token
    ↓
Sieht "Mit GitHub anmelden" Button
    ↓
Klickt Button → Redirect zu /auth/github
    ↓
Backend leitet zu GitHub OAuth weiter
    ↓
Benutzer autorisiert App auf GitHub
    ↓
GitHub → /auth/github/callback?code=...
    ↓
Backend tauscht code gegen access_token
    ↓
Backend → Frontend mit ?token=... + Session Cookie
    ↓
Frontend speichert Token in localStorage
    ↓
Benutzer ist eingeloggt ✓
```

## Troubleshooting

### "OAuth not configured"
```bash
# Prüfe Environment Variables
echo $GITHUB_OAUTH_CLIENT_ID
# oder in local.settings.json
```

### "Redirect URI mismatch"
- Callback-URL muss **exakt** übereinstimmen
- Kein Trailing Slash: ❌ `.../callback/` ✓ `.../callback`
- HTTP vs HTTPS beachten

### "Invalid state parameter (CSRF check failed)"
- Cookies deaktiviert? Aktiviere Cookies im Browser
- Lokales Testing: Prüfe ob Cookie gesetzt wird
- Timeout: State ist nur 10 Minuten gültig

### Port 7071 bereits belegt
```bash
# Alte Prozesse beenden
pkill -f "func start"
# Oder anderen Port verwenden
npm start -- --port 7072
```

## Dokumentation

- **Vollständige Docs**: `OAUTH2_CREDENTIALS_MANAGEMENT.md`
- **Implementation**: `OAUTH2_CALLBACK_IMPLEMENTATION.md`
- **Setup Guide**: `OAUTH2_SETUP.md`

## Sicherheit

✅ CSRF-Schutz (State-Parameter)
✅ HttpOnly Cookies
✅ Secrets in Azure App Settings (verschlüsselt)
✅ Separate OAuth Apps für Dev/Prod
✅ Token-Validierung mit GitHub API
✅ Benutzer-Isolierung (eigene Ordner)

