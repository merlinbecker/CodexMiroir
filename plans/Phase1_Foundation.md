# Phase 1: Foundation Setup - Azure Functions & JavaScript Framework

## Übersicht
Diese Phase legt das technische Fundament für die neue Azure Functions basierte Architektur und etabliert die grundlegende JavaScript-Infrastruktur.

## Ziele
- Azure Functions App funktionsfähig
- Azure Storage Account konfiguriert
- Basis JavaScript Framework implementiert
- User Management System funktional

## Aufgaben

### 1.1 Azure Functions App Setup
**Geschätzter Aufwand**: 4 Stunden

#### Struktur
```
/
├── host.json
├── package.json
├── src/
│   ├── functions/
│   │   ├── api-tasks.js
│   │   ├── api-voice.js
│   │   ├── api-reports.js
│   │   └── static-ui.js
│   ├── services/
│   │   ├── storage-service.js
│   │   ├── user-service.js
│   │   ├── task-service.js
│   │   └── ai-service.js
│   ├── utils/
│   │   ├── markdown-parser.js
│   │   ├── calendar-utils.js
│   │   └── crypto-utils.js
│   └── models/
│       ├── task.js
│       ├── user.js
│       └── calendar.js
├── public/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── sw.js (Service Worker)
└── test/
    ├── unit/
    └── integration/
```

#### host.json Konfiguration
```json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "routePrefix": ""
    }
  },
  "functionTimeout": "00:05:00",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true
      }
    }
  }
}
```

#### Implementierungsschritte
1. Azure Functions Core Tools Installation
2. Neues Functions Projekt initialisieren
3. package.json für JavaScript konfigurieren
4. Basic HTTP Triggers implementieren
5. Local Development Setup

### 1.2 Azure Storage Account Integration
**Geschätzter Aufwand**: 3 Stunden

#### Storage Container Structure
```
codexmiroir-storage/
├── users/
│   ├── {user-id-1}/
│   │   ├── business-tasks.md
│   │   ├── private-tasks.md
│   │   ├── calendar.md
│   │   └── config.json
│   └── {user-id-2}/
│       ├── business-tasks.md
│       ├── private-tasks.md
│       ├── calendar.md
│       └── config.json
└── templates/
    ├── business-tasks-template.md
    ├── private-tasks-template.md
    └── calendar-template.md
```

#### Storage Service Implementation
```javascript
// storage-service.js
class AzureStorageService {
  constructor() {
    this.containerClient = // Azure Storage Client
  }
  
  async getUserFile(userId, fileName) {
    // Read markdown file from blob storage
  }
  
  async saveUserFile(userId, fileName, content) {
    // Save markdown file to blob storage
  }
  
  async createUser(userId) {
    // Create user directory with templates
  }
  
  async userExists(userId) {
    // Check if user directory exists
  }
}
```

#### Implementierungsschritte
1. Azure Storage Account erstellen
2. Container und Blob-Struktur definieren
3. Azure Storage SDK Integration
4. Storage Service Klasse implementieren
5. Markdown Template Dateien erstellen

### 1.3 User Management System
**Geschätzter Aufwand**: 5 Stunden

#### User ID Generation
- 64-Zeichen Hex-String als sicherer Identifikator
- Kryptographisch sicher mit crypto.randomBytes()
- URL-Format: `/?user={SECRET_KEY}`

#### User Service Implementation
```javascript
// user-service.js
class UserService {
  constructor(storageService) {
    this.storage = storageService;
  }
  
  generateUserId() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
  
  async createUser() {
    const userId = this.generateUserId();
    await this.storage.createUser(userId);
    return userId;
  }
  
  async validateUser(userId) {
    return await this.storage.userExists(userId);
  }
  
  getUserUrl(userId, baseUrl = '') {
    return `${baseUrl}/?user=${userId}`;
  }
}
```

#### URL Routing Logic
```javascript
// Middleware für User-Authentifizierung
function authenticateUser(req, res, next) {
  const userId = req.query.user || req.headers['x-user-id'];
  
  if (!userId || !isValidUserId(userId)) {
    return res.status(401).json({ error: 'Invalid user ID' });
  }
  
  req.userId = userId;
  next();
}
```

