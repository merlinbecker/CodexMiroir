# Code Quality Learning - SonarCloud Integration

## Zusammenfassung der Informationen

Dieses Dokument sammelt alle Informationen zur Implementierung der SonarCloud-Integration und des Quality Reports mit Radar Charts.

## Der ursprüngliche Plan

### Ziel
- Automatische Code-Qualitätsanalyse für jeden Pull Request und Push auf main
- Visuelle Darstellung der Qualitätsmetriken über Zeit
- Integration in den GitHub-Workflow
- Badges zur schnellen Übersicht der Code-Qualität

### Geplante Features (aus SONARCLOUD.md)
1. **Automatic Quality Analysis**: Läuft bei jedem PR und Push auf main
2. **Smart Triggering**: Überspringt Analyse für PRs mit "chore" Label
3. **Comprehensive Metrics**: Trackt Security, Reliability, Maintainability, Coverage, Code Duplication
4. **Visual Reports**: Generiert Radar Charts mit Qualitätsmetriken über Zeit
5. **Quality Badges**: Zeigt live SonarCloud Badges in Reports
6. **PR Integration**: Kommentiert PRs mit Qualitätsberichten

## Die Implementierung

### 1. SonarCloud Konfiguration

**sonar-project.properties:**
```properties
sonar.projectKey=merlinbecker_CodexMiroir
sonar.organization=merlinbecker
sonar.projectName=CodexMiroir
sonar.projectVersion=1.0

sonar.sources=src,public,database
sonar.tests=__tests__
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,test.js

# Coverage reports
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.coverage.exclusions=**/__tests__/**,**/*.test.js,**/*.spec.js,test.js
```

### 2. GitHub Actions Workflow

Der Workflow in `.github/workflows/sonarcloud-quality.yml` implementiert:

**Intelligentes Skipping:**
```yaml
- name: Check if PR has chore label
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const labels = context.payload.pull_request.labels.map(label => label.name);
      const hasChoreLabel = labels.includes('chore');
      core.setOutput('should-run', !hasChoreLabel);
```

**Test und Build Pipeline:**
```yaml
- name: Run tests with coverage
  run: npm run test:ci

- name: Build application
  run: npm run build || echo "No build script found"
```

**SonarCloud Scan:**
```yaml
- name: SonarCloud Scan
  uses: SonarSource/sonarcloud-github-action@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### 3. Das Radar Chart - Das Kernstück

Das komplexeste Stück war die Generierung des Radar Charts mit Vergleich zwischen aktuellen und vorherigen Metriken.

**Herausforderungen:**

1. **API-Authentifizierung**: SonarCloud API benötigt Token-basierte Auth
2. **Metrik-Transformation**: SonarCloud-Ratings (1=A, 5=E) mussten invertiert werden für intuitive Visualisierung
3. **Historische Daten**: Previous metrics von der SonarCloud History API holen
4. **Fehlerbehandlung**: Graceful handling wenn noch keine vorherigen Analysen existieren

**Die Lösung - Inline JavaScript Generator:**

```javascript
// Transform SonarCloud ratings (1=A, 2=B, 3=C, 4=D, 5=E) 
// to radar values (1-5, where 5 is best)
function transformRating(value) {
  if (!value || value === 'No data') return 0;
  const num = parseInt(value);
  return num ? 6 - num : 0; // Invert so 5 is best
}

