# CodexMiroir API Documentation

## Base URL
```
https://your-function-app.azurewebsites.net/api/codex/{secure_token}
```

## Authentication
All requests require a secure token in the URL path:
- URL format: `/api/codex/{secure_token}?action=...`
- The secure token serves as both user identification and access control
- Minimum token length: 8 characters

## Token-based User Separation
Each token creates a separate user space with isolated markdown files:
- Path structure: `users/{token}/codex-miroir/{list}/`
- Example: `users/mySecureToken123/codex-miroir/pro/current.md`

## Endpoints

### Core Task Management

### 1. Create Task
**POST** `/api/codex/{secure_token}?action=createTask`

Creates a new task in the specified list (pro/priv) for the user identified by the secure token.

**Request Body:**
```json
{
  "list": "pro",                    // Required: "pro" or "priv"
  "id": "T-001",                   // Required: Unique task ID
  "title": "API Specification",    // Required: Task title
  "created_at_iso": "2025-09-23T10:00:00Z",  // Required: ISO timestamp
  "scheduled_slot": "2025-W39-Tue-AM",       // Required: Time slot
  "category": "programmierung",     // Optional: Task category
  "deadline_iso": "2025-09-30T16:00:00Z",   // Optional: Deadline
  "project": "CodexMiroir",        // Optional: Project name
  "azure_devops": "12345",         // Optional: Azure DevOps ID
  "requester": "John Doe",         // Optional: Requester name
  "duration_slots": 1              // Optional: Number of slots (default: 1)
}
```

**Response:**
```json
{
  "ok": true,
  "taskPath": "users/mySecureToken123/codex-miroir/pro/tasks/2025/2025-09-23--T-001-api-specification.md",
  "currentPath": "users/mySecureToken123/codex-miroir/pro/current.md"
}
```

### 2. Complete Task
**POST** `/api/codex/{secure_token}?action=completeTask`

Marks a task as completed and moves it to archive.

**Request Body:**
```json
{
  "list": "pro",                           // Required: "pro" or "priv"
  "taskPathAbs": "users/mySecureToken123/codex-miroir/pro/tasks/2025/2025-09-23--T-001-api-specification.md",
  "closed_at_iso": "2025-09-23T16:30:00Z"  // Required: Completion timestamp
}
```

**Response:**
```json
{
  "ok": true
}
```

### 3. Push to End
**POST** `/api/codex/{secure_token}?action=pushToEnd`

Reschedules a task to a later time slot.

**Request Body:**
```json
{
  "list": "pro",                           // Required: "pro" or "priv"
  "taskPathAbs": "users/mySecureToken123/codex-miroir/pro/tasks/2025/2025-09-23--T-001-api-specification.md",
  "new_scheduled_slot": "2025-W40-Wed-PM"  // Required: New time slot
}
```

**Response:**
```json
{
  "ok": true
}
```

### 4. Report Tasks
**GET** `/api/codex/{secure_token}?action=report`

Returns current tasks for the specified list.

**Request Body:**
```json
{
  "list": "pro"  // Required: "pro" or "priv"
}
```

**Response:**
```json
{
  "tasks": [
    {
      "slot": "2025-W39-Tue-AM",
      "task": "T-001: API Specification",
      "category": "programmierung",
      "deadline": "30.09.2025"
    }
  ],
  "total": 1
}
```

### 5. When Available
**GET** `/api/codex/{secure_token}?action=when`

Returns the next available time slot for new tasks.

**Request Body:**
```json
{
  "list": "pro"  // Required: "pro" or "priv"
}
```

**Response:**
```json
{
  "nextSlot": "2025-W39-Mon-AM",
  "message": "Nächster verfügbarer Slot: Montag Vormittag"
}
```

### Voice Command Processing

### 6. Process Voice Command
**POST** `/api/codex/{secure_token}?action=processCommand`

Processes natural language voice commands and executes appropriate actions.

**Request Body:**
```json
{
  "text": "Erstelle eine neue Aufgabe: Meeting vorbereiten",  // Required: Voice command text
  "list": "pro"                                          // Required: "pro" or "priv"
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
  "taskId": "T-001234567",
  "fallback": false
}
```

### 7. Decompose Task
**POST** `/api/codex/{secure_token}?action=decomposeTask`

Uses AI to break down large tasks into 3.5-hour chunks.

**Request Body:**
```json
{
  "list": "pro",                                         // Required: "pro" or "priv"
  "title": "Neue Website entwickeln",                    // Required: Task title
  "description": "Komplette Neuentwicklung der Website", // Optional: Task description
  "estimated_hours": 14                                  // Optional: Estimated total hours
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
    }
  ],
  "total_slots": 4,
  "notes": "Empfehlung: Zwischen Design und Entwicklung Feedback einholen",
  "fallback": false
}
```

