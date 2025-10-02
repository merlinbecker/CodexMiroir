# Rabbit R1 Support

Diese Anwendung wurde um Unterstützung für das Rabbit R1-Gerät erweitert.

## Features

### 1. Automatisches Laden der Timeline
Die Timeline für die nächsten 7 Tage wird automatisch beim Start geladen - kein manueller Button-Klick erforderlich.

### 2. Invertierte Scroll-Navigation
- **Scroll hoch** (Rad nach oben): Timeline scrollt **nach unten**
- **Scroll runter** (Rad nach unten): Timeline scrollt **nach oben**

Diese invertierte Steuerung wurde speziell für das Rabbit R1 entwickelt, um eine intuitive Navigation zu ermöglichen.

### 3. Spracherkennung für neue Tasks (Long Press)
Lange Tastendruck auf die Seitentaste (oder 'R'-Taste auf der Tastatur) aktiviert die Spracherkennung.

#### Funktionsweise:
1. Taste lange drücken (800ms)
2. Visuelles Feedback: "🎤 Spracherkennung aktiviert - Sprechen Sie jetzt..."
3. PostMessage wird an das Parent-Window gesendet mit:
   - `type: 'VOICE_TRANSCRIPTION_REQUEST'`
   - Vorbereiteter Prompt für den AI-Agenten
   - User-ID

#### AI-Prompt Format:
Der Agent erhält folgenden Prompt:
```
Du bist ein Planner für Meetings und Tasks. Transkribiere die nächsten Sätze 
und finde heraus, welche Art von Task ich anlegen will.

Gib mir ein JSON-Objekt zurück in dieser Form (es muss nicht vollständig sein):
{
  "kind": "work" | "personal" | "meeting",
  "title": "Kurzer Titel des Tasks",
  "description": "Detaillierte Beschreibung",
  "deadline": "YYYY-MM-DD" (optional),
  "fixed": false,
  "priority": 3,
  "tags": ["tag1", "tag2"] (optional),
  "project": { "id": "proj_id", "name": "Project Name" } (optional),
  "contact": { "name": "Name", "email": "email@example.com" } (optional)
}
```

#### Beispiele für Sprachbefehle:
- **"Meeting mit Marina am Freitag um 14 Uhr"**
  → `{"kind": "meeting", "title": "Meeting mit Marina", "fixed": true, "fixedDateTime": "2025-01-XX 14:00", "contact": {"name": "Marina"}}`

- **"CodexMiroir Sprint fertigstellen bis Ende der Woche"**
  → `{"kind": "work", "title": "CodexMiroir Sprint fertigstellen", "deadline": "2025-01-XX", "project": {"name": "CodexMiroir"}}`

- **"Einkaufen gehen"**
  → `{"kind": "personal", "title": "Einkaufen gehen"}`

## Implementierungsdetails

### Code-Änderungen:
- **`public/app.js`**: 
  - `init()`: Automatisches Laden und Initialisierung der Rabbit R1-Steuerung
  - `setupRabbitR1Controls()`: Scroll-Listener und Long-Press-Erkennung
  - `triggerVoiceTranscription()`: PostMessage-Handler für Spracherkennung

- **`public/index.html`**: 
  - Entfernt: Manueller "Timeline laden"-Button
  - Hinzugefügt: Rabbit R1 Steuerungsinformationen

## Testing

### Manuelle Tests:
1. **Auto-Load**: Seite öffnen → Timeline wird automatisch geladen
2. **Scroll-Navigation**: Mit Mausrad scrollen und invertierte Bewegung beobachten
3. **Voice Transcription**: 'R'-Taste lange drücken → Konsole zeigt Aktivierung

### Browser Console:
Bei Aktivierung der Spracherkennung:
```
Rabbit R1: Voice transcription mode activated
Prompt: [Der vollständige Prompt wird angezeigt]
```

## Kompatibilität
- Funktioniert in allen modernen Browsern
- 'R'-Taste als Proxy für die Rabbit R1 Seitentaste in Desktop-Browsern
- PostMessage-API für Kommunikation mit dem Rabbit R1-System
