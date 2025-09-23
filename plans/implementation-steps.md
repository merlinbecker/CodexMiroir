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

# Minimale Dependencies + Voice Support
npm install @azure/storage-blob gray-matter axios
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

### Schritt 1.3: Voice-Enhanced Function Implementation (4-5 Stunden)
**Erweitere die minimale index.js aus concept_new.md mit Voice-Funktionalität**

```javascript
// Erweiterte index.js mit Voice Features
const { BlobServiceClient } = require("@azure/storage-blob");
const matter = require("gray-matter");
const axios = require("axios"); // NEU für OpenAI Integration

// Existing code from concept_new.md +
// NEW Voice Functions:

// Voice Command Processing
async function processCommand(body) {
  const { text, list } = body;
  
  const prompt = `
Du bist ein deutscher Task-Management-Assistent für "Codex Miroir".
Analysiere diesen Sprachbefehl: "${text}"
Modus: ${list} (pro = beruflich, priv = privat)

Verfügbare Aktionen:
- create_task: Neue Aufgabe erstellen
- complete_task: Aktuelle Aufgabe abschließen  
- push_to_end: Aufgabe ans Ende verschieben
- get_status: Status abfragen

Antworte in JSON mit intent, parameters und response.
`;

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  const result = JSON.parse(response.data.choices[0].message.content);
  
  // Execute recognized action
  if (result.intent === 'create_task' && result.parameters.title) {
    await createTask({
      list,
      id: generateTaskId(),
      title: result.parameters.title,
      created_at_iso: new Date().toISOString(),
      scheduled_slot: getNextSlot(list),
      category: result.parameters.category || (list === 'pro' ? 'programmierung' : 'projekt')
    });
    result.executed = true;
  }
  
  return result;
}

// Task Decomposition
async function decomposeTask(body) {
  // AI-powered task breakdown into 3.5h chunks
}

// Voice-optimized Current Task
async function getCurrentTask(query) {
  // Returns task info optimized for voice response
}

// Updated Main Function with new voice actions
module.exports = async function (context, req) {
  // ... existing actions from concept_new.md
  
  // NEW Voice actions
  if (req.method === "POST" && action === "processcommand") {
    return context.res = { status: 200, jsonBody: await processCommand(req.body || {}) };
  }
  if (req.method === "POST" && action === "decomposetask") {
    return context.res = { status: 200, jsonBody: await decomposeTask(req.body || {}) };
  }
  if (req.method === "GET" && action === "getcurrenttask") {
    return context.res = { status: 200, jsonBody: await getCurrentTask(req.query) };
  }
};
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

### Schritt 2.2: Voice-Enhanced Frontend Integration (3-4 Stunden)
**Erweiterte React App mit Voice-First Interface**

```javascript
// Voice-Enhanced API Service Klasse
class VoiceCodexAPI {
  constructor() {
    this.baseURL = 'https://codex-miroir-fn.azurewebsites.net/api/codex';
    this.apiKey = process.env.REACT_APP_API_KEY;
  }

