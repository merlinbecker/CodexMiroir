# Komplettumbau: Von Next.js zu minimaler Azure Functions PWA - "Codex Miroir"

## Executive Summary

Dieses Dokument beschreibt den kompletten Umbau der CodexMiroir Task Management Applikation zu einer **minimalistischen "Spiegelkodex"-Anwendung** basierend auf dem neuen vereinfachten Konzept. Das Ziel ist eine ultra-schlanke Azure Functions Implementierung mit striktem FIFO-Prinzip und Markdown-basierter Datenhaltung.

## Grundprinzipien des neuen Konzepts

### "Spiegelkodex" Philosophie
- **Fokus-erzwingend**: Nur der aktuelle Task wird prominent angezeigt
- **Mentale Entlastung**: Keine editierbare Liste, nur sichtbare FIFO-Warteschlange  
- **Transparenz**: Zeigt Auftraggebern automatisch die erzeugte Last
- **Strikte Regeln**: Kein Pausieren, kein Multitasking, nur linearer Abarbeitungsfluss

### Zwei getrennte Backlogs
- **Beruflich (pro)**: Mo-Fr, 2 Slots pro Tag (Vormittag 09:00-12:30, Nachmittag 13:30-17:00)
- **Privat (priv)**: Mo-Fr 1 Slot abends (18:00-21:30), Sa/So je 2 Slots (09:00-12:30, 13:30-17:00)
- **Slot-System**: Jeder Task = exakt 1 Slot = 3,5 Stunden
- **Mode-Wechsel**: Dark Mode = beruflich, Light Mode = privat

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

## Neue Ziel-Architektur (Vereinfacht)

### Minimalistische Azure Functions Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│              Azure Functions App (Single Function)              │
├─────────────────────────────────────────────────────────────────┤
│  Route: /api/codex?action=ACTION                                │
│  ├─ createTask    (POST)                                        │
│  ├─ completeTask  (POST)                                        │
│  ├─ pushToEnd     (POST)                                        │
│  ├─ report        (GET)                                         │
│  └─ when          (GET)                                         │
└─────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                Azure Storage Account (Blob)                     │
├─────────────────────────────────────────────────────────────────┤
│  Container: codex-miroir                                        │
│  ├─ pro/                                                        │
│  │  ├─ current.md      (aktuelle Tasks nach Wochen)            │
│  │  ├─ archive.md      (abgeschlossene Tasks)                  │
│  │  └─ tasks/YYYY/YYYY-MM-DD--ID-slug.md                       │
│  └─ priv/                                                       │
│     ├─ current.md                                               │
│     ├─ archive.md                                               │
│     └─ tasks/YYYY/YYYY-MM-DD--ID-slug.md                        │
└─────────────────────────────────────────────────────────────────┘
```

### Authentifizierung (Vereinfacht)
- **API-Key basiert**: Einfacher `x-api-key` Header
- **Kein User-Management**: Ein einziger Nutzer
- **Sicherheit**: Umgebungsvariable statt komplexer Token-System

### Markdown Storage System (Neue Struktur)

#### Task-Datei Format
```markdown
---
id: T-0123
list: pro              # 'pro' | 'priv'
title: "API Spec"
status: geplant        # geplant | aktiv | abgeschlossen
created_at: 23.09.2025 09:12
scheduled_slot: 2025-W39-Tue-AM
duration_slots: 1
deadline: 30.09.2025 16:00
project:
azure_devops:
requester:
category_pro: programmierung   # pro: meeting | programmierung
category_priv:                 # priv: haushalt | projekt
---
## Notiz
kurz…

## Verlauf
- 23.09.2025 09:15 → geplant in `2025-W39-Tue-AM`
```

#### Current.md (Aktuelle Tasks)
```markdown
# Codex Miroir — CURRENT (pro)

> Aktueller Slot: `2025-W39-Tue-AM`

## Woche 2025-W39
| Slot-ID           | Task                                | Kategorie        | Deadline        |
|-------------------|-------------------------------------|------------------|-----------------|
| 2025-W39-Tue-AM   | [T-0123: API Spec](./tasks/2025/2025-09-23--T-0123-api-spec.md) | programmierung | 30.09.2025 16:00 |
| 2025-W39-Tue-PM   | [T-0124: Stakeholder Sync](./tasks/2025/2025-09-23--T-0124-sync.md) | meeting      |                 |
```

#### Archive.md (Abgeschlossene Tasks)
```markdown
# Codex Miroir — ARCHIVE (pro)

