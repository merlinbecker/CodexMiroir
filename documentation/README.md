# CodexMiroir Dokumentation

Git-basiertes Task-Management nach dem Spartarégime-Prinzip.

## 📋 Hauptdokumentation

**[arc42.md](arc42.md)** - Vollständige System-Architektur und Dokumentation

Die konsolidierte arc42-Dokumentation enthält:
- Einführung und Ziele
- Architekturübersicht und Randbedingungen
- Kontextabgrenzung (Fachlich & Technisch)
- Lösungsstrategie und Bausteinsicht
- Laufzeitsicht (Sequenzdiagramme)
- Verteilungssicht (Deployment)
- Querschnittliche Konzepte (OAuth2, Caching, etc.)
- Entwurfsentscheidungen (ADRs)
- Qualitätsszenarien
- Risiken und technische Schulden
- Glossar
- Deployment-Anleitung (Lokal & Azure)

## 🔧 Entwickler-Referenz

- **[api/endpoints.md](api/endpoints.md)** - API-Endpoints Referenz
- **[creationrules.md](creationrules.md)** - Task-Erstellungsregeln (YAML Format)
- **[testingRules.md](testingRules.md)** - Testing Rules für Entwickler
- **[SONARCLOUD.md](SONARCLOUD.md)** - Code Quality Integration

## 🚀 Quick Start

Für einen schnellen Einstieg siehe **[arc42.md - Anhang: Deployment-Anleitung](arc42.md#anhang-deployment-anleitung)**

## 📚 Konzept-Übersicht

### Tasks = Dateien
Tasks sind nummerierte Markdown-Dateien (`0000.md` - `9999.md`) im GitHub Repository.

### Git = Source of Truth
Alle Task-Änderungen erfolgen über Git Commits. Azure Blob Storage dient als Cache.

### Timeline-Berechnung
- GitHub Webhook triggert Sync
- Azure Function lädt Tasks aus GitHub
- Dual-Layer Cache (Memory + Blob Storage)
- Timeline wird deterministisch berechnet
- JSON/HTML Output

### Kernregeln
1. **Fixed first**: Tasks mit `fixedSlot` werden zuerst platziert
2. **Auto-Fill**: Restliche Tasks nach Dateinamen aufsteigend (0000 zuerst)
3. **Kategorie-Regeln**: `arbeit` (Mo-Fr), `privat` (Sa-So)
4. **Domino-Logik**: Konflikte werden vorwärts verschoben
5. **User-Isolation**: Jeder User hat eigenen Ordner (`{userId}/tasks/`)

## 🔐 Authentifizierung

Das System nutzt **GitHub OAuth2** für User-Authentifizierung und -Identifikation. Details siehe [arc42.md - Section 8.2](arc42.md#82-unter-the-hood)
