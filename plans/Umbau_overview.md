# Komplettumbau: Von Next.js zu Azure Functions PWA

## Executive Summary

Dieses Dokument beschreibt den geplanten kompletten Umbau der CodexMiroir Task Management Applikation von einer Next.js/Express/PostgreSQL Architektur zu einer modernen Azure Functions basierten Progressive Web App (PWA) mit JavaScript und Azure Storage.

## Aktuelle Architektur (Ist-Zustand)

### Frontend
- **Framework**: React mit TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Routing**: Wouter
- **State Management**: Custom React Hooks
- **PWA Features**: Service Worker bereits implementiert
- **Theme System**: Dual-Mode (light/dark für private/professional)

### Backend
- **Server**: Express.js mit TypeScript
- **Datenbank**: PostgreSQL mit Drizzle ORM
- **Authentifizierung**: Token-basierte Authentifizierung
- **AI Integration**: OpenAI für Task-Chunking
- **Storage**: Datenbankbasiert

### Aktuelle Features
- Dual FIFO Task Management (professional/private)
- Task Chunking in 3,5h Blöcke
- Token-basierte Sicherheit
- OpenAI Integration
- PWA Funktionalität
- CSV Export

## Ziel-Architektur (Soll-Zustand)

### Azure Functions Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure Functions App                      │
├─────────────────────────────────────────────────────────────────┤
│  Route "/"           │  Route "/api"                            │
│  ├─ Static PWA UI    │  ├─ GET  /api/tasks/{userId}            │
│  ├─ Service Worker   │  ├─ POST /api/tasks/{userId}            │
│  └─ JavaScript       │  ├─ PUT  /api/tasks/{userId}/{taskId}   │
│                      │  ├─ DELETE /api/tasks/{userId}/{taskId} │
│                      │  ├─ POST /api/chunk/{userId}            │
│                      │  ├─ POST /api/voice/{userId}            │
│                      │  └─ GET  /api/report/{userId}           │
└─────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Azure Storage Account                        │
├─────────────────────────────────────────────────────────────────┤
│  Container: users                                               │
│  ├─ {userId}/                                                   │
│  │  ├─ business-tasks.md                                        │
│  │  ├─ private-tasks.md                                         │
│  │  ├─ calendar.md                                              │
│  │  └─ config.json                                              │
│  └─ templates/                                                  │
│     ├─ task-template.md                                         │
│     └─ calendar-template.md                                     │
└─────────────────────────────────────────────────────────────────┘
```

### User Management System
- **Secret URLs**: Jeder User hat eine eindeutige, geheime URL mit einem kryptographischen Key
- **Format**: `https://app.azurewebsites.net/?user={SECRET_KEY}`
- **Zugriff**: Jeder Secret Key ermöglicht Zugriff auf genau 2 Listen (business + private)
- **Sicherheit**: 64-Zeichen Hex-String als User-Identifikator

### Storage System (Markdown Files)
```markdown
# Business Tasks - {USER_ID}
## Metadata
- Created: 2024-01-15
- Last Modified: 2024-01-20
- Total Tasks: 15
- Active Task: task-003

## Active Task
### task-003 | Meeting Vorbereitung Q1 Review
- **Status**: active
- **Estimated**: 210 minutes (3.5h)
- **Remaining**: 180 minutes
- **Deadline**: 2024-01-22T09:00:00Z
- **Created**: 2024-01-20T08:00:00Z
- **Priority**: high
- **Type**: meeting

**Description**: Vorbereitung der Präsentation für Q1 Review Meeting mit Stakeholdern.

## Pending Tasks
### task-004 | Code Review Microservice Auth
- **Status**: pending
- **Estimated**: 210 minutes (3.5h)
- **Deadline**: 2024-01-25T17:00:00Z
- **Type**: task
- **Priority**: medium

**Description**: Review des neuen Authentifizierungs-Microservices inkl. Security Tests.

## Completed Tasks
### task-001 | Email Migration Plan ✓
- **Status**: completed
- **Completed**: 2024-01-19T16:30:00Z
- **Type**: task
```

### JavaScript Migration
- **Von TypeScript zu JavaScript**: Alle Serverkomponenten werden zu JavaScript konvertiert
- **Azure Functions Runtime**: Node.js 18+ mit nativen ES6 Modules
- **Dependency Injection**: Implementierung eines DI Containers
- **Clean Code**: Modulare Architektur mit klarer Trennung der Verantwortlichkeiten

### Erweiterte Features

