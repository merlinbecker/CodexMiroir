# OAuth2 Credentials Management - Best Practices

## Übersicht

CodexMiroir verwendet eine **selbst implementierte OAuth2-Lösung** statt Azure App Service Authentication, da:
- Azure App Service Auth **nicht** mit Consumption Plan funktioniert (nur Premium/Dedicated)
- Volle Kontrolle über den Auth-Flow
- Einfacheres lokales Testen
- Plattformunabhängigkeit

## 🔐 Credentials Storage

### ❌ **NIEMALS im Code/Repository:**
- Client Secret
- Access Tokens
- Connection Strings

### ✅ **Produktion (Azure):**

Credentials werden als **Application Settings** in Azure gespeichert:

```bash
az functionapp config appsettings set \
  --name codexmiroir-func \
  --resource-group codexmiroir-rg \
  --settings \
    "GITHUB_OAUTH_CLIENT_ID=Iv1.xxx" \
    "GITHUB_OAUTH_CLIENT_SECRET=ghp_xxx" \
    "GITHUB_OAUTH_REDIRECT_URI=https://codexmiroir-func.azurewebsites.net/auth/github/callback"
```

**Vorteile:**
- Verschlüsselt gespeichert
- Zugriff nur über Azure Portal/CLI
- Automatisch als Environment Variables verfügbar
- Rotation ohne Code-Deployment

### ✅ **Lokale Entwicklung:**

**Option 1: `local.settings.json` (Empfohlen für Azure Functions)**

```json
{
  "IsEncrypted": false,
  "Values": {
    "GITHUB_OAUTH_CLIENT_ID": "Iv1.xxx",
    "GITHUB_OAUTH_CLIENT_SECRET": "ghp_xxx",
    "GITHUB_OAUTH_REDIRECT_URI": "http://localhost:7071/auth/github/callback"
  }
}
```

⚠️ **Wichtig:** `local.settings.json` ist bereits in `.gitignore`!

**Option 2: `.env` Datei**

Erstelle `.env` im Root:
```bash
GITHUB_OAUTH_CLIENT_ID=Iv1.xxx
GITHUB_OAUTH_CLIENT_SECRET=ghp_xxx
GITHUB_OAUTH_REDIRECT_URI=http://localhost:7071/auth/github/callback
```

Und lade sie mit `dotenv`:
```javascript
import 'dotenv/config';
```

⚠️ **Wichtig:** Stelle sicher, dass `.env` in `.gitignore` steht!

## 🔄 Setup-Workflow

### 1. GitHub OAuth App erstellen

1. Gehe zu: https://github.com/settings/developers
2. "OAuth Apps" → "New OAuth App"
3. Fülle aus:
   - **Application name**: CodexMiroir (Dev/Prod)
   - **Homepage URL**: `http://localhost:7071` oder `https://your-app.azurewebsites.net`
   - **Callback URL**: `http://localhost:7071/auth/github/callback` oder `https://your-app.azurewebsites.net/auth/github/callback`
4. Erstelle **separate Apps** für Dev und Prod!

### 2. Lokal konfigurieren

```bash
# 1. Kopiere Example-Datei
cp local.settings.json.example local.settings.json

# 2. Trage Client ID und Secret ein (aus GitHub OAuth App)
# Editiere local.settings.json

# 3. Starte App
npm start
```

### 3. In Azure deployen

```bash
# 1. Deploy Code
func azure functionapp publish codexmiroir-func

# 2. Setze OAuth Credentials
az functionapp config appsettings set \
  --name codexmiroir-func \
  --resource-group codexmiroir-rg \
  --settings \
    "GITHUB_OAUTH_CLIENT_ID=<production-client-id>" \
    "GITHUB_OAUTH_CLIENT_SECRET=<production-client-secret>" \
    "GITHUB_OAUTH_REDIRECT_URI=https://codexmiroir-func.azurewebsites.net/auth/github/callback"
```

## 🎯 Callback-URLs Übersicht

### Entwicklung (Lokal)
```
GitHub OAuth App Name: CodexMiroir (Dev)
Homepage URL: http://localhost:7071
Callback URL: http://localhost:7071/auth/github/callback
```