## Woche 2025-W39
| Abgeschlossen am     | Slot-ID           | Task                                  | Kategorie        | Dauer |
|----------------------|-------------------|---------------------------------------|------------------|-------|
| 24.09.2025 16:45     | 2025-W39-Wed-PM   | [T-0123: API Spec](./tasks/2025/2025-09-23--T-0123-api-spec.md) | programmierung | 1     |
```

### Vereinfachte API (Eine Function)

#### Azure Function: `index.js`
```javascript
const { BlobServiceClient } = require("@azure/storage-blob");
const matter = require("gray-matter");

// Umgebungsvariablen
const CONN = process.env.AZURE_BLOB_CONN;
const CONTAINER = process.env.BLOB_CONTAINER || "codex-miroir";
const API_KEY = process.env.API_KEY;

// Actions:
// POST /api/codex?action=createTask
// POST /api/codex?action=completeTask  
// POST /api/codex?action=pushToEnd
// GET  /api/codex?action=report
// GET  /api/codex?action=when
```

### Datums- und Zeitformat
- **Sichtbare Daten**: dd.mm.yyyy [HH:MM] (Europäisch)
- **Slot-IDs**: ISO-like (2025-W39-Tue-AM/PM)
- **Interne Verarbeitung**: ISO 8601
- **Konsistenz**: Alle User-sichtbaren Daten im deutschen Format

## JavaScript Migration
- **Von TypeScript zu JavaScript**: Komplette Umstellung auf Vanilla JavaScript
- **Begründung**: Einfachheit vor Type Safety
- **Dependencies**: Minimal (azure/storage-blob + gray-matter)
- **Framework-frei**: Keine komplexen React-Konstrukte mehr

### Task Management Philosophie (Vereinfacht)

#### FIFO-Prinzip (Strikt)
- **Nur ein aktiver Task**: Prominente Anzeige des aktuellen Tasks
- **Nicht editierbare Warteschlange**: Pending Tasks nur sichtbar, nicht manipulierbar
- **Automatisches Verschieben**: Nicht bearbeitbare Tasks wandern ans Ende
- **Kein Multitasking**: Fokus auf eine Aufgabe zur Zeit

#### Task-Eigenschaften (Reduziert)
- **Kernfelder**: ID, Titel, Notiz, Slot, Deadline, Kategorie
- **Zusatzfelder**: Azure DevOps Ticket, Ansprechpartner, Projekt
- **Kategorien**: 
  - **Pro**: meeting | programmierung
  - **Priv**: haushalt | projekt
- **Feste Dauer**: Jeder Task = 1 Slot = 3,5 Stunden

#### Kalender-System (Wochenbasiert)
```
Beruflich (pro):
Mo-Fr: Vormittag (09:00-12:30) + Nachmittag (13:30-17:00)

Privat (priv):  
Mo-Fr: Abend (18:00-21:30)
Sa-So: Vormittag (09:00-12:30) + Nachmittag (13:30-17:00)
```

## Migration Strategy (Vereinfacht)

### Phase 1: Minimale Azure Function (1-2 Tage)
1. **Single Function Setup**: Eine Azure Function mit allen Actions
2. **Blob Storage Integration**: Container + Markdown-Dateien
3. **API-Key Authentifizierung**: Einfacher Header-basierter Schutz

### Phase 2: Markdown-System (2-3 Tage)  
4. **Parser Implementation**: gray-matter für Frontmatter
5. **CRUD Operations**: Create, Complete, PushToEnd Funktionen
6. **Tabellen-Management**: Wochen-basierte Markdown-Tabellen

### Phase 3: Frontend Anpassung (2-3 Tage)
7. **API Integration**: Neue Endpunkte anbinden
8. **UI Vereinfachung**: Fokus auf aktuellen Task
9. **Theme Integration**: Dark/Light für Pro/Priv

### Phase 4: Testing & Go-Live (1 Tag)
10. **Integration Tests**: API + Storage Validation
11. **Performance Tests**: Markdown Parse-Performance
12. **Deployment**: Azure Functions Deployment

## Erfolgskriterien (Angepasst)

### Technische Kriterien
- ✅ Eine Azure Function mit 5 Actions
- ✅ Markdown-basierte Datenhaltung funktional
- ✅ API Response Times < 500ms
- ✅ Europäisches Datumsformat durchgängig
- ✅ Blob Storage zuverlässig

### Funktionale Kriterien
- ✅ FIFO-Prinzip strikt durchgesetzt
- ✅ Nur aktueller Task prominent sichtbar
- ✅ Wochenbasiertes Reporting funktional
- ✅ Push-to-End für nicht bearbeitbare Tasks
- ✅ Dark/Light Mode für Pro/Priv Unterscheidung

### Vereinfachungs-Kriterien
- ✅ Keine User-Management Komplexität
- ✅ Keine Voice Control in Phase 1
- ✅ Keine AI-Integration initial
- ✅ Minimale Dependencies (nur 2 NPM packages)
- ✅ Wartbare, übersichtliche Codebasis

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