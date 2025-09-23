# Voice-Enhanced Codex Miroir Implementation

## Übersicht
Basierend auf dem neuen Feedback wird die minimalistische Azure Functions Architektur um **voice-first Funktionalität** erweitert, während die bestehende UI-Struktur vereinfacht und optimiert wird.

## Kernprinzipien

### 1. Voice-First Interface
- **Primäre Eingabe**: Sprache über Web Speech API und Azure Speech Services
- **Fallback**: Manuelle Texteingabe bleibt verfügbar
- **Fokus**: Hands-free Task Management für maximale Produktivität

### 2. Beibehaltung bewährter UI-Elemente
- **Mode Switch**: Beruflich (Dark) ↔ Privat (Light) bleibt bestehen
- **FIFO-Anzeige**: Aktueller Task prominent, Warteschlange darunter
- **Vereinfachung**: Weniger visuelle Ablenkungen, mehr Fokus auf Voice

### 3. Erweiterte Azure Functions API

#### Bestehende Endpoints (aus concept_new.md)
```javascript
POST /api/codex?action=createTask
POST /api/codex?action=completeTask  
POST /api/codex?action=pushToEnd
GET  /api/codex?action=report
GET  /api/codex?action=when
```

#### Neue Voice-Endpoints
```javascript
POST /api/codex?action=transcribe       // Speech-to-Text
POST /api/codex?action=processCommand   // Text Command Processing  
POST /api/codex?action=decomposeTask    // AI Task Decomposition
GET  /api/codex?action=getCurrentTask   // Optimiert für Voice Response
```

## Voice-Enhanced Azure Function

### Extended index.js Structure
```javascript
const { BlobServiceClient } = require("@azure/storage-blob");
const matter = require("gray-matter");
const axios = require("axios"); // For OpenAI API calls

// Existing functions from concept_new.md
// + New voice-specific functions

// Speech Transcription (Azure Cognitive Services or OpenAI Whisper)
async function transcribeAudio(body) {
  const { audioData, list } = body;
  
  try {
    // Option 1: Azure Speech Services
    if (process.env.AZURE_SPEECH_KEY) {
      const response = await axios.post(
        `https://${process.env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
        audioData,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
            'Content-Type': 'audio/wav',
          },
          params: {
            language: 'de-DE',
            format: 'simple'
          }
        }
      );
      return { transcript: response.data.DisplayText, confidence: response.data.Confidence };
    }
    
    // Option 2: OpenAI Whisper (Fallback)
    const formData = new FormData();
    formData.append('file', audioData);
    formData.append('model', 'whisper-1');
    formData.append('language', 'de');
    
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return { transcript: response.data.text, confidence: 0.9 };
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
}

// Command Processing (Intent Recognition + Action)
async function processCommand(body) {
  const { text, list, context = {} } = body;
  
  const prompt = `
Du bist ein deutscher Task-Management-Assistent für das "Codex Miroir" System.
Analysiere diesen Sprachbefehl und erkenne die Absicht:

Text: "${text}"
Modus: ${list} (pro = beruflich, priv = privat)
Kontext: ${JSON.stringify(context)}

Verfügbare Aktionen:
1. create_task - Neue Aufgabe erstellen
2. complete_task - Aktuelle Aufgabe abschließen  
3. push_to_end - Aufgabe ans Ende verschieben
4. get_status - Status abfragen
5. decompose_task - Aufgabe in Teile zerlegen

Antworte in JSON:
{
  "intent": "action_name",
  "confidence": 0.0-1.0,
  "parameters": {
    "title": "...",
    "description": "...", 
    "category": "meeting|programmierung|haushalt|projekt",
    "deadline": "dd.mm.yyyy hh:mm" // optional
  },
  "response": "Bestätigungstext für Benutzer"
}
`;

  try {
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
    
    // Execute the recognized intent
    if (result.intent === 'create_task' && result.parameters.title) {
      const taskResult = await createTask({
        list,
        id: generateTaskId(),
        title: result.parameters.title,
        created_at_iso: new Date().toISOString(),
        scheduled_slot: getNextSlot(list),
        category: result.parameters.category || (list === 'pro' ? 'programmierung' : 'projekt'),
        deadline_iso: result.parameters.deadline ? parseGermanDate(result.parameters.deadline) : null
      });
      
      result.executed = true;
      result.task = taskResult;
    }
    
    return result;
  } catch (error) {
    return {
      intent: 'unknown',
      confidence: 0.0,
      error: error.message,
      response: 'Entschuldigung, ich konnte den Befehl nicht verstehen.'
    };
  }
}

