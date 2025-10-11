# Login-Seite - Implementierung

## Übersicht

Eine dedizierte Login-Seite (`/login.html`) wurde erstellt, auf die nicht-authentifizierte Benutzer automatisch weitergeleitet werden.

## Features

### ✨ **GitHub OAuth Authentifizierung:**

- Button "Mit GitHub anmelden"
- Leitet zu `/auth/github` weiter
- Startet OAuth-Flow mit CSRF-Schutz
- Nach Callback: Automatische Weiterleitung zur Hauptseite

### 🎨 **Design:**

- Moderne, ansprechende UI mit Gradient-Hintergrund
- Responsive Design (mobile-friendly)
- Loading-States und Animationen
- Fehler- und Erfolgs-Meldungen
- Info-Box mit Hilfe-Links

### 🔒 **Sicherheit:**

- OAuth2 Authorization Code Flow
- State-Parameter für CSRF-Schutz
- Token-Validierung über GitHub API
- Session Cookies (HttpOnly, Secure, SameSite)
- Keine Token-Speicherung vor erfolgreicher Validierung
- Automatische Weiterleitung bei bereits vorhandenem Token

## Flow-Diagramm

### **Nicht-authentifizierter Benutzer:**

```
1. Benutzer öffnet / (index.html)
   ↓
2. app.js prüft: Token vorhanden?
   ↓ NEIN
3. Redirect zu /login.html
   ↓
4. Benutzer klickt "Mit GitHub anmelden"
   ↓
5. Redirect zu /auth/github
   ↓
6. Backend generiert State-Parameter
   ↓
7. Redirect zu GitHub OAuth
   ↓
8. Benutzer autorisiert App
   ↓
9. GitHub → /auth/github/callback?code=...&state=...
   ↓
10. Backend validiert State
   ↓
11. Backend: Code → Token Exchange
   ↓
12. Backend: Token-Validierung mit GitHub API
   ↓
13. Redirect zu /?token=...
   ↓
14. login.html: Token in localStorage
   ↓
15. Redirect zu / (angemeldet)
```

### **Bereits authentifizierter Benutzer:**

```
1. Benutzer öffnet / (index.html)
   ↓
2. app.js prüft: Token vorhanden?
   ↓ JA
3. Lädt Timeline
   ↓
4. Zeigt Hauptseite
```

### **Logout:**

```
1. Benutzer klickt "Abmelden"
   ↓
2. app.js: logout()
   ↓
3. Token aus localStorage löschen
   ↓
4. userId aus localStorage löschen
   ↓
5. Redirect zu /login.html
```

## Implementierungs-Details

### **Dateien:**

1. ✅ **`public/login.html`** - Dedizierte Login-Seite
   - OAuth Login-Button
   - Token-Validierung über OAuth Callback
   - Automatische Weiterleitung

2. ✅ **`public/app.js`** - Aktualisiert
   - Redirect zu `/login.html` wenn nicht authentifiziert
   - Logout leitet zu `/login.html` weiter
   - Entfernt Login-Button aus Hauptseite

3. ✅ **`public/index.html`** - Aktualisiert
   - Login-Button entfernt
   - Logout-Button immer sichtbar (für authentifizierte Benutzer)

4. ✅ **`src/authGithub.js`** - OAuth Endpoints
   - OAuth-Callback leitet zu `/` weiter
   - Token als URL-Parameter + Session-Cookie

### **Login-Seite JavaScript:**

```javascript
// 1. Beim Laden: Prüfe ob bereits eingeloggt
window.addEventListener('DOMContentLoaded', () => {
    const tokenFromUrl = urlParams.get('token');
    const tokenFromStorage = localStorage.getItem('codexmiroir_token');

    if (tokenFromUrl) {
        // Von OAuth Callback
        localStorage.setItem('codexmiroir_token', tokenFromUrl);
        window.location.href = '/';
    } else if (tokenFromStorage) {
        // Bereits eingeloggt
        window.location.href = '/';
    }
});

// 2. GitHub OAuth Button
document.getElementById('githubLoginBtn').addEventListener('click', () => {
    window.location.href = '/auth/github';
});
```

## Benutzer-Erfahrung

### **Erstmaliger Besuch:**

1. Öffnet `https://your-app.com`
2. Sieht schöne Login-Seite
3. Klickt "Mit GitHub anmelden"
4. Autorisiert App auf GitHub
5. Wird zurück zur App geleitet
6. Sieht Timeline ✓

### **Wiederkehrender Besuch:**