#### 1. Calendar System (Neues Feature)
```
Wochentag-Schema:
┌─────────────┬─────────────┬─────────────┐
│   Montag    │   Dienstag  │   Mittwoch  │
├─────────────┼─────────────┼─────────────┤
│ 09:00-12:30 │ 09:00-12:30 │ 09:00-12:30 │ Business Slot 1
│ 13:30-17:00 │ 13:30-17:00 │ 13:30-17:00 │ Business Slot 2
│ 18:00-21:30 │ 18:00-21:30 │ 18:00-21:30 │ Private Slot
└─────────────┴─────────────┴─────────────┘

Wochenende:
┌─────────────┬─────────────┐
│   Samstag   │   Sonntag   │
├─────────────┼─────────────┤
│ 09:00-12:30 │ 09:00-12:30 │ Private Slot 1
│ 13:30-17:00 │ 13:30-17:00 │ Private Slot 2
└─────────────┴─────────────┘
```

#### 2. Voice Control Integration
- **Whisper API**: Sprach-zu-Text Konvertierung
- **OpenAI LLM**: Intent Recognition und Tool Selection
- **Unterstützte Aktionen**:
  - "Erstelle neue Aufgabe: [Beschreibung]"
  - "Markiere aktuelle Aufgabe als erledigt"
  - "Verschiebe Task [Name] nach oben"
  - "Zeige mir den Wochenreport"

#### 3. Advanced Task Management
- **Task Types**: Unterscheidung zwischen `task` und `meeting`
- **Priority Calculation**: Automatische Priorität basierend auf Deadline und Slack Time
- **Manual Priority**: Manuelle Überschreibung durch Verschieben
- **Task Chunking**: AI-gestützte Zerlegung in 3,5h Blöcke

#### 4. Reporting System
```javascript
// Weekly Report Structure
{
  "week": "2024-W03",
  "user": "user-123",
  "business": {
    "totalTasks": 12,
    "completedTasks": 10,
    "meetings": 6,
    "regularTasks": 4,
    "totalHours": 35,
    "meetingRatio": 0.6
  },
  "private": {
    "totalTasks": 8,
    "completedTasks": 7,
    "totalHours": 24.5
  },
  "efficiency": {
    "taskCompletionRate": 0.85,
    "averageTaskDuration": 3.2,
    "adherenceToSchedule": 0.78
  }
}
```

## Migration Strategy

### Phase 1: Foundation (Woche 1-2)
1. Azure Functions App Setup
2. Azure Storage Account Configuration
3. Basic JavaScript Framework
4. User Management System

### Phase 2: Core Migration (Woche 3-4)
5. Task Management Migration
6. Markdown Storage Implementation
7. UI Migration zu JavaScript
8. Basic Calendar System

### Phase 3: Enhanced Features (Woche 5-6)
9. Voice Control Integration
10. Advanced Calendar Logic
11. Reporting System
12. Performance Optimization

### Phase 4: Testing & Deployment (Woche 7-8)
13. Comprehensive Testing
14. User Acceptance Testing
15. Performance Testing
16. Production Deployment

## Risiken und Mitigation

### Technische Risiken
1. **Azure Functions Cold Start**: Mitigation durch Always-On oder Premium Plan
2. **Storage Performance**: Caching-Strategien für häufig genutzte Daten
3. **JavaScript Migration**: Schrittweise Migration mit TypeScript-zu-JavaScript Tools

### Funktionale Risiken
1. **Datenverlust**: Backup-Strategie für existierende Daten
2. **Feature Parity**: Sicherstellung aller existierenden Features
3. **User Experience**: Beibehaltung der gewohnten UX

## Erfolgskriterien

### Technische Kriterien
- ✅ 100% JavaScript (kein TypeScript)
- ✅ Azure Functions als Runtime
- ✅ Markdown-basierte Datenhaltung
- ✅ Sub-200ms API Response Times
- ✅ PWA Scores > 90 in allen Kategorien

### Funktionale Kriterien
- ✅ Alle existierenden Features verfügbar
- ✅ Voice Control funktional
- ✅ Calendar System implementiert
- ✅ Reporting funktional
- ✅ Multi-User fähig mit Secret URLs

### Business Kriterien
- ✅ Reduzierte Infrastruktur-Kosten
- ✅ Verbesserte Skalierbarkeit
- ✅ Einfachere Wartung
- ✅ Bessere Performance

## Nächste Schritte

1. **Detailplanung**: Ausarbeitung der einzelnen Implementierungsschritte
2. **Prototype**: Entwicklung eines minimalen Azure Functions Prototyps
3. **Migration Tools**: Entwicklung von Migrations-Scripts für existierende Daten
4. **Testing Strategy**: Definierung der Test-Szenarien und -Kriterien

---

**Erstellt**: 2024-01-20  
**Version**: 1.0  
**Status**: Draft - Zur Review