### 8. Get Current Task (Voice-Optimized)
**GET** `/api/codex/{secure_token}?action=getCurrentTask`

Returns current task information optimized for voice responses.

**Request Body:**
```json
{
  "list": "pro"  // Required: "pro" or "priv"
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
    "status": "geplant"
  },
  "message": "Aktuelle Aufgabe: T-001: API Specification",
  "voiceResponse": "Deine aktuelle berufliche Aufgabe ist: T-001: API Specification. Geplant für 2025-W39-Tue-AM, Deadline 30.09.2025. Kategorie: programmierung.",
  "slot": "2025-W39-Tue-AM",
  "deadline": "30.09.2025"
}
```

## Time Slots

### Professional (pro)
- **Monday-Friday**: 2 slots per day
  - Morning (AM): 09:00-12:30
  - Afternoon (PM): 13:30-17:00

### Private (priv)
- **Monday-Friday**: 1 evening slot
  - Evening: 18:00-21:30
- **Saturday-Sunday**: 2 slots per day
  - Morning (AM): 09:00-12:30
  - Afternoon (PM): 13:30-17:00

### Slot Format
```
YYYY-Www-DDD-PP
```
- `YYYY`: Year
- `Www`: Week number (W01-W53)
- `DDD`: Day (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- `PP`: Period (AM, PM)

Examples:
- `2025-W39-Tue-AM`: Tuesday morning, week 39, 2025
- `2025-W39-Fri-PM`: Friday afternoon, week 39, 2025

## Date Formats

### Input (API)
- **ISO 8601**: `2025-09-23T10:00:00Z`
- Used for: `created_at_iso`, `deadline_iso`, `closed_at_iso`

### Output (Human-readable)
- **European format**: `dd.mm.yyyy [HH:MM]`
- Used for: All user-visible dates in responses and markdown files

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 400 Bad Request
```json
{
  "error": "missing fields"
}
```

### 404 Not Found
```json
{
  "error": "task not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Detailed error message"
}
```

## Data Storage Structure

### Azure Blob Storage Container: `codex-miroir`
```
codex-miroir/
└── users/
    └── {secure_token}/
        └── codex-miroir/
            ├── pro/
            │   ├── current.md      # Current professional tasks
            │   ├── archive.md      # Completed professional tasks
            │   └── tasks/
            │       └── YYYY/
            │           └── YYYY-MM-DD--ID-slug.md
            └── priv/
                ├── current.md      # Current private tasks
                ├── archive.md      # Completed private tasks
                └── tasks/
                    └── YYYY/
                        └── YYYY-MM-DD--ID-slug.md
```

### Token-Based User Isolation
- Each secure token creates a separate user directory
- Path format: `users/{secure_token}/codex-miroir/{list}/`
- Example: `users/mySecureToken123/codex-miroir/pro/current.md`

### Task File Naming Convention
```
YYYY-MM-DD--ID-slug.md
```
- `YYYY-MM-DD`: Creation date
- `ID`: Task identifier (e.g., T-001)
- `slug`: URL-friendly version of title

Example: `2025-09-23--T-001-api-specification.md`

## Usage Examples

### Creating a Professional Task
```bash
curl -X POST "https://your-function.azurewebsites.net/api/codex/mySecureToken123?action=createTask" \
  -H "Content-Type: application/json" \
  -d '{
    "list": "pro",
    "id": "T-001",
    "title": "API Specification",
    "created_at_iso": "2025-09-23T10:00:00Z",
    "scheduled_slot": "2025-W39-Tue-AM",
    "category": "programmierung",
    "deadline_iso": "2025-09-30T16:00:00Z",
    "project": "CodexMiroir"
  }'
```

### Getting Current Tasks
```bash
curl -X GET "https://your-function.azurewebsites.net/api/codex/mySecureToken123?action=report" \
  -H "Content-Type: application/json" \
  -d '{"list": "pro"}'
```

### Completing a Task
```bash
curl -X POST "https://your-function.azurewebsites.net/api/codex/mySecureToken123?action=completeTask" \
  -H "Content-Type: application/json" \
  -d '{
    "list": "pro",
    "taskPathAbs": "users/mySecureToken123/codex-miroir/pro/tasks/2025/2025-09-23--T-001-api-specification.md",
    "closed_at_iso": "2025-09-23T16:30:00Z"
  }'
```