  // Existing task operations
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
        category: taskData.category,
        deadline_iso: taskData.deadline
      })
    });
    return response.json();
  }

  // NEW: Voice command processing
  async processVoiceCommand(text, list) {
    const response = await fetch(`${this.baseURL}?action=processCommand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({ text, list })
    });
    return response.json();
  }

  // NEW: Task decomposition
  async decomposeTask(title, description, list) {
    const response = await fetch(`${this.baseURL}?action=decomposeTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({ title, description, list })
    });
    return response.json();
  }

  // NEW: Voice-optimized current task
  async getCurrentTaskVoice(list) {
    const response = await fetch(`${this.baseURL}?action=getCurrentTask&list=${list}`, {
      headers: { 'x-api-key': this.apiKey }
    });
    return response.json();
  }

  generateTaskId() {
    return 'T-' + Date.now().toString(36).toUpperCase();
  }
}
```

### Schritt 2.3: Voice-First UI Components (2-3 Stunden)
**Vereinfachte React Komponenten mit Voice-Fokus**

```jsx
// Voice-Enhanced TaskInput Component
function VoiceTaskInput({ currentMode, onTaskUpdate, isLoading }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  
  const api = new VoiceCodexAPI();
  const recognition = useRef(null);

  useEffect(() => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window) {
      recognition.current = new webkitSpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'de-DE';
      
      recognition.current.onresult = (event) => {
        const result = event.results[0][0].transcript;
        setTranscript(result);
        handleVoiceCommand(result);
      };
      
      recognition.current.onend = () => setIsListening(false);
      recognition.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }
  }, []);

  const startListening = () => {
    if (recognition.current && !isProcessing) {
      setIsListening(true);
      setTranscript('');
      setLastResponse('');
      recognition.current.start();
    }
  };

  const stopListening = () => {
    if (recognition.current) {
      recognition.current.stop();
    }
  };

  const handleVoiceCommand = async (text) => {
    setIsProcessing(true);
    try {
      const result = await api.processVoiceCommand(
        text, 
        currentMode === 'professional' ? 'pro' : 'priv'
      );
      
      setLastResponse(result.response);
      
      if (result.executed) {
        onTaskUpdate(); // Trigger UI refresh
      }
      
      // Speak response back to user
      if ('speechSynthesis' in window && result.response) {
        const utterance = new SpeechSynthesisUtterance(result.response);
        utterance.lang = 'de-DE';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
      }
      
    } catch (error) {
      const errorMsg = 'Entschuldigung, ich konnte den Befehl nicht verarbeiten.';
      setLastResponse(errorMsg);
      
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(errorMsg);
        utterance.lang = 'de-DE';
        speechSynthesis.speak(utterance);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const list = currentMode === 'professional' ? 'pro' : 'priv';
  const isBlocked = isLoading || isProcessing;

  return (
    <div className="voice-input-container p-6 border-t border-border bg-gradient-to-t from-card to-background">
      {/* Main Voice Button */}
      <div className="text-center space-y-4">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isBlocked}
          className={`w-24 h-24 rounded-full transition-all duration-300 ${
            isListening 
              ? 'bg-red-500 text-white animate-pulse scale-110 shadow-lg shadow-red-500/50' 
              : isProcessing
              ? 'bg-amber-500 text-white animate-bounce'
              : 'bg-primary text-primary-foreground hover:scale-105 shadow-lg'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isListening ? (
            <MicOff className="w-10 h-10 mx-auto" />
          ) : isProcessing ? (
            <Loader className="w-10 h-10 mx-auto animate-spin" />
          ) : (
            <Mic className="w-10 h-10 mx-auto" />
          )}
        </button>
        
        {/* Status Text */}
        <div className="text-base font-medium">
          {isListening && (
            <span className="text-red-500 animate-pulse">🎤 Ich höre...</span>
          )}
          {isProcessing && (
            <span className="text-amber-500">⚙️ Verarbeite Befehl...</span>
          )}
          {!isListening && !isProcessing && (
            <span className="text-muted-foreground">
              Taste drücken und sprechen
            </span>
          )}
        </div>
      </div>
      
      {/* Transcript Display */}
      {transcript && (
        <div className="mt-4 p-3 bg-accent rounded-lg border">
          <div className="text-sm font-medium text-accent-foreground">
            💬 Gehört:
          </div>
          <div className="text-accent-foreground/80 italic">
            "{transcript}"
          </div>
        </div>
      )}
      
      {/* Response Display */}
      {lastResponse && (
        <div className="mt-3 p-3 bg-secondary rounded-lg border">
          <div className="text-sm font-medium text-secondary-foreground">
            🤖 Antwort:
          </div>
          <div className="text-secondary-foreground/80">
            {lastResponse}
          </div>
        </div>
      )}
      
      {/* Voice Commands Help */}
      <details className="mt-4">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          💡 Verfügbare Sprachbefehle anzeigen
        </summary>
        <div className="mt-2 text-xs text-muted-foreground space-y-1">
          <div><strong>Aufgaben:</strong> "Erstelle Aufgabe: [Titel]"</div>
          <div><strong>Abschließen:</strong> "Aufgabe erledigt"</div>
          <div><strong>Verschieben:</strong> "Ans Ende verschieben"</div>
          <div><strong>Status:</strong> "Wie ist der Status?"</div>
          <div><strong>Modus:</strong> "Wechsle zu privat/beruflich"</div>
        </div>
      </details>
      
      {/* Manual Input Fallback */}
      <div className="mt-4 text-center">
        <button
          onClick={() => setShowManualInput(!showManualInput)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          ⌨️ Manuelle Eingabe {showManualInput ? 'ausblenden' : 'anzeigen'}
        </button>
      </div>
      
      {showManualInput && (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            placeholder="Text-Befehl eingeben..."
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleVoiceCommand(e.target.value);
                e.target.value = '';
              }
            }}
          />
          <div className="text-xs text-muted-foreground">
            Enter drücken zum Ausführen
          </div>
        </div>
      )}
      
      {/* Mode Indicator */}
      <div className="mt-4 text-center">
        <span className="inline-flex items-center text-sm text-muted-foreground">
          {currentMode === 'professional' ? (
            <>
              <Moon className="w-4 h-4 mr-2" />
              Beruflicher Modus
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 mr-2" />
              Privater Modus
            </>
          )}
        </span>
      </div>
    </div>
  );
}
```
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

**Geschätzter Gesamtaufwand**: 12-18 Stunden  
**Dauer**: 2-3 Arbeitstage (erweitert für Voice Features)  
**Komplexitätsreduktion**: 70% weniger Code als ursprünglich geplant

**Kritischer Erfolgsfaktor**: Voice-First Interface macht das System hands-free nutzbar und steigert die Produktivität erheblich. Die minimalistische Architektur bleibt bestehen, wird aber um intelligente Sprachverarbeitung erweitert.

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