// Transform percentage values (0-100 to 0-5 scale)
function transformPercentage(value) {
  if (!value || value === 'No data') return 0;
  return Math.round(parseFloat(value) / 20); // 0-100 -> 0-5
}
```

**Mermaid Radar Chart Generation:**
```javascript
const radarChart = [
  '```mermaid',
  'radar-beta',
  '  axis s["Security"], r["Reliability"], m["Maintainability"]',
  '  axis c["Coverage"], d["Code Duplication"], l["Lines of Code"]',
  `  curve current["Current"]{${current.security}, ${current.reliability}, ...}`,
  hasPrevious ? `  curve previous["Previous"]{${previous.security}, ...}` : '',
  '  max 5',
  '  min 0',
  '```'
].filter(line => line !== '').join('\n');
```

### 4. Die Metriken

**Tracked Metrics:**
- **Security Rating** (A-E scale) → 0-5 scale (5=best)
- **Reliability Rating** (A-E scale) → 0-5 scale (5=best)
- **Maintainability Rating** (A-E scale) → 0-5 scale (5=best)
- **Test Coverage** (percentage) → 0-5 scale
- **Code Duplication** (percentage, inverted) → 0-5 scale
- **Lines of Code** (logarithmic) → 0-5 scale

**Rating-Skala:**
- 5: Excellent (A rating or >80% coverage)
- 4: Good (B rating or >60% coverage)
- 3: Average (C rating or >40% coverage)
- 2: Below Average (D rating or >20% coverage)
- 1: Poor (E rating or <20% coverage)
- 0: No data available

### 5. Die Badges

Integration von SonarCloud Badges direkt in den Report:

```markdown
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_CodexMiroir&metric=alert_status)]
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_CodexMiroir&metric=security_rating)]
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_CodexMiroir&metric=sqale_rating)]
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_CodexMiroir&metric=reliability_rating)]
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_CodexMiroir&metric=coverage)]
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_CodexMiroir&metric=duplicated_lines_density)]
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=merlinbecker_CodexMiroir&metric=ncloc)]
```

## Die Probleme und Lösungen

### Problem 1: API-Authentifizierung
**Issue**: SonarCloud API erfordert Token in speziellem Format
**Lösung**: Verwendung von `curl -u "${SONAR_TOKEN}:"` für Basic Auth

### Problem 2: Fehlendes Previous Data
**Issue**: Bei der ersten Ausführung gibt es keine historischen Daten
**Lösung**: Graceful fallback mit leeren Measures und Conditional Rendering des previous curve

```javascript
if (echo "$current_json" | grep -q '"component"'; then
  echo "✅ Successfully fetched current metrics"
else
  echo "⚠️ SonarCloud project not found or no metrics available yet. Using default values."
  current_json='{"component":{"measures":[]}}'
fi
```

### Problem 3: Rating Inversion
**Issue**: SonarCloud nutzt 1=A (best), 5=E (worst), aber für Radar Charts wollten wir 5=best
**Lösung**: Simple Inversion: `6 - num`

### Problem 4: Git Conflicts bei Report Updates
**Issue**: Parallele Workflows könnten Report gleichzeitig updaten
**Lösung**: `[skip ci]` in Commit Message + `git push || true` für graceful failure

### Problem 5: Chore PRs verschwenden CI-Zeit
**Issue**: PRs mit Label "chore" (z.B. Dokumentation) brauchen keine Code-Analyse
**Lösung**: Smart conditional execution basierend auf PR Labels:

```yaml
- name: Check if PR has chore label
  id: check-label
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
```

## Das Ergebnis

### Visualisierung
Ein schönes **Radar Chart** das auf einen Blick zeigt:
- Aktuelle Qualitätsmetriken (blau)
- Vorherige Metriken (rot) zum Vergleich
- 6 Dimensionen der Code-Qualität
- Trends über Zeit sichtbar

### Report Structure
1. **Mermaid Radar Chart** - Visuell ansprechend
2. **Metrics Table** - Detaillierte Werte mit Emojis
3. **SonarCloud Badges** - Live-Status mit Click-Through zu Details
4. **Timestamp** - Wann der Report generiert wurde

### Integration
- Automatisch bei jedem Push/PR
- Committed in `codequality/report.md`
- Als Kommentar auf PRs gepostet
- Übersprungen für Chore-PRs

## Learnings

1. **SonarCloud API ist zweigeteilt**: `/api/measures/component` für current, `/api/project_analyses/search` + `/api/measures/search_history` für history
2. **Mermaid radar-beta ist mächtig**: Unterstützt multiple curves für Vergleiche
3. **GitHub Actions Conditionals sind tricky**: `if:` Expressions mit outputs müssen string-compared werden
4. **Inline Script Generation**: Komplexe Logik kann in heredoc-Dateien generiert werden
5. **Error Handling ist essentiell**: Bei Cloud-APIs immer mit Fallbacks arbeiten
6. **Badge URLs sind einfach**: SonarCloud bietet fertige Badge-URLs als API

## Code-Referenzen

### Package.json - Test Setup
```json
"scripts": {
  "test:ci": "jest --coverage --ci --watchAll=false"
},
"jest": {
  "collectCoverageFrom": ["codex/**/*.js", "static/**/*.js"],
  "coverageReporters": ["text", "lcov", "html"]
}
```

### Arc42 Dokumentation
- Technische Schulden wurden dokumentiert: Monolithische index.js wurde refaktoriert (75% Reduktion)
- Qualitätsziele priorisiert: Einfachheit > Performance > Verfügbarkeit
- Testing mit Jest und Coverage Reports etabliert

## Kontext für Außenstehende

**Was ist SonarCloud?**
Ein Cloud-basierter Code-Quality-Service, der statische Code-Analyse durchführt und Metriken wie Security-Ratings, Code-Smells, Test-Coverage trackt.

**Was ist ein Radar Chart?**
Eine spezielle Visualisierung die mehrere Metriken gleichzeitig auf verschiedenen Achsen darstellt - ideal um Code-Qualität auf einen Blick zu erfassen.

**Warum Mermaid?**
Mermaid ist eine JavaScript-basierte Diagramm-Bibliothek die direkt in Markdown rendert - perfekt für GitHub README und Reports.

**Was bedeuten die Ratings?**
SonarCloud bewertet Code nach Industry-Standards: A (excellent) bis E (poor). Diese werden in Zahlen transformiert für die Visualisierung.
