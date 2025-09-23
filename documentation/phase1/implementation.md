# Phase 1: Azure Functions Foundation Implementation

## Overview

This document describes the implementation of Phase 1 of the CodexMiroir migration, which sets up the minimal Azure Functions foundation with core task management functionality.

## Implementation Status

✅ **Completed:**
- Azure Functions project structure created
- Core function with 5 basic actions implemented
- Azure Blob Storage integration
- Markdown-based data storage
- API-key authentication
- European date formatting
- FIFO task management workflow

## Architecture

### Azure Function Structure
```
codex-miroir-fn/
├── function.json      # HTTP trigger configuration
├── host.json         # Function app configuration  
├── package.json      # Dependencies
└── index.js          # Main function implementation
```

### API Endpoints

The function exposes a single HTTP endpoint: `/api/codex?action=ACTION`

#### Supported Actions:

1. **createTask** (POST)
   - Creates a new task in markdown format
   - Updates current.md with task entry
   - Stores task metadata in frontmatter

2. **completeTask** (POST)
   - Marks task as completed
   - Moves task from current.md to archive.md
   - Updates task status and completion date

3. **pushToEnd** (POST)
   - Reschedules task to a later slot
   - Updates task metadata and current.md
   - Maintains task history in markdown

4. **report** (GET)
   - Returns current tasks for a list (pro/priv)
   - Parses markdown tables to extract task data

5. **when** (GET)
   - Returns next available time slot
   - Respects business vs private hours

### Data Structure

#### Storage Layout
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

#### Task File Format
Each task is stored as a markdown file with YAML frontmatter:

```markdown
---
id: T-001
list: pro
title: "API Specification"
status: geplant
created_at: 23.09.2025
scheduled_slot: 2025-W39-Tue-AM
duration_slots: 1
deadline: 30.09.2025
project: "CodexMiroir"
category_pro: programmierung
---

## Notiz

kurz…

## Verlauf
- 23.09.2025 → geplant in `2025-W39-Tue-AM`
```

#### Current.md Format
```markdown
# Codex Miroir — CURRENT (pro)

> Aktueller Slot: `2025-W39-Tue-AM`

## Woche 2025-W39
| Slot-ID           | Task                                | Kategorie        | Deadline        |
|-------------------|-------------------------------------|------------------|-----------------|
| 2025-W39-Tue-AM   | [T-001: API Specification](./tasks/2025/2025-09-23--T-001-api-specification.md) | programmierung | 30.09.2025 |
```

## Key Features

### FIFO Workflow
- Tasks are scheduled to specific time slots
- No task reordering within slots
- Strict adherence to scheduling rules

### European Date Format
- All user-visible dates in dd.mm.yyyy format
- Internal processing uses ISO 8601
- Consistent formatting across all interfaces

### Slot System
- Professional: Mon-Fri, 2 slots/day (AM: 09:00-12:30, PM: 13:30-17:00)
- Private: Mon-Fri 1 evening slot (18:00-21:30), Weekends 2 slots each day
- Each slot = 3.5 hours

### Authentication
- Simple API key authentication
- Environment variable: `API_KEY`
- Header: `x-api-key` or query parameter: `apiKey`

## Environment Variables

Required environment variables for deployment:

```
AZURE_BLOB_CONN=<Azure Storage Connection String>
BLOB_CONTAINER=codex-miroir
API_KEY=<Your API Key>
```

## Testing

### Manual Testing Commands

```bash
# Create a task
curl -X POST "https://your-function.azurewebsites.net/api/codex?action=createTask" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "list": "pro",
    "id": "T-001",
    "title": "Test Task",
    "created_at_iso": "2025-09-23T10:00:00Z",
    "scheduled_slot": "2025-W39-Tue-AM",
    "category": "testing"
  }'

# Get task report
curl -X GET "https://your-function.azurewebsites.net/api/codex?action=report" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"list": "pro"}'
```

## Next Steps

Phase 1 provides the foundation for:
- [ ] Phase 2: Voice command processing and AI integration
- [ ] Phase 3: Frontend migration and UI updates
- [ ] Data migration from existing PostgreSQL database
- [ ] Production deployment and testing

## Implementation Notes

### Design Decisions
1. **Single file approach**: All logic in `index.js` for simplicity
2. **Markdown storage**: Human-readable and version-controllable
3. **Minimal dependencies**: Only essential packages for Azure and markdown
4. **European locale**: Consistent with user requirements
5. **FIFO enforcement**: No task reordering to maintain focus

### Error Handling
- Comprehensive input validation
- Graceful handling of missing files
- Detailed error messages for debugging
- Proper HTTP status codes

### Performance Considerations
- Efficient markdown parsing
- Minimal API calls to storage
- Optimized file operations
- Response time targets: <200ms for CRUD operations