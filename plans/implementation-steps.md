# Schritt-für-Schritt Implementierungsplan

## Übersicht
Dieser Plan beschreibt die konkreten Implementierungsschritte für die ersten beiden Phasen der Migration von Next.js zu Azure Functions mit JavaScript und Azure Storage.

## Voraussetzungen

### Azure Setup
- [ ] Azure Account mit aktiver Subscription
- [ ] Azure CLI installiert und konfiguriert
- [ ] Azure Functions Core Tools v4 installiert
- [ ] Storage Account erstellt
- [ ] OpenAI API Key verfügbar

### Development Environment
- [ ] Node.js 18+ installiert
- [ ] Git Repository geklont
- [ ] Visual Studio Code mit Azure Functions Extension
- [ ] Postman oder ähnliches Tool für API Tests

## Phase 1: Foundation Setup (2-3 Arbeitstage)

### Tag 1: Azure Functions Grundstruktur

#### Schritt 1.1: Neues Azure Functions Projekt (2 Stunden)
```bash
# Neues Verzeichnis für Azure Functions
mkdir codexmiroir-functions
cd codexmiroir-functions

# Functions Projekt initialisieren
func init . --javascript --model v4

# Basis-Dependencies installieren
npm install @azure/storage-blob @azure/functions axios crypto
npm install --save-dev @azure/functions-testing-library jest
```

#### Schritt 1.2: Project Structure Setup (1 Stunde)
```bash
# Verzeichnisstruktur erstellen
mkdir -p src/{functions,services,utils,models}
mkdir -p public/{css,js}
mkdir -p test/{unit,integration}
mkdir -p templates

# Basic files erstellen
touch src/services/storage-service.js
touch src/services/user-service.js
touch src/utils/crypto-utils.js
touch src/models/user.js
```

#### Schritt 1.3: Host Configuration (0.5 Stunden)
```json
// host.json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "routePrefix": ""
    }
  },
  "functionTimeout": "00:05:00",
  "logging": {
    "logLevel": {
      "default": "Information"
    }
  }
}
```

#### Schritt 1.4: Environment Setup (0.5 Stunden)
```javascript
// local.settings.json (für Development)
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_STORAGE_CONNECTION_STRING": "",
    "OPENAI_API_KEY": ""
  }
}
```

### Tag 2: Azure Storage Integration

#### Schritt 2.1: Storage Service Implementation (3 Stunden)
```javascript
// src/services/storage-service.js
const { BlobServiceClient } = require('@azure/storage-blob');

class AzureStorageService {
  constructor() {
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
    this.containerName = 'users';
  }
  
  async init() {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    await containerClient.createIfNotExists({ access: 'private' });
  }
  
  async getUserFile(userId, fileName) {
    try {
      const blobClient = this.blobServiceClient
        .getContainerClient(this.containerName)
        .getBlobClient(`${userId}/${fileName}`);
      
      const downloadResponse = await blobClient.download();
      const content = await streamToBuffer(downloadResponse.readableStreamBody);
      return content.toString();
    } catch (error) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }
  
  async saveUserFile(userId, fileName, content) {
    const blobClient = this.blobServiceClient
      .getContainerClient(this.containerName)
      .getBlobClient(`${userId}/${fileName}`);
    
    await blobClient.upload(content, content.length, {
      overwrite: true,
      metadata: {
        lastModified: new Date().toISOString()
      }
    });
  }
  
  async createUser(userId) {
    // Erstelle Benutzerverzeichnis mit Template-Dateien
    const templates = ['business-tasks.md', 'private-tasks.md', 'config.json'];
    
    for (const template of templates) {
      const templateContent = await this.getTemplate(template);
      await this.saveUserFile(userId, template, templateContent);
    }
  }
  
  async userExists(userId) {
    const blobClient = this.blobServiceClient
      .getContainerClient(this.containerName)
      .getBlobClient(`${userId}/config.json`);
    
    return await blobClient.exists();
  }
}

// Helper function
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => chunks.push(data instanceof Buffer ? data : Buffer.from(data)));
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
}

module.exports = { AzureStorageService };
```

#### Schritt 2.2: Template Files erstellen (1 Stunde)
```markdown
# templates/business-tasks.md
# Business Tasks - User: {USER_ID}

## Metadata
```yaml
created: {CREATED_DATE}
lastModified: {CREATED_DATE}
totalTasks: 0
activeTasks: 0
completedTasks: 0
```

## Active Tasks
<!-- No active tasks -->

## Pending Tasks  
<!-- No pending tasks -->

## Completed Tasks
<!-- No completed tasks -->
```

