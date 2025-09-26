# CodexMiroir - Minimalistic PWA Task Manager

CodexMiroir ist ein sprachgesteuertes, minimalistisches Task-Management-System als Progressive Web App (PWA). Das System implementiert die "Spiegelkodex"-Philosophie - ein FIFO-Ansatz (First-In-First-Out), der Fokus durch prominente Anzeige nur der aktuellen Aufgabe erzwingt. Das System operiert in deutscher Sprache und unterstützt sowohl berufliches als auch privates Aufgabenmanagement mit unterschiedlichen visuellen Themes.

# Benutzereinstellungen

Bevorzugter Kommunikationsstil: Einfache, alltägliche Sprache auf Deutsch.

# Systemarchitektur

## Frontend-Architektur
Die Anwendung verwendet eine Progressive Web App (PWA) mit modernem Vanilla JavaScript als primäres Frontend-Framework. Die Benutzeroberfläche folgt einem mobile-first, minimalistischen Design-Ansatz mit:

- **PWA-Komponenten**: Modulare Komponentenstruktur mit Vanilla JS-Klassen
- **Styling**: Modernes CSS mit fokussiertem Design
- **Theme-System**: Dual-Theme-Architektur mit Dark Mode (beruflich) und Light Mode (privat)
- **PWA-Features**: Service Worker-Implementierung für Offline-Funktionalität
- **Token-Management**: Sichere lokale Token-Speicherung für Benutzeridentifikation

## Backend-Architektur
Das Backend basiert vollständig auf Azure Functions und folgt einer serverlosen Architektur:

- **Azure Functions**: Lightweight API mit modularer Struktur
- **Storage Layer**: Azure Blob Storage mit Markdown-Dateien
- **Routing**: Action-basiertes Routing für verschiedene Task-Operationen
- **Token-Authentifizierung**: URL-basierte Token-Authentifizierung für Benutzertrennung

## Datenspeicher-Lösungen
Die Anwendung verwendet einen flexiblen Datenspeicher-Ansatz:

- **Storage**: Azure Blob Storage für sichere, skalierbare Datenhaltung
- **Format**: Markdown-Dateien mit YAML-Frontmatter für menschlich lesbare Task-Daten
- **Benutzertrennung**: Token-basierte Pfadstruktur (`users/{token}/codex-miroir/`)
- **Offline-Support**: Lokale Caching-Mechanismen für PWA-Funktionalität

## Task-Management-System
Die Kernfunktionalität dreht sich um striktes FIFO-Task-Management:

- **Dual Backlogs**: Getrennte Task-Warteschlangen für berufliche und private Kontexte
- **FIFO-Ordering**: Tasks werden in strikter Reihenfolge ohne manuelle Neuordnung verarbeitet
- **Status-Management**: Einfaches Drei-Status-System (geplant, aktiv, abgeschlossen)
- **Auto-Chunking**: KI-gestützte Task-Aufbereitung in 3,5-Stunden-Arbeitsblöcke
- **Smart Reprioritization**: Automatische Task-Neuordnung basierend auf Deadlines und Dringlichkeit

## Authentifizierung und Autorisierung
Die Anwendung implementiert ein token-basiertes Sicherheitsmodell:

- **Sichere Token**: 16-Zeichen-Token für Benutzertrennung
- **URL-basiert**: Token werden in der URL übertragen (`/api/codex/{token}`)
- **Lokale Speicherung**: Token werden im localStorage des Browsers gespeichert
- **Keine zentrale User-DB**: Jeder Token definiert einen isolierten Datenbereich

# Externe Abhängigkeiten

## KI-Integration
- **OpenAI API**: Verwendet für intelligente Task-Zerlegung und deutsche Sprachverarbeitung
- **GPT-Modelle**: Aktuelle GPT-3.5/4-Integration für natürliche Sprachverarbeitung von Task-Beschreibungen

## UI und Styling
- **Moderne CSS**: Utility-basiertes CSS für responsive Design
- **Progressive Web App**: Service Worker für Offline-Funktionalität
- **Deutsche Lokalisierung**: Vollständige deutsche Benutzeroberfläche

## Datenbank und Storage
- **Azure Blob Storage**: Serverlose Markdown-Dateispeicherung
- **Markdown-Format**: Menschlich lesbare Task-Dateien mit YAML-Frontmatter
- **Token-basierte Pfade**: Automatische Benutzertrennung über Pfadstruktur

## Entwicklung und Build-Tools
- **Azure Functions**: Serverlose Backend-Ausführung
- **Node.js 18+**: Modern JavaScript Runtime
- **Jest**: Testing-Framework für Backend-Tests
- **Service Worker**: PWA-Offline-Funktionalität

## PWA und Performance
- **Service Worker**: Custom-Implementierung für Offline-Funktionalität und Caching
- **Web Speech API**: Browser-native Spracherkennung für Voice-Input
- **LocalStorage**: Token- und Cache-Management
- **Moderne JS-Features**: ES6+ für optimierte Performance

## Hosting und Deployment
- **Azure Functions**: Serverlose Cloud-Ausführung
- **Azure Blob Storage**: Skalierbare Dateispeicherung
- **PWA-Distribution**: Über Azure Functions static hosting