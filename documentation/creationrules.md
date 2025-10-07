# Task Creation Rules

## Spartarégime: Datei = Task

Tasks sind **nummerierte Markdown-Dateien** in `codex-miroir/tasks/`:

- **Dateiname**: `0000.md` bis `9999.md`
- **Reihenfolge**: Niedrigere Nummer = zuerst eingeplant
- **Git**: Source of Truth für alle Tasks

### YAML Frontmatter (Pflicht)

```yaml
---
typ: task
kategorie: geschäftlich | privat
status: offen | abgeschlossen | abgebrochen
tags: [tag1, tag2]  # optional
deadline: dd.mm.yyyy  # optional
fixedSlot:  # optional
  datum: dd.mm.yyyy
  zeit: morgens | nachmittags | abends
---
```

### Markdown Body (Optional)

Freier Text für:
- Beschreibung
- Notizen
- Checklisten
- Links

## Pflichtfelder

1. **typ**: Muss `task` sein
2. **kategorie**: `geschäftlich` oder `privat`
3. **status**: `offen`, `abgeschlossen` oder `abgebrochen`

## Optionale Felder

- **tags**: Array von Strings
- **deadline**: Datum im Format `dd.mm.yyyy`
- **fixedSlot**: Objekt mit `datum` und `zeit` für feste Termine

## Timeline-Zuordnung

### Automatische Planung (ohne fixedSlot)

Tasks ohne `fixedSlot` werden automatisch nach Dateinamen-Reihenfolge eingeplant:

1. **Kategorie-Regeln**:
   - `geschäftlich`: Mo-Fr, morgens → nachmittags
   - `privat`: Sa-So, morgens → nachmittags
   - `abends`: nie automatisch, nur per fixedSlot

2. **Reihenfolge**: 
   - Niedrigere Dateinummer wird zuerst platziert
   - `0000.md` kommt vor `0001.md`, etc.

3. **Freie Slots finden**:
   - System sucht ab heute vorwärts
   - Respektiert Kategorie-Wochentage
   - Überspringt bereits belegte Slots

### Feste Termine (mit fixedSlot)

Tasks mit `fixedSlot` werden zuerst platziert:

```yaml
---
typ: task
kategorie: geschäftlich
status: offen
fixedSlot:
  datum: 15.10.2025
  zeit: morgens
---

# Sprint Planning Meeting

Vorbereitung für Q4 Sprint
```

### Domino-Logik bei Konflikten

Wenn ein Fixed Task einen Slot belegt:
1. **Fixed Tasks** bleiben stehen
2. **Nicht-fixe Tasks** werden verschoben:
   - morgens → nachmittags
   - nachmittags → abends
   - abends → nächster passender Tag

## Beispiele

### Einfacher Task

**Datei**: `tasks/0100.md`
```markdown
---
typ: task
kategorie: geschäftlich
status: offen
---

# Code Review durchführen

PR #123 checken und Feedback geben
```

### Task mit Deadline

**Datei**: `tasks/0050.md`
```markdown
---
typ: task
kategorie: privat
status: offen
deadline: 31.10.2025
tags: [finanzen, wichtig]
---

# Steuererklärung vorbereiten

- Belege sammeln
- ELSTER vorbereiten
- Termin mit Steuerberater
```

### Fester Termin

**Datei**: `tasks/0001.md`
```markdown
---
typ: task
kategorie: geschäftlich
status: offen
fixedSlot:
  datum: 10.10.2025
  zeit: nachmittags
---

# Kundenpräsentation Q4

Quartalsreview mit Key Account
```

## Task-Erstellung

### Option 1: API Endpoint (Empfohlen)

**POST** `/api/tasks`

```json
{
  "kategorie": "geschäftlich",
  "status": "offen",
  "deadline": "31.10.2025",
  "tags": ["meeting", "wichtig"],
  "fixedSlot": {
    "datum": "15.10.2025",
    "zeit": "morgens"
  },
  "body": "Sprint Planning Meeting\n\nVorbereitung für Q4 Sprint"
}
```

**Response:**
```json
{
  "ok": true,
  "id": "0042",
  "path": "codex-miroir/tasks/0042.md",
  "commitSha": "abc123...",
  "htmlUrl": "https://github.com/..."
}
```

**Idempotenz:** Header `Idempotency-Key: <uuid>` verhindert Doppel-Tasks bei Retries.

### Option 2: Git Workflow (Manuell)

```bash
# 1. Nächste freie Nummer finden
ls tasks/ | sort -n | tail -1

# 2. Neue Task-Datei erstellen
vim tasks/0042.md

# 3. Committen und pushen
git add tasks/0042.md
git commit -m "Add task 0042: Meeting vorbereiten"
git push
```

### Task abschließen

```bash
# Status auf 'abgeschlossen' setzen
vim tasks/0042.md  # status: abgeschlossen

git add tasks/0042.md
git commit -m "Complete task 0042"
git push
```

### Task löschen

```bash
# Task-Datei entfernen
git rm tasks/0042.md
git commit -m "Remove task 0042"
git push
```

## Automatischer Sync

Bei jedem Push zu GitHub:
1. GitHub Webhook triggert Azure Function
2. Azure Function pullt neue/geänderte Tasks
3. Timeline wird neu berechnet
4. Cache wird aktualisiert (neue ETag)

## Status-Management

### Offene Tasks
- `status: offen` → wird in Timeline eingeplant
- Erscheinen in der Wochenansicht

### Abgeschlossene Tasks
- `status: abgeschlossen` → nicht mehr in Timeline
- Bleiben im Git History für Audit

### Abgebrochene Tasks
- `status: abgebrochen` → nicht mehr in Timeline
- Ebenfalls im Git History

## Best Practices

1. **Nummerierung**: Lücken lassen (0000, 0010, 0020, ...) für spätere Einfügungen
2. **Kategorien konsistent**: Entweder `geschäftlich` oder `privat`, nicht wechseln
3. **Deadlines sparsam**: Nur für echte Deadlines, nicht für Wunschtermine
4. **Fixed Slots selten**: Nur für unverschiebbare Termine
5. **Tags minimal**: Max 2-3 relevante Tags pro Task
6. **Markdown nutzen**: Checklisten, Links, Code-Blocks für Details

## Validierung

Das System prüft beim Sync:
- ✅ Dateiname ist `####.md` Format
- ✅ YAML Frontmatter ist valide
- ✅ `typ: task` ist gesetzt
- ✅ `kategorie` ist `geschäftlich` oder `privat`
- ✅ `status` ist `offen`, `abgeschlossen` oder `abgebrochen`
- ✅ Wenn `fixedSlot` gesetzt: `datum` und `zeit` sind valide

Fehlerhafte Dateien werden ignoriert und im Log vermerkt.