### 1.4 Basic JavaScript Framework
**Geschätzter Aufwand**: 6 Stunden

#### Dependency Injection Container
```javascript
// di-container.js
class DIContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }
  
  register(name, factory, singleton = false) {
    this.services.set(name, { factory, singleton });
  }
  
  resolve(name) {
    const service = this.services.get(name);
    if (!service) throw new Error(`Service ${name} not found`);
    
    if (service.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, service.factory(this));
      }
      return this.singletons.get(name);
    }
    
    return service.factory(this);
  }
}
```

#### Service Registration
```javascript
// bootstrap.js
function registerServices(container) {
  // Storage Service
  container.register('storageService', () => new AzureStorageService(), true);
  
  // User Service
  container.register('userService', (c) => 
    new UserService(c.resolve('storageService')), true);
  
  // Task Service
  container.register('taskService', (c) => 
    new TaskService(c.resolve('storageService')), true);
  
  // AI Service
  container.register('aiService', () => new OpenAIService(), true);
}
```

#### Error Handling Middleware
```javascript
// error-handler.js
function errorHandler(error, req, res, next) {
  console.error('Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: error.message 
    });
  }
  
  if (error.name === 'UserNotFoundError') {
    return res.status(404).json({ 
      error: 'User not found' 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}
```

## Testing Strategy

### Unit Tests
```javascript
// test/unit/user-service.test.js
const { UserService } = require('../../src/services/user-service');

describe('UserService', () => {
  test('should generate valid user ID', () => {
    const userService = new UserService(mockStorage);
    const userId = userService.generateUserId();
    
    expect(userId).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(userId)).toBe(true);
  });
});
```

### Integration Tests
```javascript
// test/integration/api.test.js
describe('API Integration', () => {
  test('should create new user', async () => {
    const response = await request(app)
      .post('/api/users')
      .expect(201);
    
    expect(response.body.userId).toBeDefined();
    expect(response.body.url).toContain('?user=');
  });
});
```

## Deliverables

### Code Artifacts
- [ ] Azure Functions projekt-struktur
- [ ] Storage Service Implementierung
- [ ] User Management System
- [ ] Dependency Injection Framework
- [ ] Basic Error Handling
- [ ] Unit Tests für Core Services

### Configuration
- [ ] host.json Konfiguration
- [ ] package.json Dependencies
- [ ] Azure Storage Konfiguration
- [ ] Environment Variables Setup

### Documentation
- [ ] API Dokumentation (Basic Endpoints)
- [ ] Deployment Guide
- [ ] Local Development Setup

## Akzeptanzkriterien

### Funktional
- ✅ Neuer User kann erstellt werden
- ✅ User kann über Secret URL authentifiziert werden
- ✅ Azure Storage Integration funktional
- ✅ Basic CRUD für Markdown Files

### Technisch
- ✅ 100% JavaScript (kein TypeScript)
- ✅ Azure Functions lokal lauffähig
- ✅ Unit Test Coverage > 80%
- ✅ Error Handling implementiert

### Performance
- ✅ API Response < 500ms
- ✅ Cold Start < 2 Sekunden
- ✅ Storage Operations < 200ms

## Risiken & Mitigation

### Azure Functions Cold Start
**Risiko**: Erste Anfrage nach Inaktivität dauert lange  
**Mitigation**: Always-On Konfiguration oder Warmup-Calls

### Storage Latency
**Risiko**: Azure Storage kann bei großen Files langsam sein  
**Mitigation**: Caching-Layer und optimierte Markdown-Struktur

### JavaScript Migration Komplexität
**Risiko**: TypeScript zu JavaScript Migration führt zu Fehlern  
**Mitigation**: Schrittweise Migration und umfassende Tests

## Nächste Schritte

Nach Abschluss von Phase 1:
1. **Phase 2 Planung**: Detailplanung Task Migration
2. **Performance Baseline**: Messung der aktuellen Performance
3. **Data Migration Plan**: Strategie für Datenübernahme
4. **UI Framework Auswahl**: Entscheidung für Frontend Framework

---

**Geschätzter Gesamtaufwand**: 18 Stunden  
**Dauer**: 2-3 Arbeitstage  
**Abhängigkeiten**: Azure Account, Development Environment