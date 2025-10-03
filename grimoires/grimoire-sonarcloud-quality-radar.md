# Cloud Grimoire #1 – Die Beschwörung des Qualitäts-Radars

👁️ **Szene / Einstieg**  
Im Nebel der CI/CD-Pipeline wollte ich einen Spiegel erschaffen – einen, der nicht lügt, sondern die wahre Natur meines Codes offenbart. SonarCloud sollte sprechen, und seine Worte sollten sich in einem leuchtenden **Radar-Chart** manifestieren, das Vergangenheit und Gegenwart vergleicht. Sechs Dimensionen der Qualität, visualisiert in einem lebenden Diagramm, das mit jedem Commit atmet.

⚡ **Der Bruch / das Problem**  
Die erste Beschwörung schlug fehl. Mehrfach. SonarCloud sprach zwar, doch seine Stimme kam nicht durch:

**Das API-Authentifizierungs-Rätsel**: Ein Token allein genügt nicht. Es braucht das richtige Ritual: `curl -u "${SONAR_TOKEN}:"` – mit dem mystischen Doppelpunkt am Ende, der signalisiert: "Das Passwort ist leer, der Token ist alles."

**Die verkehrte Welt der Ratings**: SonarCloud spricht in Rätseln. Ein Rating von "1" bedeutet "A" (exzellent), "5" bedeutet "E" (mangelhaft). Doch für mein Radar wollte ich, dass 5 das Beste ist – die Sterne sollten nach oben zeigen, nicht fallen.

**Die Leere am Anfang**: Beim ersten Lauf gab es keine "vorherigen Metriken". Die API gab leere Antworten zurück, und das Skript zerbrach. Ich musste lernen, mit der Leere umzugehen – graceful zu scheitern.

**Der Git-Push-Konflikt**: Bei Pull Requests wollte der Report nicht auf den Branch – falsche Permissions, falscher Push-Befehl. Die Lösung erforderte intelligente Branch-Erkennung: PRs pushen auf den Head Branch, direkte Pushes auf den aktuellen Branch.

🔍 **Die Entdeckung / Erkenntnis**  
Die Lösung lag in vier magischen Transformationen:

**Transformation 1: Die Inversion der Ratings**
```javascript
function transformRating(value) {
  const num = parseInt(value);
  return num ? 6 - num : 0; // 1→5, 5→1: Sterne zeigen nach oben
}
```

**Transformation 2: Das Schweigen der Leere**
```bash
if echo "$current_json" | grep -q '"component"'; then
  echo "✅ Successfully fetched current metrics"
else
  current_json='{"component":{"measures":[]}}' # Leere umarmen
fi
```

**Transformation 3: Der bedingte Vergleich**
```javascript
const hasPrevious = previousData.measures?.length > 0;
const radarChart = [
  `curve current["Current"]{${current.security}, ...}`,
  hasPrevious ? `curve previous["Previous"]{...}` : '' // Nur wenn Geschichte existiert
].filter(line => line !== '').join('\n');
```

**Transformation 4: Der intelligente Git-Push**
```bash
if [ "${{ github.event_name }}" = "pull_request" ]; then
  git push origin HEAD:${{ github.head_ref }}  # PR: Head Branch
else
  git push  # Direct: Current Branch
fi
```

Der entscheidende Durchbruch: SonarCloud hat **zwei API-Endpunkte** für unterschiedliche Zeitreisen:
- `/api/measures/component` – die **Gegenwart**
- `/api/measures/search_history` – die **Vergangenheit**

Beide mussten gebändigt werden, um das Radar zum Leben zu erwecken. Dazu noch die Erkenntnis: Bei PRs gegen den **Base Branch** vergleichen (main), bei direkten Pushes gegen den vorherigen Commit.

**Das Chart selbst – Mermaid als Beschwörungsformel:**
```mermaid
---
title: "Code Quality Metrics"
---
radar-beta
  axis s["Security"], r["Reliability"], m["Maintainability"]
  axis c["Coverage"], d["Code Duplication"], l["Lines of Code"]
  curve current["Current"]{5, 5, 5, 0, 4, 4}
  curve previous["Previous"]{4, 5, 4, 3, 5, 3}
  max 5
  min 0
```

**Sechs Achsen. Zwei Kurven. Eine Wahrheit.**

Die Metriken werden transformiert auf eine intuitive Skala:
- **Security/Reliability/Maintainability**: A-E Ratings → 5-1 (invertiert)
- **Coverage**: Prozent → 0-5 (100% = 5 Sterne)
- **Code Duplication**: Prozent → 0-5 (0% = 5 Sterne, invertiert)
- **Lines of Code**: Logarithmisch skaliert → 0-5

**Die Badges – Siegel der Qualität:**

Die wahre Magie liegt in den **Live-Badges**, die SonarCloud für uns generiert:

```markdown
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=X&metric=alert_status)]
[![Security](https://sonarcloud.io/api/project_badges/measure?project=X&metric=security_rating)]
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=X&metric=coverage)]
```