// Task Decomposition (AI-powered)
async function decomposeTask(body) {
  const { title, description, list, estimatedHours = 3.5 } = body;
  
  const prompt = `
Zerlege diese Aufgabe in sinnvolle Teilaufgaben für das deutsche "Codex Miroir" System:

Titel: ${title}
Beschreibung: ${description}
Modus: ${list} (pro = beruflich, priv = privat)
Max. Zeit pro Teilaufgabe: ${estimatedHours} Stunden

Regeln:
- Jede Teilaufgabe maximal ${estimatedHours}h (1 Slot)
- Logische Reihenfolge beachten
- Deutsche Bezeichnungen
- Konkrete, umsetzbare Schritte

Antworte in JSON:
{
  "subtasks": [
    {
      "title": "Kurzer prägnanter Titel",
      "description": "Detaillierte Beschreibung",
      "estimatedMinutes": 210,
      "category": "meeting|programmierung|haushalt|projekt",
      "order": 1
    }
  ],
  "totalEstimatedHours": 7.0,
  "summary": "Zusammenfassung der Zerlegung"
}
`;

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    return {
      subtasks: [{
        title,
        description,
        estimatedMinutes: estimatedHours * 60,
        category: list === 'pro' ? 'programmierung' : 'projekt',
        order: 1
      }],
      totalEstimatedHours: estimatedHours,
      summary: `Aufgabe konnte nicht zerlegt werden: ${error.message}`
    };
  }
}

// Voice-optimized Current Task Getter
async function getCurrentTask(query) {
  const { list } = query;
  const currentMd = await readText(`/codex-miroir/${list}/current.md`);
  const currentWeek = getCurrentWeek();
  const weekSection = extractWeek(currentMd, currentWeek);
  
  if (!weekSection) {
    return {
      hasTask: false,
      response: `Keine Aufgaben für diese Woche in ${list === 'pro' ? 'beruflichem' : 'privatem'} Modus.`
    };
  }
  
  const rows = weekSection.split('\n').filter(l => l.startsWith('|') && !l.includes('---'));
  const currentTaskRow = rows[0];
  
  if (!currentTaskRow) {
    return {
      hasTask: false,
      response: `Keine aktuelle Aufgabe in ${list === 'pro' ? 'beruflichem' : 'privatem'} Modus.`
    };
  }
  
  const cols = currentTaskRow.split('|').map(s => s.trim());
  const slot = cols[1];
  const taskInfo = cols[2];
  const category = cols[3];
  const deadline = cols[4];
  
  // Extract task title from markdown link format
  const titleMatch = taskInfo.match(/\[([^\]]+)\]/);
  const title = titleMatch ? titleMatch[1] : taskInfo;
  
  return {
    hasTask: true,
    title,
    slot,
    category,
    deadline,
    response: `Aktuelle Aufgabe: ${title}. Kategorie: ${category}. ${deadline ? `Frist: ${deadline}.` : ''}`
  };
}

// Helper Functions
function generateTaskId() {
  return 'T-' + Date.now().toString(36).toUpperCase();
}

