
# CodexMiroir Dokumentation

Git-basiertes Task-Management nach dem Spartarégime-Prinzip.

## Hauptdokumentation

**📋 [arc42.md](arc42.md)** - Vollständige System-Architektur

## API & Regeln

- **[api/endpoints.md](api/endpoints.md)** - API-Endpoints (Sync & Render)
- **[creationrules.md](creationrules.md)** - Task-Erstellung (Markdown-Format)

## Quick Start

- **[QUICK_START.md](QUICK_START.md)** - Schnellstart für Nutzer & Entwickler

## Konzept-Übersicht

### Tasks = Dateien
Tasks sind nummerierte Markdown-Dateien (`0000.md` - `9999.md`) im GitHub Repository.

### Git = Source of Truth
Alle Task-Änderungen erfolgen über Git Commits.

### Timeline-Berechnung
- GitHub Webhook triggert Sync
- Azure Function lädt Tasks aus GitHub
- Tasks werden im Blob Storage gecacht
- Timeline wird deterministisch berechnet
- HTML/JSON Output

### Regeln
1. **Fixed first**: Tasks mit `fixedSlot` werden zuerst platziert
2. **Auto-Fill**: Restliche Tasks nach Dateinamen (0000 zuerst)
3. **Kategorie-Regeln**: geschäftlich (Mo-Fr), privat (Sa-So)
4. **Domino-Logik**: Konflikte werden vorwärts verschoben
