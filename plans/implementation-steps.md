# Vereinfachte Implementierungsschritte - "Codex Miroir"

## Übersicht
Dieser Plan beschreibt die **drastisch vereinfachten** Implementierungsschritte basierend auf dem neuen minimalistischen Konzept. Statt 8-10 Arbeitstagen sind jetzt nur noch **2-3 Arbeitstage** erforderlich.

## Voraussetzungen

### Azure Setup
- [ ] Azure Account mit aktiver Subscription
- [ ] Azure CLI installiert und konfiguriert
- [ ] Azure Functions Core Tools v4 installiert
- [ ] Storage Account erstellt

### Development Environment
- [ ] Node.js 18+ installiert
- [ ] Git Repository geklont
- [ ] Visual Studio Code (optional)
- [ ] Postman für API Tests (optional)

## Tag 1: Minimale Azure Function (4-6 Stunden)

### Schritt 1.1: Functions Projekt erstellen (30 Min)
```bash
# Neues Verzeichnis
mkdir codex-miroir-fn
cd codex-miroir-fn

# Functions Projekt initialisieren (JavaScript, v4)
func init . --javascript --model v4

# Minimale Dependencies
npm install @azure/storage-blob gray-matter
```

### Schritt 1.2: Function Configuration (15 Min)
```json
// function.json
{
  "bindings": [
    { 
      "authLevel": "function", 
      "type": "httpTrigger", 
      "direction": "in", 
      "name": "req", 
      "methods": ["get","post"], 
      "route": "codex" 
    },
    { 
      "type": "http", 
      "direction": "out", 
      "name": "res" 
    }
  ]
}
```

```json
// host.json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "routePrefix": ""
    }
  },
  "functionTimeout": "00:02:00"
}
```

### Schritt 1.3: Komplette Function Implementation (3-4 Stunden)
**Direkt die vollständige index.js aus concept_new.md übernehmen**

```javascript
// index.js (vollständige Implementierung wie im Konzept)
const { BlobServiceClient } = require("@azure/storage-blob");
const matter = require("gray-matter");

// Alle Helper Functions und Actions wie in concept_new.md
```

### Schritt 1.4: Local Testing (30 Min)
```bash
# Environment Variables setzen
export AZURE_BLOB_CONN="DefaultEndpointsProtocol=https;AccountName=..."
export API_KEY="test-api-key-123"

# Function starten
func start

# Test API Call
curl -H "x-api-key: test-api-key-123" \
     -H "Content-Type: application/json" \
     -d '{
       "list":"pro",
       "id":"T-001",
       "title":"Test Task",
       "created_at_iso":"2025-01-20T10:00:00",
       "scheduled_slot":"2025-W03-Mon-AM",
       "category":"programmierung"
     }' \
     http://localhost:7071/api/codex?action=createTask
```

## Tag 2: Deployment & Frontend Anpassung (4-6 Stunden)

### Schritt 2.1: Azure Deployment (1 Stunde)
```bash
# Function App erstellen
az functionapp create \
  --resource-group myResourceGroup \
  --consumption-plan-location westeurope \
  --runtime node \
  --functions-version 4 \
  --name codex-miroir-fn

# App Settings
az functionapp config appsettings set \
  --name codex-miroir-fn \
  --resource-group myResourceGroup \
  --settings "AZURE_BLOB_CONN=..." "API_KEY=your-secure-key"

# Deploy
func azure functionapp publish codex-miroir-fn
```

### Schritt 2.2: Frontend API Integration (2-3 Stunden)
**Anpassung der bestehenden React App**