function getCurrentWeek() {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getNextSlot(list) {
  const now = new Date();
  const week = getCurrentWeek();
  const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday
  const hour = now.getHours();
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (list === 'pro') {
    // Business: Mo-Fr, AM/PM
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dayName = dayNames[dayOfWeek];
      if (hour < 9) return `${week}-${dayName}-AM`;
      if (hour < 13) return `${week}-${dayName}-PM`;
      
      // Next day
      const nextDayIndex = dayOfWeek === 5 ? 1 : dayOfWeek + 1; // Friday -> Monday
      return `${week}-${dayNames[nextDayIndex]}-AM`;
    }
    return `${week}-Mon-AM`; // Weekend -> Monday
  } else {
    // Private: Mo-Fr evening, Sa-So AM/PM
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const dayName = dayNames[dayOfWeek];
      if (hour < 18) return `${week}-${dayName}-EVE`;
      
      // Next day
      const nextDayIndex = dayOfWeek === 5 ? 6 : dayOfWeek + 1; // Friday -> Saturday
      return `${week}-${dayNames[nextDayIndex]}-AM`;
    }
    
    // Weekend
    const dayName = dayNames[dayOfWeek];
    if (hour < 9) return `${week}-${dayName}-AM`;
    if (hour < 13) return `${week}-${dayName}-PM`;
    
    // Next day
    const nextDayIndex = dayOfWeek === 6 ? 0 : 1; // Saturday -> Sunday, Sunday -> Monday
    return `${week}-${dayNames[nextDayIndex]}-${nextDayIndex === 1 ? 'EVE' : 'AM'}`;
  }
}