1. Öffnet `https://your-app.com`
2. Token vorhanden → Direkt zur Timeline ✓

### **Logout:**

1. Klickt "Abmelden" in der Hauptseite
2. Wird zur Login-Seite weitergeleitet
3. Kann sich neu anmelden

## Vorteile

✅ **Bessere UX:**
- Dedizierte, professionell aussehende Login-Seite
- Klare Call-to-Action
- Keine Browser-Prompts mehr

✅ **Sicherheit:**
- OAuth2 Authorization Code Flow mit CSRF-Schutz
- State-Parameter-Validierung
- Token-Validierung mit GitHub API
- HttpOnly Session Cookies
- Klare Trennung: Authentifiziert vs. Nicht-authentifiziert

✅ **Entwickler-freundlich:**
- Einfaches Setup mit Environment Variables
- Separate OAuth Apps für Dev/Prod möglich

## Testing

### **Lokales Testing:**

```bash
# 1. Starte App
npm start

# 2. Öffne Browser
open http://localhost:7071

# Erwartetes Verhalten:
# - Automatischer Redirect zu /login.html
# - Login-Seite wird angezeigt
# - OAuth Login funktioniert
```

### **Test-Szenarien:**

1. **Nicht-authentifiziert:**
   ```
   open http://localhost:7071
   → Redirect zu /login.html ✓
   ```

2. **OAuth Login:**
   ```
   Klick "Mit GitHub anmelden"
   → Redirect zu GitHub ✓
   → Autorisierung ✓
   → Redirect zu / ✓
   → Timeline wird geladen ✓
   ```

3. **Bereits eingeloggt:**
   ```
   Token in localStorage vorhanden
   → Direkter Zugriff auf / ✓
   → Keine Weiterleitung zu /login.html ✓
   ```

4. **Logout:**
   ```
   Klick "Abmelden"
   → Token gelöscht ✓
   → Redirect zu /login.html ✓
   ```

## Anpassungen

### **Branding:**

Ändere in `public/login.html`:

```html
<!-- Logo -->
<div class="logo">🔮</div>  <!-- Ändere Emoji -->

<!-- Titel -->
<h1>Willkommen bei Codex Miroir</h1>  <!-- Ändere Text -->

<!-- Subtitle -->
<p class="subtitle">
    Dein persönlicher Task-Manager...  <!-- Ändere Beschreibung -->
</p>
```

### **Farben:**

```css
/* Gradient Hintergrund */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* GitHub Button Farbe */
background: #24292e;  /* GitHub Schwarz */

/* PAT Submit Button */
background: #667eea;  /* Lila */
```

### **Zusätzliche OAuth-Provider:**

Füge weitere Buttons in `login.html` hinzu:

```html
<!-- Google OAuth -->
<a href="/auth/google" class="login-btn">
    <svg>...</svg>
    Mit Google anmelden
</a>

<!-- GitLab OAuth -->
<a href="/auth/gitlab" class="login-btn">
    <svg>...</svg>
    Mit GitLab anmelden
</a>
```

## Troubleshooting

### **Login-Seite wird nicht angezeigt:**

Prüfe `serveStatic.js`:

```javascript
// Stelle sicher, dass login.html serviert wird
const validPaths = ['/', '/index.html', '/login.html', ...];
```

### **Redirect-Loop:**

```javascript
// Prüfe in app.js:
if (!this.functionKey) {
    window.location.href = '/login.html';  // Nicht zu '/'!
}

// Prüfe in login.html:
if (tokenFromStorage) {
    window.location.href = '/';  // Nicht zu '/login.html'!
}
```

### **Token wird nicht gespeichert:**

```javascript
// Debug in Browser Console:
console.log(localStorage.getItem('codexmiroir_token'));

// Prüfe ob localStorage verfügbar:
if (typeof(Storage) !== "undefined") {
    // localStorage verfügbar
}
```

## Nächste Schritte

- [ ] CSS in separate Datei auslagern (`public/login.css`)
- [ ] JavaScript in separate Datei auslagern (`public/login.js`)
- [ ] Error-Tracking hinzufügen (z.B. Sentry)
- [ ] Analytics hinzufügen (z.B. Google Analytics)
- [ ] Loading-States verbessern
- [ ] Accessibility (a11y) verbessern
- [ ] i18n (Mehrsprachigkeit) hinzufügen

## Links

- **Login-Seite:** `/login.html`
- **OAuth Initiierung:** `/auth/github`
- **OAuth Callback:** `/auth/github/callback`
- **Hauptseite:** `/` (index.html)