#### Schritt 2.3: Unit Tests für Storage (1 Stunde)
```javascript
// test/unit/storage-service.test.js
const { AzureStorageService } = require('../../src/services/storage-service');

describe('AzureStorageService', () => {
  let storageService;
  
  beforeEach(() => {
    storageService = new AzureStorageService();
  });
  
  test('should save and retrieve user file', async () => {
    const userId = 'test-user-123';
    const fileName = 'test.md';
    const content = '# Test Content';
    
    await storageService.saveUserFile(userId, fileName, content);
    const retrieved = await storageService.getUserFile(userId, fileName);
    
    expect(retrieved).toBe(content);
  });
});
```

### Tag 3: User Management & Basic API

#### Schritt 3.1: User Service Implementation (2 Stunden)
```javascript
// src/services/user-service.js
const crypto = require('crypto');

class UserService {
  constructor(storageService) {
    this.storage = storageService;
  }
  
  generateUserId() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  async createUser() {
    const userId = this.generateUserId();
    await this.storage.createUser(userId);
    return userId;
  }
  
  async validateUser(userId) {
    if (!userId || userId.length !== 64 || !/^[a-f0-9]+$/.test(userId)) {
      return false;
    }
    return await this.storage.userExists(userId);
  }
  
  getUserUrl(userId, baseUrl = '') {
    return `${baseUrl}/?user=${userId}`;
  }
}

module.exports = { UserService };
```

#### Schritt 3.2: Basic API Functions (2 Stunden)
```javascript
// src/functions/api-users.js
const { app } = require('@azure/functions');
const { AzureStorageService } = require('../services/storage-service');
const { UserService } = require('../services/user-service');

app.http('createUser', {
  methods: ['POST'],
  route: 'api/users',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const storageService = new AzureStorageService();
      await storageService.init();
      
      const userService = new UserService(storageService);
      const userId = await userService.createUser();
      
      const baseUrl = `https://${request.headers.host}`;
      const userUrl = userService.getUserUrl(userId, baseUrl);
      
      return {
        status: 201,
        jsonBody: {
          userId,
          url: userUrl,
          message: 'User created successfully'
        }
      };
    } catch (error) {
      context.error('Error creating user:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to create user' }
      };
    }
  }
});

app.http('validateUser', {
  methods: ['GET'],
  route: 'api/users/{userId}',
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const { userId } = request.params;
      
      const storageService = new AzureStorageService();
      await storageService.init();
      
      const userService = new UserService(storageService);
      const isValid = await userService.validateUser(userId);
      
      return {
        status: isValid ? 200 : 404,
        jsonBody: { valid: isValid }
      };
    } catch (error) {
      context.error('Error validating user:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to validate user' }
      };
    }
  }
});
```

#### Schritt 3.3: Basic Frontend (1.5 Stunden)
```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Codex Miroir - Task Manager</title>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="manifest" href="/manifest.json">
</head>
<body>
    <div id="app">
        <div id="loading" class="loading">Loading...</div>
        <div id="error" class="error hidden"></div>
        <div id="main-content" class="hidden">
            <h1>Codex Miroir</h1>
            <div id="user-info"></div>
            <div id="mode-toggle">
                <button id="toggle-btn">Switch to Private</button>
            </div>
            <div id="task-content">
                <!-- Task content will be loaded here -->
            </div>
        </div>
    </div>
    <script src="/js/app.js"></script>
</body>
</html>
```

## Phase 2: Task Management Migration (3-4 Arbeitstage)

### Tag 4: Markdown Parser

#### Schritt 4.1: Markdown Parser Implementation (4 Stunden)
```javascript
// src/utils/markdown-parser.js
class MarkdownTaskParser {
  constructor() {
    this.taskRegex = /^### task-(\w+) \| (.+?)$/gm;
    this.metaRegex = /^- \*\*(\w+)\*\*: (.+)$/gm;
    this.yamlRegex = /```yaml\n([\s\S]*?)\n```/;
  }
  
  parseTaskFile(markdownContent) {
    if (!markdownContent || markdownContent.trim() === '') {
      return { metadata: {}, active: [], pending: [], completed: [] };
    }
    
    const metadata = this.parseMetadata(markdownContent);
    const activeTasks = this.parseSection(markdownContent, 'Active Tasks');
    const pendingTasks = this.parseSection(markdownContent, 'Pending Tasks');
    const completedTasks = this.parseSection(markdownContent, 'Completed Tasks');
    
    return {
      metadata,
      active: activeTasks,
      pending: pendingTasks.sort((a, b) => (a.order || 0) - (b.order || 0)),
      completed: completedTasks
    };
  }
  
