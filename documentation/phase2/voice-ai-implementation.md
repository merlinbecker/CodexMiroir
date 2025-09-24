# Phase 2: Voice Command Processing and AI Integration

## Overview

Phase 2 enhances the Azure Functions foundation with voice-first functionality and AI-powered task management capabilities.

## Implementation Status

✅ **Completed:**
- Voice command processing with OpenAI integration
- Fallback command processing for offline scenarios
- AI-powered task decomposition
- Voice-optimized current task endpoint
- German language support throughout

## New Features

### 1. Voice Command Processing (`processCommand`)

Processes natural language commands and executes appropriate actions.

**Endpoint:** `POST /api/codex?action=processCommand`

**Request:**
```json
{
  "text": "Erstelle eine neue Aufgabe: Meeting vorbereiten",
  "list": "pro"
}
```

**Response:**
```json
{
  "intent": "create_task",
  "parameters": {
    "title": "Meeting vorbereiten",
    "category": "meeting"
  },
  "response": "Ich erstelle die Aufgabe 'Meeting vorbereiten' für dich.",
  "confidence": 0.95,
  "executed": true,
  "taskId": "T-001234567"
}
```

#### Supported Voice Commands:
- **"Erstelle Aufgabe: [Titel]"** → Creates new task
- **"Aktuelle Aufgabe abschließen"** → Completes current task
- **"Aufgabe verschieben"** → Pushes task to end
- **"Status anzeigen"** → Shows current status

#### AI Processing with Fallback:
1. **Primary:** OpenAI GPT-4 for intelligent command parsing
2. **Fallback:** Pattern matching for basic commands when AI is unavailable

### 2. AI Task Decomposition (`decomposeTask`)

Breaks down large tasks into 3.5-hour chunks using AI.

**Endpoint:** `POST /api/codex?action=decomposeTask`

**Request:**
```json
{
  "list": "pro",
  "title": "Neue Website entwickeln",
  "description": "Komplette Neuentwicklung der Firmenwebsite",
  "estimated_hours": 14
}
```

**Response:**
```json
{
  "subtasks": [
    {
      "title": "Konzept und Wireframes erstellen",
      "estimated_hours": 3.5,
      "order": 1
    },
    {
      "title": "Design und Mockups entwickeln", 
      "estimated_hours": 3.5,
      "order": 2
    },
    {
      "title": "Frontend-Entwicklung umsetzen",
      "estimated_hours": 3.5,
      "order": 3
    },
    {
      "title": "Testing und Optimierung",
      "estimated_hours": 3.5,
      "order": 4
    }
  ],
  "total_slots": 4,
  "notes": "Empfehlung: Zwischen Design und Entwicklung Feedback einholen"
}
```

### 3. Voice-Optimized Current Task (`getCurrentTask`)

Returns current task information optimized for voice responses.

**Endpoint:** `GET /api/codex?action=getCurrentTask`

**Request:**
```json
{
  "list": "pro"
}
```

**Response:**
```json
{
  "hasTask": true,
  "currentTask": {
    "slot": "2025-W39-Tue-AM",
    "task": "T-001: API Specification",
    "category": "programmierung",
    "deadline": "30.09.2025"
  },
  "taskDetails": {
    "id": "T-001",
    "title": "API Specification",
    "status": "geplant",
    "project": "CodexMiroir"
  },
  "message": "Aktuelle Aufgabe: T-001: API Specification",
  "voiceResponse": "Deine aktuelle berufliche Aufgabe ist: T-001: API Specification. Geplant für 2025-W39-Tue-AM, Deadline 30.09.2025. Kategorie: programmierung.",
  "slot": "2025-W39-Tue-AM",
  "deadline": "30.09.2025"
}
```

## Technical Implementation

### AI Integration

#### OpenAI Configuration
- **Model:** GPT-4 for best accuracy
- **Temperature:** 0.3 for consistent responses
- **Language:** German prompts and responses
- **Fallback:** Pattern matching when AI unavailable

#### Error Handling
- Graceful degradation to pattern matching
- Detailed error logging
- User-friendly fallback responses

### German Language Support

All voice interactions are in German:
- Command recognition in German
- Response generation in German
- Category names in German
- Error messages in German

### Voice Command Patterns

#### Create Task Commands:
- "Erstelle Aufgabe: [Titel]"
- "Neue Aufgabe: [Titel]"
- "Task erstellen: [Titel]"

