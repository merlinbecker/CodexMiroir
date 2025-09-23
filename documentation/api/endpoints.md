# CodexMiroir API Documentation

## Base URL
```
https://your-function-app.azurewebsites.net/api/codex
```

## Authentication
All requests require authentication via API key:
- Header: `x-api-key: YOUR_API_KEY`
- Or query parameter: `?apiKey=YOUR_API_KEY`

## Endpoints

### 1. Create Task
**POST** `/api/codex?action=createTask`

Creates a new task in the specified list (pro/priv).

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
  "taskPath": "codex-miroir/pro/tasks/2025/2025-09-23--T-001-api-specification.md",
  "currentPath": "codex-miroir/pro/current.md"
}
```

### 2. Complete Task
**POST** `/api/codex?action=completeTask`

Marks a task as completed and moves it to archive.

**Request Body:**
```json
{
  "list": "pro",                           // Required: "pro" or "priv"
  "taskPathAbs": "codex-miroir/pro/tasks/2025/2025-09-23--T-001-api-specification.md",
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
**POST** `/api/codex?action=pushToEnd`

Reschedules a task to a later time slot.

**Request Body:**
```json
{
  "list": "pro",                           // Required: "pro" or "priv"
  "taskPathAbs": "codex-miroir/pro/tasks/2025/2025-09-23--T-001-api-specification.md",
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
**GET** `/api/codex?action=report`

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
**GET** `/api/codex?action=when`

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
curl -X POST "https://your-function.azurewebsites.net/api/codex?action=createTask" \
  -H "x-api-key: YOUR_API_KEY" \
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
curl -X GET "https://your-function.azurewebsites.net/api/codex?action=report" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"list": "pro"}'
```

### Completing a Task
```bash
curl -X POST "https://your-function.azurewebsites.net/api/codex?action=completeTask" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "list": "pro",
    "taskPathAbs": "codex-miroir/pro/tasks/2025/2025-09-23--T-001-api-specification.md",
    "closed_at_iso": "2025-09-23T16:30:00Z"
  }'
```