  generateTaskFile(userId, tasks) {
    const metadata = this.generateMetadata(tasks);
    
    return `# Business Tasks - User: ${userId}

## Metadata
\`\`\`yaml
${this.generateYamlMetadata(metadata)}
\`\`\`

## Active Tasks
${this.generateTaskSection(tasks.active)}

## Pending Tasks
${this.generateTaskSection(tasks.pending)}

## Completed Tasks
${this.generateTaskSection(tasks.completed, true)}
`;
  }
  
  // Implementation der einzelnen Parser-Methoden...
}

module.exports = { MarkdownTaskParser };
```

### Tag 5-6: Task Service & API

#### Schritt 5.1: Task Service Implementation (6 Stunden)
[Vollständige Task Service Implementierung wie in Phase2_CoreMigration.md beschrieben]

#### Schritt 5.2: Task API Functions (4 Stunden)
[Vollständige API Implementation wie in Phase2_CoreMigration.md beschrieben]

### Tag 7: Frontend Migration

#### Schritt 7.1: JavaScript Task Manager (6 Stunden)
[Vollständige Frontend Implementation wie in Phase2_CoreMigration.md beschrieben]

#### Schritt 7.2: CSS Styling (2 Stunden)
```css
/* public/css/style.css */
:root {
  --primary-color: #1e293b;
  --secondary-color: #f8fafc;
  --accent-color: #3b82f6;
  --text-color: #1f2937;
  --border-color: #e5e7eb;
}

.theme-dark {
  --primary-color: #0f172a;
  --secondary-color: #1e293b;
  --accent-color: #60a5fa;
  --text-color: #f1f5f9;
  --border-color: #374151;
}

/* Responsive Design und Theme-basierte Styles */
```

## Testing & Validation (1 Tag)

### Schritt 8.1: Integration Tests (4 Stunden)
```javascript
// test/integration/api.test.js
const { app } = require('@azure/functions');

describe('API Integration Tests', () => {
  test('should create user and manage tasks', async () => {
    // User creation test
    // Task CRUD tests
    // File storage validation
  });
});
```

### Schritt 8.2: Manual Testing (2 Stunden)
- [ ] User creation flow testen
- [ ] Task CRUD operations validieren  
- [ ] Frontend functionality prüfen
- [ ] Error handling testen

### Schritt 8.3: Performance Testing (2 Stunden)
- [ ] API Response Times messen
- [ ] Storage operation performance
- [ ] Frontend load times

## Deployment (0.5 Tage)

### Schritt 9.1: Azure Deployment (2 Stunden)
```bash
# Functions App erstellen
az functionapp create --name codexmiroir-app --resource-group myResourceGroup --consumption-plan-location westeurope --runtime node --functions-version 4

# Deploy
func azure functionapp publish codexmiroir-app

# App Settings konfigurieren
az functionapp config appsettings set --name codexmiroir-app --resource-group myResourceGroup --settings "AZURE_STORAGE_CONNECTION_STRING=..."
```

### Schritt 9.2: DNS & Domain Setup (1 Stunde)
- [ ] Custom Domain konfigurieren
- [ ] HTTPS Certificate setup
- [ ] CDN Configuration (optional)

## Quality Gates

### Definition of Done für jede Phase
- [ ] Alle Unit Tests bestehen (Coverage > 80%)
- [ ] Integration Tests erfolgreich
- [ ] Manual Testing abgeschlossen
- [ ] Performance Targets erreicht
- [ ] Code Review durchgeführt
- [ ] Documentation aktualisiert

### Performance Targets
- [ ] API Response Times < 200ms
- [ ] Frontend Initial Load < 1s
- [ ] Storage Operations < 100ms
- [ ] User Creation < 500ms

### Security Checklist
- [ ] Input Validation implementiert
- [ ] Error Messages sanitized
- [ ] Secure Headers gesetzt
- [ ] Authentication funktional

## Rollback Plan

### Wenn Migration fehlschlägt
1. **Sofortiger Rollback**: Zurück zur aktuellen Next.js Version
2. **Data Recovery**: Backup der migrierten Daten wiederherstellen
3. **Investigation**: Root Cause Analysis der Fehlschläge
4. **Re-Planning**: Überarbeitung des Migrationsplans

### Backup Strategy
- [ ] Vollständige Datenbank-Backups vor Migration
- [ ] Git Branches für Code-Rollback
- [ ] Azure Storage Snapshots
- [ ] Configuration Backups

---

**Gesamtaufwand**: 8-10 Arbeitstage  
**Kritischer Pfad**: Azure Setup → Storage Integration → Task Migration → Frontend  
**Risiko-Faktoren**: Azure Storage Latency, Markdown Parsing Komplexität, Frontend Migration

**Empfehlung**: Einen Tag Buffer für unvorhergesehene Probleme einplanen.