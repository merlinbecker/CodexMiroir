# OAuth2 Callback Implementation - Zusammenfassung

## Änderungsdatum
11. Oktober 2025

## Übersicht
Die vollständige OAuth2-Authentifizierung mit GitHub wurde implementiert, einschließlich des Authorization Code Flow mit Callback-Endpunkten.

## Was wurde implementiert?

### 1. Neue Backend-Endpunkte (`src/authGithub.js`)

#### `/auth/github` (GET)
- Initiiert den OAuth2-Flow
- Leitet Benutzer zu GitHub OAuth weiter
- Parameter: `client_id`, `redirect_uri`, `scope` (read:user, public_repo)
- CSRF-Schutz: Generiert und speichert `state` in Cookie

#### `/auth/github/callback` (GET)
- Empfängt Authorization Code von GitHub
- Validiert `state` Parameter (CSRF-Schutz)
- Tauscht Code gegen Access Token aus
- Verifiziert Token mit GitHub User API
- Leitet zu Frontend weiter mit Token im URL-Parameter
- Optional: Setzt Session Cookie für cookiebasierte Auth

### 2. Environment Variables

Neue Umgebungsvariablen in `local.settings.json` und Azure:

```json
{
  "GITHUB_OAUTH_CLIENT_ID": "your-github-oauth-client-id",
  "GITHUB_OAUTH_CLIENT_SECRET": "your-github-oauth-client-secret",
  "GITHUB_OAUTH_REDIRECT_URI": "http://localhost:7071/auth/github/callback"
}
```

### 3. Frontend-Änderungen

#### `public/index.html`
- Neuer "Mit GitHub anmelden" Button
- Neuer "Abmelden" Button
- Buttons werden dynamisch ein-/ausgeblendet basierend auf Auth-Status

#### `public/app.js`
- Entfernt Token-Prompt (kein manuelles Eingeben mehr nötig)
- Zeigt Login-Button wenn kein Token vorhanden
- Versteckt Task-Controls wenn nicht authentifiziert
- Neue `logout()` Funktion:
  - Löscht Token aus localStorage
  - Löscht userId aus localStorage
  - Leitet zu Startseite weiter

### 4. Dokumentation

`OAUTH2_SETUP.md` wurde aktualisiert mit:
- Callback-URL Information
- Anleitung zur Registrierung einer GitHub OAuth App
- Zwei Authentifizierungsmethoden dokumentiert:
  1. **Full OAuth2 Flow** (empfohlen für Produktion)
  2. **Personal Access Token Flow** (für Entwicklung)
- Environment Variables Setup-Anleitung

## Callback-URL

Die Callback-URL, die in der GitHub OAuth App registriert werden muss:

### Produktion
```
https://your-app.azurewebsites.net/auth/github/callback
```

### Lokale Entwicklung
```
http://localhost:7071/auth/github/callback
```

## OAuth2-Flow

1. Benutzer öffnet App ohne Token
2. App zeigt "Mit GitHub anmelden" Button
3. Benutzer klickt Button → Redirect zu `/auth/github`
4. Backend leitet zu GitHub OAuth weiter
5. Benutzer autorisiert App auf GitHub
6. GitHub leitet zurück zu `/auth/github/callback?code=...&state=...`
7. Backend validiert `state` (CSRF-Schutz)
8. Backend tauscht `code` gegen `access_token` aus
9. Backend leitet zu Frontend weiter: `/?token=...`
10. Frontend speichert Token in localStorage
11. Frontend sendet Token bei jeder API-Anfrage im `Authorization: Bearer` Header
12. Backend extrahiert userId aus Token

## Sicherheitsfeatures

1. **CSRF-Schutz**: State-Parameter wird generiert und validiert
2. **HttpOnly Cookie**: OAuth state wird in HttpOnly Cookie gespeichert
3. **Secure & SameSite**: Cookies sind nur über HTTPS und same-site
4. **Token-Validierung**: Access Token wird sofort mit GitHub API verifiziert
5. **Benutzer-Isolierung**: Jeder Benutzer hat eigenen Ordner im Repository

## Setup-Anleitung

### Schritt 1: GitHub OAuth App erstellen

1. GitHub → Settings → Developer settings → OAuth Apps
2. New OAuth App
3. Felder ausfüllen:
   - **Application name**: CodexMiroir
   - **Homepage URL**: `https://your-app.azurewebsites.net`
   - **Authorization callback URL**: `https://your-app.azurewebsites.net/auth/github/callback`
4. Client ID und Client Secret kopieren

### Schritt 2: Environment Variables konfigurieren

#### Lokal (`local.settings.json`):
```json
{
  "Values": {
    "GITHUB_OAUTH_CLIENT_ID": "...",
    "GITHUB_OAUTH_CLIENT_SECRET": "...",
    "GITHUB_OAUTH_REDIRECT_URI": "http://localhost:7071/auth/github/callback"
  }
}
```

#### Azure:
```bash
az functionapp config appsettings set \
  --name codexmiroir-func \
  --resource-group codexmiroir-rg \
  --settings \
    "GITHUB_OAUTH_CLIENT_ID=..." \
    "GITHUB_OAUTH_CLIENT_SECRET=..." \
    "GITHUB_OAUTH_REDIRECT_URI=https://your-app.azurewebsites.net/auth/github/callback"
```

### Schritt 3: Deployen

```bash
npm start  # Lokal testen
func azure functionapp publish codexmiroir-func  # Azure deployen
```

## Kompatibilität

Die Implementierung ist **rückwärtskompatibel** mit dem bestehenden PAT-Flow:
- Personal Access Tokens via `?token=...` funktionieren weiterhin
- Bestehende `shared/auth.js` unverändert
- Alle bestehenden Endpunkte funktionieren mit beiden Auth-Methoden

## Dateien geändert

1. ✅ `src/authGithub.js` (neu)
2. ✅ `src/functions.js` (Import hinzugefügt)
3. ✅ `local.settings.json` (Environment Variables)
4. ✅ `public/index.html` (Login/Logout-Buttons)
5. ✅ `public/app.js` (Login-Flow & Logout-Funktion)
6. ✅ `OAUTH2_SETUP.md` (Dokumentation aktualisiert)

## Tests erforderlich

- [ ] OAuth-Flow lokal testen
- [ ] Callback-URL validieren
- [ ] Token-Exchange testen
- [ ] CSRF-Schutz prüfen
- [ ] Logout-Funktion testen
- [ ] PAT-Kompatibilität verifizieren

## Nächste Schritte

1. GitHub OAuth App erstellen (siehe Setup-Anleitung oben)
2. Environment Variables in Azure konfigurieren
3. App deployen und testen
4. Optional: Tests für neue Endpunkte schreiben (`__tests__/src/authGithub.test.js`)