function parseGermanDate(germanDate) {
  // Convert "dd.mm.yyyy hh:mm" to ISO
  const match = germanDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  
  const [, day, month, year, hour = '09', minute = '00'] = match;
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

// Updated Main Function
module.exports = async function (context, req) {
  try {
    auth(req);
    const action = (req.query.action || "").toLowerCase();
    
    // Existing actions
    if (req.method === "POST" && action === "createtask") {
      return context.res = { status: 200, jsonBody: await createTask(req.body || {}) };
    }
    if (req.method === "POST" && action === "completetask") {
      return context.res = { status: 200, jsonBody: await completeTask(req.body || {}) };
    }
    if (req.method === "POST" && action === "pushtoend") {
      return context.res = { status: 200, jsonBody: await pushToEnd(req.body || {}) };
    }
    if (req.method === "GET" && action === "report") {
      return context.res = { status: 200, jsonBody: await report(req.query) };
    }
    if (req.method === "GET" && action === "when") {
      return context.res = { status: 200, jsonBody: await when(req.query) };
    }
    
    // New voice actions
    if (req.method === "POST" && action === "transcribe") {
      return context.res = { status: 200, jsonBody: await transcribeAudio(req.body || {}) };
    }
    if (req.method === "POST" && action === "processcommand") {
      return context.res = { status: 200, jsonBody: await processCommand(req.body || {}) };
    }
    if (req.method === "POST" && action === "decomposetask") {
      return context.res = { status: 200, jsonBody: await decomposeTask(req.body || {}) };
    }
    if (req.method === "GET" && action === "getcurrenttask") {
      return context.res = { status: 200, jsonBody: await getCurrentTask(req.query) };
    }
    
    context.res = { status: 400, body: "Unknown action" };
  } catch (e) {
    context.res = { status: e.code || 500, body: e.message };
  }
};
```

## Vereinfachtes Frontend (Voice-First)

### Updated package.json Dependencies
```json
{
  "dependencies": {
    "@azure/storage-blob": "^12.18.0",
    "gray-matter": "^4.0.3",
    "axios": "^1.6.0"
  }
}
```

### Voice-Enhanced UI Components

#### Simplified TaskInput Component
```javascript
// Voice-first input component
function VoiceTaskInput({ currentMode, onAddTask, isAddingTask }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  
  const recognition = useRef(null);
  
  useEffect(() => {
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
      
      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);
  
  const startListening = () => {
    if (recognition.current) {
      setIsListening(true);
      setTranscript('');
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
      const response = await fetch('/api/codex?action=processCommand', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY
        },
        body: JSON.stringify({
          text,
          list: currentMode === 'professional' ? 'pro' : 'priv'
        })
      });
      
      const result = await response.json();
      setLastResponse(result.response);
      
      if (result.executed && result.intent === 'create_task') {
        // Task was created, trigger UI refresh
        onAddTask();
      }
      
      // Text-to-Speech response
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(result.response);
        utterance.lang = 'de-DE';
        speechSynthesis.speak(utterance);
      }
      
    } catch (error) {
      setLastResponse('Fehler bei der Verarbeitung des Befehls.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="voice-input-section p-4 border-t border-border bg-card">
      <div className="text-center space-y-4">
        {/* Voice Button */}
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing || isAddingTask}
          className={`w-20 h-20 rounded-full transition-all ${
            isListening 
              ? 'bg-red-500 text-white animate-pulse scale-110' 
              : 'bg-primary text-primary-foreground hover:scale-105'
          } disabled:opacity-50`}
        >
          {isListening ? (
            <MicOff className="w-8 h-8 mx-auto" />
          ) : (
            <Mic className="w-8 h-8 mx-auto" />
          )}
        </button>
        
        {/* Status Text */}
        <div className="text-sm text-muted-foreground">
          {isListening && "Ich höre..."}
          {isProcessing && "Verarbeite Befehl..."}
          {!isListening && !isProcessing && "Taste drücken und sprechen"}
        </div>
        
        {/* Transcript */}
        {transcript && (
          <div className="p-2 bg-accent rounded text-sm">
            <strong>Gehört:</strong> {transcript}
          </div>
        )}
        
        {/* Response */}
        {lastResponse && (
          <div className="p-2 bg-secondary rounded text-sm">
            <strong>Antwort:</strong> {lastResponse}
          </div>
        )}
        
        {/* Mode Indicator */}
        <div className="text-xs text-muted-foreground">
          {currentMode === 'professional' ? (
            <>🌙 Beruflicher Modus</>
          ) : (
            <>☀️ Privater Modus</>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### Voice Commands Examples
```
Benutzer: "Erstelle eine neue Aufgabe: API Dokumentation schreiben"
System: ✅ "Aufgabe 'API Dokumentation schreiben' wurde für Dienstag Vormittag eingeplant."

Benutzer: "Aktuelle Aufgabe abschließen"  
System: ✅ "Aufgabe abgeschlossen. Nächste Aufgabe: Code Review Backend."

Benutzer: "Diese Aufgabe ans Ende verschieben"
System: ✅ "Aufgabe wurde ans Ende der Woche verschoben."

Benutzer: "Zeige mir den Status"
System: ℹ️ "Du hast 3 offene Aufgaben. Aktuelle: Meeting Vorbereitung, Kategorie: Meeting."
```

## Implementation Timeline

### Tag 1: Azure Function Extension (4 Stunden)
1. Extend existing index.js with voice functions
2. Add OpenAI API integration for command processing
3. Implement speech transcription endpoint
4. Test basic voice recognition

### Tag 2: Frontend Voice Integration (4 Stunden)  
1. Update TaskInput to VoiceTaskInput component
2. Integrate Web Speech API
3. Add speech synthesis for responses
4. Test voice command flow

### Tag 3: Testing & Polish (2 Stunden)
1. Test all voice commands
2. Optimize recognition accuracy
3. Add error handling
4. Deploy and validate

**Total: 10 Stunden (1.25 Arbeitstage)**

## Voice Command Patterns

### Task Creation
```
"Erstelle Aufgabe: [Titel]"
"Neue Aufgabe: [Titel] mit Frist [dd.mm.yyyy]"
"Programmier-Task: [Titel]"
"Meeting: [Titel] am [dd.mm.yyyy] um [hh:mm]"
```

### Task Management
```
"Aufgabe abschließen"
"Task erledigt"
"Ans Ende verschieben"
"Nicht bearbeitbar"
```

### Status Queries
```
"Wie ist der Status?"
"Was ist dran?"
"Zeige aktuelle Aufgabe"
"Wann bin ich mit [Task] dran?"
```

### Mode Switching
```
"Wechsle zu privat"
"Beruflicher Modus"
"Private Aufgaben"
```

---

**Fokus**: Voice-First Interface mit Fallback auf bewährte UI-Elemente  
**Architektur**: Erweitert die minimalistische Azure Functions Struktur  
**Ziel**: Hands-free Task Management für maximale Produktivitätssteigerung