#### Complete Task Commands:
- "Aufgabe abschließen"
- "Task fertig"
- "Aktuelle Aufgabe beenden"

#### Status Commands:
- "Status anzeigen"
- "Was steht an?"
- "Aktuelle Aufgaben"

#### Reschedule Commands:
- "Aufgabe verschieben"
- "Task ans Ende"
- "Später bearbeiten"

## Environment Variables

Additional environment variable required for Phase 2:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Note:** The system works without OpenAI API key using fallback pattern matching.

## Usage Examples

### Voice Command Processing

```bash
# Process voice command
curl -X POST "https://codex-miroir-fn.azurewebsites.net/api/codex?action=processCommand" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Erstelle eine neue Aufgabe: Sprint Planning Meeting vorbereiten",
    "list": "pro"
  }'
```

### Task Decomposition

```bash
# Decompose large task
curl -X POST "https://codex-miroir-fn.azurewebsites.net/api/codex?action=decomposeTask" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "list": "pro",
    "title": "Microservice Architektur implementieren",
    "description": "Bestehende Monolith-Anwendung in Microservices aufteilen",
    "estimated_hours": 21
  }'
```

### Get Current Task for Voice

```bash
# Get current task optimized for voice
curl -X GET "https://codex-miroir-fn.azurewebsites.net/api/codex?action=getCurrentTask" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"list": "pro"}'
```

## Integration with Frontend

### Web Speech API Integration

The enhanced endpoints are designed to work with Web Speech API:

```javascript
// Voice input processing
const recognition = new webkitSpeechRecognition();
recognition.lang = 'de-DE';
recognition.onresult = async (event) => {
  const text = event.results[0][0].transcript;
  const response = await processVoiceCommand(text, currentList);
  speakResponse(response.voiceResponse);
};

// Voice output
function speakResponse(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  speechSynthesis.speak(utterance);
}
```

### API Service Layer

```javascript
class VoiceCodexAPI {
  async processVoiceCommand(text, list) {
    return await fetch(`${this.baseURL}?action=processCommand`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ text, list })
    }).then(r => r.json());
  }

  async getCurrentTaskForVoice(list) {
    return await fetch(`${this.baseURL}?action=getCurrentTask`, {
      method: 'GET', 
      headers: this.headers,
      body: JSON.stringify({ list })
    }).then(r => r.json());
  }

  async decomposeTask(taskData) {
    return await fetch(`${this.baseURL}?action=decomposeTask`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(taskData)
    }).then(r => r.json());
  }
}
```

## Performance Considerations

### AI Response Times
- **Target:** < 2 seconds for voice commands
- **Fallback:** < 200ms for pattern matching
- **OpenAI calls:** Async with timeout handling

### Caching Strategy
- Cache common command patterns
- Cache AI responses for similar inputs
- Implement rate limiting for AI calls

### Cost Optimization
- Use GPT-4 only for complex commands
- Fallback to pattern matching for simple commands
- Monitor OpenAI usage and costs

## Testing Voice Features

### Test Voice Commands

```bash
# Test German voice commands
commands=(
  "Erstelle Aufgabe: Code Review für Feature X"
  "Aktuelle Aufgabe abschließen"
  "Aufgabe ans Ende verschieben"
  "Status anzeigen"
  "Was steht heute an?"
)

for cmd in "${commands[@]}"; do
  echo "Testing: $cmd"
  curl -X POST "https://codex-miroir-fn.azurewebsites.net/api/codex?action=processCommand" \
    -H "x-api-key: YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$cmd\", \"list\": \"pro\"}"
  echo -e "\n---\n"
done
```

## Next Steps

Phase 2 provides the foundation for:
- [ ] Frontend voice interface implementation
- [ ] Web Speech API integration
- [ ] Voice-first user experience
- [ ] Mobile PWA voice capabilities
- [ ] Advanced AI features (scheduling optimization, workload analysis)

## Error Handling

### AI Service Failures
- Automatic fallback to pattern matching
- User notification of degraded functionality
- Detailed logging for debugging

### Voice Recognition Errors
- Confidence scoring for recognition accuracy
- Retry mechanisms for unclear commands
- Manual input fallback options

## Security Considerations

### API Key Management
- OpenAI API key stored as environment variable
- Rate limiting for AI calls
- Cost monitoring and alerts

### Voice Data Privacy
- No persistent storage of voice data
- Immediate processing and deletion
- GDPR compliance considerations