Diese Badges sind nicht statisch – sie **leben**. Bei jedem SonarCloud-Scan aktualisieren sie sich. Ein Klick führt direkt zur vollständigen Analyse. Sechs Dimensionen, sechs Badges, sechs Fenster zur Code-Qualität:

- 🛡️ **Quality Gate**: Bestanden oder gescheitert
- 🔒 **Security Rating**: A bis E
- 🔧 **Maintainability**: Wie wartbar ist der Code
- 🎯 **Reliability**: Wie zuverlässig läuft er
- 📊 **Coverage**: Wie viel ist getestet
- 📋 **Duplication**: Wie viel Code wiederholt sich

Ein Blick auf die README – und ich weiß, ob mein Code im grünen Bereich ist.

**Das intelligente Überspringen – Nicht jedes Ritual ist nötig:**

Chore-PRs (Dokumentation, kleine Fixes) brauchen keine vollständige Code-Analyse. Das wäre Verschwendung kostbarer CI-Zeit:

```yaml
- name: Check if PR has chore label
  uses: actions/github-script@v7
  with:
    script: |
      const hasChoreLabel = labels.includes('chore');
      core.setOutput('should-run', !hasChoreLabel);
```

Ein einfacher Check: Hat der PR das `chore` Label? Wenn ja – skip. Das Ritual springt über, spart Ressourcen, bleibt fokussiert auf Code-Änderungen, die wirklich Analyse brauchen.

✨ **Die neue Rune im Grimoire**  
_„Ein Rating ist ein Spiegel, doch nur im richtigen Licht zeigt er die Wahrheit. Invertiere die Skala, umarme die Leere, pushe intelligent – und das Radar wird leuchten. Zwei Kurven sprechen lauter als eine – die Vergangenheit ist der Schatten, der die Gegenwart erst sichtbar macht. Die Badges sind Wächter an der Schwelle: Sie zeigen auf einen Blick, ob dein Code würdig ist."_

**Die Essenz der Beschwörung:**
- ⚡ **Invertiere SonarCloud-Ratings**: `6 - rating` macht Sterne aufwärts zeigen
- 🌑 **Umarme die Leere**: Graceful fallbacks für fehlende Historie
- 🔄 **Vergleiche intelligent**: Bei PRs gegen Base Branch, bei Pushes gegen Vorherigen
- 🔀 **Pushe kontextbewusst**: PRs auf Head Branch, Pushes auf Current Branch
- 📊 **Visualisiere mit Mermaid**: `radar-beta` mit conditional previous curve
- 🏅 **Zeige Live-Badges**: Sofortige visuelle Übersicht, direkt klickbar
- ⏭️ **Überspringe Chores**: Spare CI-Zeit für wirklich relevante Analysen

**Das Ergebnis – Die manifestierte Vision:**

Ein automatischer Quality Report, der **bei jedem Push und PR** erscheint:

✨ **Leuchtender Radar-Chart** mit Vergleich zwischen Current (blau) und Previous (rot)  
📊 **Sechs Dimensionen** der Code-Qualität auf einen Blick visualisiert  
🏅 **Live-Badges** die sich selbst aktualisieren und zum Klicken einladen  
📝 **Automatischer Commit** nach `codequality/report.md` – Geschichte bewahrt  
💬 **PR-Kommentare** mit vollständigem Report – Code Review mit Kontext  
⚡ **Smart Skipping** für Chore-PRs – Ressourcen gespart

Der Report lebt in `codequality/report.md` – ein permanentes Gedächtnis der Qualität. Mit jedem Commit wächst die Geschichte. Die Badges auf der README sind Fenster in diese Geschichte.

🌙 **Ausblick / offenes Ende**  
Das Radar dreht sich nun von selbst, bei jedem Commit, bei jedem PR. Es vergleicht, es misst, es dokumentiert. Die **Current Curve** tanzt mit der **Previous Curve** – ein Dialog zwischen Jetzt und Vorher.

Doch eine Frage bleibt, ein Wunsch unerfüllt: Können wir die Trends über **Wochen und Monate** verfolgen? Ein langfristiges Qualitäts-Archiv, das zeigt, wie der Code über Zeit gereift ist? Ein zweites Radar-Chart vielleicht – eines das nicht zwei Commits vergleicht, sondern zwölf Monate?

Die nächste Beschwörung wartet bereits im Nebel der Pipeline...

---

**Links & Referenzen:**
- [SonarCloud API Documentation](https://sonarcloud.io/web_api) – Die Quelle der Wahrheit
- [Mermaid Radar Charts](https://mermaid.js.org/syntax/radar.html) – Die Visualisierungs-Magie
- [GitHub Actions Conditionals](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsif) – Die if-Zauber
- [SonarCloud Project](https://sonarcloud.io/project/overview?id=merlinbecker_CodexMiroir) – Der lebende Spiegel

_Geschrieben im CodexMiroir, wo Code und Qualität sich spiegeln und die Wahrheit niemals lügt._
