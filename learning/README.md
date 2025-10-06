# Learning Documents

Dieser Ordner enthält detaillierte Dokumentationen zu spezifischen Learnings während der Entwicklung von CodexMiroir.

## Zweck

Die Learning-Dokumente dienen als umfassende Referenz, die:
- Alle relevanten Informationen zu einem Thema sammeln
- Den ursprünglichen Plan dokumentieren
- Probleme und Lösungen aufzeigen
- Code-Beispiele und Konfigurationen bereitstellen
- Als Basis für Cloud Grimoires dienen

## Struktur

Jedes Learning-Dokument folgt dieser Struktur:
1. **Zusammenfassung** – Überblick über das Thema
2. **Der ursprüngliche Plan** – Was war das Ziel?
3. **Die Implementierung** – Wie wurde es umgesetzt?
4. **Die Probleme und Lösungen** – Was lief schief und wie wurde es gelöst?
5. **Das Ergebnis** – Was kam dabei heraus?
6. **Learnings** – Die wichtigsten Erkenntnisse
7. **Code-Referenzen** – Relevante Code-Snippets
8. **Kontext für Außenstehende** – Erklärungen für Leser ohne Vorkenntnisse

## Verfügbare Learnings

### [Code Quality - SonarCloud Integration](codeQuality.md)
Detaillierte Dokumentation der Implementierung von SonarCloud mit automatischem Quality Report, Radar Charts und Badges.

**Themen:**
- SonarCloud API-Integration
- GitHub Actions Workflow
- Radar Chart Generierung mit Mermaid
- Metrik-Transformation
- Error Handling und Graceful Degradation
- Smart PR Label Handling

### [Stored Procedures - Cosmos DB Timeline Management](stored-procedures.md)
Umfassende Dokumentation der Implementierung von Stored Procedures in Azure Cosmos DB für atomare Timeline-Operationen.

**Themen:**
- Stored Procedures für AutoFill und manuelle Slot-Zuweisung
- Business-Regeln für Werktag vs. Wochenende
- Shift-und-Carry-Mechanismus bei Slot-Konflikten
- Pre-Triggers für automatische Task-Normalisierung
- Idempotentes Deployment-Skript
- Race Condition Prevention
- Fixed-Flag für Meeting-Ausnahmen
- API-Inkonsistenzen und Lösungen

## Beziehung zu Cloud Grimoires

Learning-Dokumente sind die ausführliche, technische Basis. Cloud Grimoires sind die destillierte, narrative Form dieser Learnings – geschrieben für maximale Lesbarkeit und Erinnerungswert.

**Workflow:**
1. Informationen sammeln → `learning/[thema].md`
2. Informationen analysieren und destillieren
3. Cloud Grimoire erstellen → `grimoires/grimoire-[thema].md`