### Produktion (Azure)
```
GitHub OAuth App Name: CodexMiroir (Production)
Homepage URL: https://codexmiroir-func.azurewebsites.net
Callback URL: https://codexmiroir-func.azurewebsites.net/auth/github/callback
```

**Wichtig:** GitHub OAuth Apps erlauben **nur eine** Callback-URL. Erstelle daher separate Apps für Dev und Prod!

## 🔒 Sicherheits-Checklist

### ✅ **Muss gemacht werden:**

- [ ] `local.settings.json` in `.gitignore`
- [ ] `.env` in `.gitignore` (falls verwendet)
- [ ] Separate OAuth Apps für Dev/Prod
- [ ] Azure App Settings verwenden (nicht im Code)
- [ ] Client Secret regelmäßig rotieren (alle 90 Tage)
- [ ] HTTPS in Produktion erzwingen
- [ ] Callback-URL exakt wie konfiguriert (kein Trailing Slash!)

### ❌ **Niemals tun:**

- [ ] Secrets in Git committen
- [ ] Production Secrets lokal verwenden
- [ ] Client Secret in Frontend-Code
- [ ] Secrets in Log-Statements
- [ ] Gleiche OAuth App für Dev und Prod

## 🧪 Testen

### Lokal testen:

```bash
# 1. Starte App
npm start

# 2. Öffne Browser
open http://localhost:7071

# 3. Klicke "Mit GitHub anmelden"
# Sollte zu GitHub redirecten, dann zurück zu localhost

# 4. Überprüfe Console Logs
# [OAuth] Redirecting to GitHub OAuth: https://github.com/login/oauth/authorize?...
# [OAuth Callback] Authenticated user: username
```

### Troubleshooting:

**"OAuth not configured"**
- Prüfe ob `GITHUB_OAUTH_CLIENT_ID` gesetzt ist
- `console.log(process.env.GITHUB_OAUTH_CLIENT_ID)` zum Debuggen

**"Redirect URI mismatch"**
- Callback-URL in GitHub OAuth App muss **exakt** übereinstimmen
- Kein Trailing Slash!
- `http://localhost:7071/auth/github/callback` ≠ `http://localhost:7071/auth/github/callback/`

**"Invalid state parameter"**
- Cookie-Problem (CSRF-Schutz)
- Prüfe ob Cookies aktiviert sind
- Bei localhost: `Secure` Attribut entfernen (nur lokal!)

## 📚 Weitere Ressourcen

- [GitHub OAuth Apps Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps)
- [Azure Function App Settings](https://learn.microsoft.com/en-us/azure/azure-functions/functions-how-to-use-azure-function-app-settings)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)

## 🔄 Token Rotation

**Empfehlung:** Rotiere Client Secrets alle 90 Tage

```bash
# 1. Erstelle neues Secret in GitHub OAuth App
# 2. Update Azure App Settings
az functionapp config appsettings set \
  --name codexmiroir-func \
  --resource-group codexmiroir-rg \
  --settings "GITHUB_OAUTH_CLIENT_SECRET=<new-secret>"

# 3. Teste
curl https://codexmiroir-func.azurewebsites.net/auth/github

# 4. Lösche altes Secret in GitHub OAuth App (nach erfolgreicher Verifikation)
```

## ❓ FAQ

**Q: Kann ich Azure App Service Authentication verwenden?**
A: Nein, nicht im Consumption Plan. Benötigt Premium/Dedicated Plan (~70-150€/Monat).

**Q: Sollte ich den Client Secret verschlüsseln?**
A: In Azure App Settings ist Verschlüsselung automatisch. Lokal kannst du `IsEncrypted: true` in `local.settings.json` verwenden (benötigt Azure Functions Core Tools Setup).

**Q: Wie teste ich mit mehreren Benutzern?**
A: Erstelle mehrere GitHub Accounts oder bitte Kollegen zu testen. Jeder Benutzer autorisiert die App mit seinem eigenen GitHub Account.

**Q: Was passiert wenn Client Secret geleakt wird?**
A: 
1. Lösche sofort das Secret in der GitHub OAuth App
2. Erstelle neues Secret
3. Update Azure App Settings
4. Alle Benutzer müssen sich neu anmelden