```javascript
// Neue API Service Klasse
class CodexAPI {
  constructor() {
    this.baseURL = 'https://codex-miroir-fn.azurewebsites.net/api/codex';
    this.apiKey = process.env.REACT_APP_API_KEY;
  }

  async createTask(list, taskData) {
    const response = await fetch(`${this.baseURL}?action=createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        list,
        id: this.generateTaskId(),
        title: taskData.title,
        created_at_iso: new Date().toISOString(),
        scheduled_slot: this.getNextSlot(list),
        category: taskData.category
      })
    });
    return response.json();
  }

  async completeCurrentTask(list) {
    const currentTask = await this.getCurrentTask(list);
    if (!currentTask) return null;

    return fetch(`${this.baseURL}?action=completeTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        list,
        taskPathAbs: currentTask.path,
        closed_at_iso: new Date().toISOString()
      })
    });
  }

  generateTaskId() {
    return 'T-' + Date.now().toString(36).toUpperCase();
  }
}
```

### Schritt 2.3: UI Vereinfachung (1-2 Stunden)
**Anpassung der React Komponenten**

```jsx
// Vereinfachte CurrentTask Komponente
function CurrentTask({ list }) {
  const [currentTask, setCurrentTask] = useState(null);
  const api = new CodexAPI();

  useEffect(() => {
    loadCurrentTask();
  }, [list]);

  const loadCurrentTask = async () => {
    // Lade aktuellen Task aus current.md
    const tasks = await api.getCurrentTasks(list);
    setCurrentTask(tasks[0] || null);
  };

  const completeTask = async () => {
    await api.completeCurrentTask(list);
    loadCurrentTask(); // Reload
  };

  if (!currentTask) {
    return <div className="no-task">Keine aktiven Tasks</div>;
  }

  return (
    <div className="current-task">
      <h2>{currentTask.title}</h2>
      <p>Kategorie: {currentTask.category}</p>
      {currentTask.deadline && (
        <p>Deadline: {currentTask.deadline}</p>
      )}
      <button onClick={completeTask} className="complete-btn">
        Task abschließen
      </button>
    </div>
  );
}
```

### Schritt 2.4: Slot-System Integration (1 Stunde)
```javascript
// Slot-Berechnung für Kalender
class SlotCalculator {
  getCurrentWeek() {
    const now = new Date();
    const year = now.getFullYear();
    const week = this.getWeekNumber(now);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  getNextAvailableSlot(list) {
    const week = this.getCurrentWeek();
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday
    
    if (list === 'pro') {
      // Business: Mo-Fr, 2 Slots
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek];
        const hour = today.getHours();
        
        if (hour < 9) return `${week}-${dayName}-AM`;
        if (hour < 13) return `${week}-${dayName}-PM`;
        
        // Nächster Tag
        const nextDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek + 1] || 'Mon';
        return `${week}-${nextDay}-AM`;
      }
    } else {
      // Private: Mo-Fr Abend, Sa-So 2 Slots
      // Implementation...
    }
  }
}
```

## Tag 3: Testing & Finalisierung (2-4 Stunden)

### Schritt 3.1: Integration Tests (1-2 Stunden)
```javascript
// Einfache Test Suite
const tests = [
  {
    name: 'Create Pro Task',
    action: 'createTask',
    data: {
      list: 'pro',
      id: 'T-TEST-001',
      title: 'Test Programmierung',
      created_at_iso: '2025-01-20T10:00:00',
      scheduled_slot: '2025-W03-Mon-AM',
      category: 'programmierung'
    }
  },
  {
    name: 'Complete Task',
    action: 'completeTask',
    data: {
      list: 'pro',
      taskPathAbs: '/codex-miroir/pro/tasks/2025/2025-01-20--T-TEST-001-test-programmierung.md',
      closed_at_iso: '2025-01-20T13:30:00'
    }
  }
];

// Test Runner
async function runTests() {
  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    const result = await callAPI(test.action, test.data);
    console.log(result.ok ? '✅ PASS' : '❌ FAIL');
  }
}
```

### Schritt 3.2: Storage Validation (30 Min)
```bash
# Check Blob Storage Structure
az storage blob list \
  --account-name your-storage \
  --container-name codex-miroir \
  --output table

# Should show:
# pro/current.md
# pro/archive.md  
# pro/tasks/2025/2025-01-20--T-TEST-001-test-programmierung.md
```

### Schritt 3.3: Frontend Testing (1 Stunde)
- [ ] Task Creation funktional
- [ ] Task Completion funktional
- [ ] Mode Switch (Pro/Priv) funktional
- [ ] FIFO-Reihenfolge korrekt
- [ ] European Date Format durchgängig

### Schritt 3.4: Performance Validation (30 Min)
```bash
# API Performance Test
time curl -H "x-api-key: $API_KEY" \
          "$FUNCTION_URL/api/codex?action=report&list=pro&week=2025-W03"

# Target: < 500ms Response Time
```

## Deployment Checklist

### Azure Configuration
- [ ] Function App deployed und funktional
- [ ] Storage Account mit "codex-miroir" Container
- [ ] API Key als App Setting konfiguriert
- [ ] CORS für Frontend Domain aktiviert

### Frontend Configuration  
- [ ] API_KEY als Environment Variable
- [ ] FUNCTION_URL konfiguriert
- [ ] Build und Deployment erfolgreich

### Functional Validation
- [ ] Task Creation: Pro + Priv
- [ ] Task Completion funktional
- [ ] Push to End funktional
- [ ] Report Generation funktional
- [ ] "When" Query funktional

## Rollback Plan

### Bei Problemen
1. **Sofortiger Rollback**: Zurück zur aktuellen Version
2. **API Fallback**: Temporäre Weiterleitung auf alte API
3. **Data Backup**: Blob Storage Snapshots erstellen
4. **Incident Analysis**: Logs und Metriken auswerten

## Success Metrics

### Performance
- ✅ API Response < 500ms
- ✅ Frontend Load < 2 Sekunden  
- ✅ Task Creation < 1 Sekunde

### Functionality
- ✅ Alle 5 API Actions funktional
- ✅ Markdown Tables korrekt formatiert
- ✅ European Date Format durchgängig
- ✅ FIFO-Prinzip durchgesetzt

### Simplicity
- ✅ Nur 1 Azure Function
- ✅ Nur 2 NPM Dependencies
- ✅ Wartbare Codebasis < 400 Zeilen
- ✅ Minimaler Configuration Overhead

---

**Geschätzter Gesamtaufwand**: 10-16 Stunden  
**Dauer**: 2-3 Arbeitstage  
**Komplexitätsreduktion**: 80% weniger Aufwand als ursprünglich geplant

**Kritischer Erfolgsfaktor**: Das neue Konzept ist so viel einfacher, dass die meiste Zeit für Testing und Polishing verwendet werden kann statt für komplexe Architektur-Implementierung.

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