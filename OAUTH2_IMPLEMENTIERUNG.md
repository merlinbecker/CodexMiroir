# OAuth2 Authentifizierung - Implementierungszusammenfassung

## Überblick

Die Authentifizierung von CodexMiroir wurde erfolgreich von Azure Function Keys auf GitHub OAuth2 umgestellt.

## Durchgeführte Änderungen

### 1. Backend-Änderungen

#### Alle Azure Functions auf "anonymous" umgestellt

Folgende Functions wurden aktualisiert:
- `createTask.js` - Task erstellen
- `updateTask.js` - Task aktualisieren
- `completeTask.js` - Task als abgeschlossen markieren
- `renderCodex.js` - Timeline rendern
- `manualSync.js` - Manueller Sync mit GitHub

Alle haben jetzt `authLevel: "anonymous"` statt `authLevel: "function"`.

#### Neues Auth-Modul erstellt

**Datei**: `shared/auth.js`

Zwei Hauptfunktionen:
1. `extractUserId(request)` - Extrahiert die userId (GitHub Username) aus dem OAuth2 Token
2. `validateAuth(request)` - Validiert den Token und gibt entweder userId oder Fehler zurück

Das Modul:
- Liest den `Authorization: Bearer <token>` Header
- Ruft die GitHub API auf (`/user` Endpoint) mit dem Token
- Extrahiert den `login` (Username) aus der Antwort
- Gibt einen 401-Fehler zurück bei ungültigen Tokens

#### Speicherstruktur angepasst

Tasks werden jetzt in benutzerspezifischen Ordnern gespeichert:

**Vorher:**
```
codex-miroir/
  └── tasks/
      ├── 0000-task1.md
      ├── 0001-task2.md
      └── ...
```

**Jetzt:**
```
codex-miroir/
  ├── username1/
  │   └── tasks/
  │       ├── 0000-task1.md
  │       ├── 0001-task2.md
  │       └── ...
  ├── username2/
  │   └── tasks/
  │       └── ...
  └── ...
```

Entsprechend auch im Blob Storage Cache:
- Tasks: `raw/{userId}/tasks/`
- Timeline-Artefakte: `artifacts/{userId}/`
- State (nextId, lastHeadSha): `state/{userId}/`

### 2. Frontend-Änderungen

**Datei**: `public/app.js`

#### Token-Verwaltung

- Token wird aus URL-Parameter `?token=...` oder Hash `#token=...` gelesen
- Token wird in `localStorage` unter `codexmiroir_token` gespeichert
- Falls kein Token vorhanden, wird der Benutzer aufgefordert, einen einzugeben

#### API-Anfragen

Neue Methode `apiRequest()` erstellt:
```javascript
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

Alle `fetch()`-Aufrufe wurden aktualisiert, um das Authorization-Header mitzusenden.

#### UserId-Extraktion

Die `userId` wird jetzt automatisch vom Backend aus dem Token extrahiert und in der Response mitgesendet. Der Benutzer muss sie nicht mehr manuell eingeben.

### 3. Dokumentation

**Neue Datei**: `OAUTH2_SETUP.md` (auf Englisch)

Enthält:
- Detaillierte Erklärung der OAuth2-Implementierung
- Anleitung zum Erstellen eines GitHub OAuth Apps
- Anleitung zum Erstellen eines Personal Access Tokens (PAT)
- Beispiele für die Verwendung
- Troubleshooting-Tipps
- Migration von Function Keys

### 4. Tests

**Neue Datei**: `__tests__/shared/auth.test.js`

8 Tests für die OAuth2-Authentifizierung:
- ✓ Erfolgreiche Token-Validierung
- ✓ Fehlende Authorization Header
- ✓ Ungültiges Header-Format
- ✓ GitHub API-Fehler
- ✓ Ungültige Benutzerdaten

**Aktualisierte Tests**:
- `__tests__/shared/sync.test.js` - Alle Sync-Tests mit userId-Parameter
- `__tests__/shared/sync.cache.test.js` - Alle Cache-Tests mit userId-Parameter

**Ergebnis**: Alle 187 Tests bestehen ✓

## Verwendung

### Für Entwickler

1. GitHub Personal Access Token erstellen:
   - GitHub → Settings → Developer settings → Personal access tokens
   - Scopes: `repo`, `read:user`

2. App mit Token im URL aufrufen:
   ```
   https://your-app.azurewebsites.net/?token=ghp_YOUR_TOKEN
   ```

3. Token wird automatisch gespeichert und bei allen API-Anfragen verwendet

### Für Benutzer

Die App funktioniert genauso wie vorher, aber:
- Statt Function Key (`?code=...`) wird OAuth Token (`?token=...`) verwendet
- Username wird automatisch aus dem Token extrahiert
- Jeder Benutzer sieht nur seine eigenen Tasks

## Sicherheitsverbesserungen

1. **Benutzer-Isolierung**: Jeder Benutzer hat seinen eigenen Ordner, keine Kollisionen
2. **Token-basiert**: Tokens können einfacher widerrufen werden als Function Keys
3. **GitHub-Integration**: Authentifizierung über GitHub, keine separaten Credentials
4. **Granulare Berechtigungen**: OAuth Scopes erlauben feinkörnige Zugriffskontrolle

## Abwärtskompatibilität

**Breaking Changes:**
- Function Keys (`?code=...`) funktionieren nicht mehr
- Bestehende Tasks müssen in userId-Ordner verschoben werden
- State-Dateien müssen in `state/{userId}/` verschoben werden

**Migration notwendig** für:
- Bestehende Task-Dateien im Repository
- nextId.txt und lastHeadSha.txt Dateien
- Frontend-URLs (von `?code=` zu `?token=`)

## Technische Details

### Authentifizierungs-Flow

1. Benutzer öffnet App mit `?token=ghp_xxx` im URL
2. Frontend speichert Token in localStorage
3. Bei jeder API-Anfrage sendet Frontend `Authorization: Bearer ghp_xxx` Header
4. Backend-Function ruft `validateAuth(request)` auf
5. Auth-Modul verifiziert Token mit GitHub API
6. GitHub API gibt User-Daten zurück (inklusive `login`)
7. Function verwendet `login` als `userId`
8. Tasks werden in `codex-miroir/{userId}/tasks/` gespeichert

### Fehlerbehandlung

- 401 Unauthorized: Token fehlt oder ungültig
- GitHub API-Fehler werden an Frontend weitergegeben
- Klare Fehlermeldungen für Debugging

## Zusammenfassung

✅ Alle Functions auf `anonymous` umgestellt
✅ OAuth2-Validierung implementiert
✅ UserId aus Token extrahiert
✅ Speicherstruktur mit userId-Unterordnern
✅ Frontend auf Token-Authentifizierung umgestellt
✅ Umfassende Tests (187/187 bestehen)
✅ Dokumentation erstellt

Die Implementierung ist vollständig und einsatzbereit!
