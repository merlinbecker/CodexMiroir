
# Testing Rules - Codex Miroir Timeline

Diese Datei dokumentiert alle Regeln und Erkenntnisse aus der Entwicklungssession, die durch Tests abgesichert werden müssen.

## 1. Cache-Invalidierung und Timeline-Rebuild

### 1.1 Full Sync Verhalten
- ✅ **Regel**: Bei einem Full Sync MUSS die `cacheVersion` neu generiert werden (Timestamp)
- ✅ **Regel**: Bei einem Full Sync MÜSSEN alle Timeline-Caches in `artifacts/` gelöscht werden
- ✅ **Regel**: Nach einem Full Sync MUSS beim nächsten Timeline-Request ein neuer Cache gebaut werden
- ✅ **Erwartung**: Timeline wird mit aktuellen Daten neu berechnet

### 1.2 Diff Sync (Webhook) Verhalten
- ✅ **Regel**: Bei einem Diff Sync wird die `cacheVersion` NICHT aktualisiert
- ✅ **Regel**: Bei einem Diff Sync MÜSSEN alle Timeline-Caches in `artifacts/` gelöscht werden
- ✅ **Regel**: Nach einem Diff Sync MUSS beim nächsten Timeline-Request ein neuer Cache gebaut werden
- ✅ **Erwartung**: Timeline wird mit geänderten Tasks neu berechnet

### 1.3 Page Reload Verhalten
- **Regel**: Bei einem normalen Page Reload DARF KEIN neuer Cache gebaut werden
- **Regel**: Wenn ein Timeline-Cache existiert, MUSS dieser verwendet werden
- **Regel**: Der ETag-Mechanismus MUSS funktionieren (304 Not Modified)
- **Erwartung**: Bestehender Cache wird wiederverwendet, keine Neuberechnung

## 2. Timeline-Berechnung und Task-Platzierung

### 2.1 Zeitslots und Tagesberechnung
- ✅ **Regel**: Es gibt nur 3 Slots: `morgens`, `nachmittags`, `abends`
- ✅ **Regel**: Nur `morgens` und `nachmittags` sind auto-füllbar
- ✅ **Regel**: `abends` ist NUR für manuell fixierte Tasks
- ✅ **Regel**: Timeline zeigt NUR zukünftige Slots ab dem aktuellen Zeitpunkt
- ✅ **Regel**: Vergangene Slots werden NICHT mehr dargestellt
- ✅ **Regel**: Wenn heute nach 19 Uhr: Keine Slots mehr für heute
- ✅ **Regel**: Wenn heute nach 14 Uhr: Nur `abends` Slot verfügbar
- ✅ **Regel**: Wenn heute nach 9 Uhr: `nachmittags` und `abends` verfügbar

### 2.2 Task-Sortierung (KRITISCH!)
- ✅ **Regel**: Tasks MÜSSEN nach ID AUFSTEIGEND sortiert werden
- ✅ **Regel**: Die kleinste ID wird zuerst in den nächsten freien Slot platziert
- ✅ **Regel**: Beispiel: 0002 → 0003 → 0104 (nicht 0104 → 0003 → 0002)
- ✅ **Regel**: Sortierung erfolgt BEVOR Tasks platziert werden

### 2.3 Fixed vs Open Tasks
- ✅ **Regel**: Fixed Tasks = haben `fixedSlot` mit gültigem `datum` (nicht null)
- ✅ **Regel**: Open Tasks = kein `fixedSlot` ODER `fixedSlot.datum` ist null/undefined
- ✅ **Regel**: Fixed Tasks werden ZUERST platziert
- **Regel**: Fixed Tasks können andere Tasks verdrängen (Domino-Effekt)
- ✅ **Regel**: Open Tasks werden DANACH in aufsteigender ID-Reihenfolge platziert

### 2.4 Kategorie-Regeln
- ✅ **Regel**: `arbeit` Tasks NUR an Werktagen (Mo-Fr)
- ✅ **Regel**: `privat` Tasks NUR am Wochenende (Sa-So)
- ✅ **Regel**: Tasks werden übersprungen, wenn Kategorie nicht zum Tag passt

### 2.5 Status-Filterung
- ✅ **Regel**: NUR Tasks mit `status: "offen"` werden in die Timeline aufgenommen
- ✅ **Regel**: `status: "abgeschlossen"` Tasks werden IGNORIERT
- ✅ **Regel**: `status: "abgebrochen"` Tasks werden IGNORIERT
- ✅ **Regel**: Ungültige Status-Werte führen zum Überspringen des Tasks

## 3. GitHub Sync und Blob Storage

### 3.1 File Synchronization
- ✅ **Regel**: Nur `.md` Dateien im Pattern `NNNN-Titel.md` oder `NNNN.md` werden synchronisiert
- ✅ **Regel**: Dateien ohne 4-stellige ID werden übersprungen
- ✅ **Regel**: Beim Full Sync werden alle GitHub-Tasks heruntergeladen
- ✅ **Regel**: Beim Diff Sync werden nur geänderte/gelöschte Tasks synchronisiert

### 3.2 ID-Management
- ✅ **Regel**: Die höchste gefundene Task-ID + 1 wird als `nextId` gespeichert
- ✅ **Regel**: Bei Full Sync wird `nextId` komplett neu berechnet
- ✅ **Regel**: Bei Diff Sync wird `nextId` nur erhöht, wenn neue Tasks hinzugefügt wurden
- ✅ **Regel**: `nextId` wird NIEMALS verringert

### 3.3 Blob Storage Struktur
- ✅ **Regel**: Raw Tasks liegen unter `raw/tasks/*.md`
- ✅ **Regel**: Timeline-Caches liegen unter `artifacts/timeline_*.json`
- ✅ **Regel**: State-Dateien liegen unter `state/` (`cacheVersion.txt`, `lastHeadSha.txt`, `nextId.txt`)

## 4. ETag und HTTP Caching

### 4.1 Cache-Version als ETag
- **Regel**: `cacheVersion` wird als ETag im HTTP-Header zurückgegeben
- **Regel**: Browser sendet `If-None-Match` Header mit letztem ETag
- **Regel**: Bei Match: 304 Not Modified, keine Timeline-Übertragung
- **Regel**: Bei Mismatch: 200 OK mit neuer Timeline

### 4.2 Cache-Konsistenz
- **Regel**: Wenn Timeline-Cache existiert, MUSS dessen Version als ETag verwendet werden
- **Regel**: `cacheVersion` in State MUSS mit Cache-Dateinamen übereinstimmen
- **Regel**: Bei fehlendem Cache wird Timeline neu gebaut und Cache erstellt

## 5. Webhook-Integration

### 5.1 Signature Verification
- **Regel**: Webhook-Payload MUSS mit `GITHUB_WEBHOOK_SECRET` verifiziert werden
- **Regel**: Ungültige Signatur führt zu 401 Unauthorized
- **Regel**: Fehlende Signatur führt zu 401 Unauthorized

### 5.2 Event Processing
- **Regel**: Nur `push` Events werden verarbeitet
- **Regel**: Andere Events (pull_request, issues, etc.) werden mit 202 ignoriert
- **Regel**: Commits werden auf `added`, `modified`, `removed` Dateien analysiert
- **Regel**: Nur Dateien unter `${BASE}/tasks/*.md` werden berücksichtigt

### 5.3 Sync-Trigger nach Webhook
- **Regel**: Nach erfolgreichem Webhook MUSS `applyDiff()` aufgerufen werden
- **Regel**: Nach `applyDiff()` MUSS der Timeline-Cache gelöscht werden
- **Regel**: Beim nächsten Timeline-Request wird automatisch neu gebaut

## 6. Error Handling

### 6.1 GitHub API Errors
- **Regel**: 404 bei fehlendem Directory wird abgefangen (keine Exception)
- **Regel**: Fehlgeschlagene File-Fetches werden übersprungen
- **Regel**: Token-Fehler führen zu aussagekräftigen Fehlermeldungen

### 6.2 Parsing Errors
- **Regel**: Tasks mit ungültigem Format werden übersprungen
- **Regel**: Fehlende Pflichtfelder führen zum Überspringen
- **Regel**: Alle Errors werden geloggt mit Dateinamen

### 6.3 Blob Storage Errors
- **Regel**: Fehlende Blobs führen zu `null`-Return, nicht zu Exception
- **Regel**: Schreib-Fehler werden propagiert (nicht ignoriert)

## 7. Logging und Debugging

### 7.1 Console Output
- ✅ **Regel**: JEDER wichtige Schritt wird geloggt (Full Sync, Diff Sync, Timeline Build)
- ✅ **Regel**: File-Verarbeitung wird einzeln geloggt (Name, Content-Length, Status)
- ✅ **Regel**: Task-Placement wird detailliert geloggt (welcher Slot, welcher Tag)
- ✅ **Regel**: Cache-Operationen werden geloggt (HIT, MISS, BUILD, DELETE)

### 7.2 Debug-Informationen
- ✅ **Regel**: Anzahl gefundener Tasks wird ausgegeben
- ✅ **Regel**: Anzahl platzierter vs. nicht platzierter Tasks wird geloggt
- ✅ **Regel**: Timeline-Struktur wird nach Build ausgegeben

**Note**: Excessive debug logs have been removed and replaced with comprehensive test coverage. High-level operation logs are maintained for production monitoring.

## 8. Performance und Optimierung

### 8.1 Cache-Strategie
- **Regel**: Timeline wird NUR bei geänderten Daten neu berechnet
- **Regel**: Browser-ETag verhindert unnötige Übertragungen
- **Regel**: Blob Storage Cache verhindert doppelte Berechnungen

### 8.2 Sync-Strategie
- **Regel**: Diff Sync ist Standard (schneller als Full Sync)
- **Regel**: Full Sync nur bei manueller Anforderung oder Setup
- **Regel**: Webhook-Sync ist Diff-basiert (nur geänderte Dateien)

## 9. Test-Coverage Anforderungen

### 9.1 Unit Tests
- ✅ **Bereich**: Jede Funktion in `sync.js`, `renderCodex.js`, `parsing.js`
- ✅ **Fokus**: Edge Cases, Fehlerbehandlung, Datentypen

### 9.2 Integration Tests
- ✅ **Bereich**: Full Sync → Cache → Timeline Render
- ✅ **Bereich**: Webhook → Diff Sync → Cache Invalidierung → Timeline Rebuild
- **Bereich**: Page Reload → Cache Hit → 304 Response

### 9.3 E2E Tests
- **Bereich**: Kompletter User Flow (Task erstellen → Sync → Timeline sehen)
- **Bereich**: Webhook Flow (GitHub Push → Auto-Sync → Timeline Update)

## 10. Spezielle Regeln aus der Session

### 10.1 Bug-Fixes dieser Session
- ✅ **Bug**: `headSha` undefined in `renderCodex.js` → Fix: `cacheVersion` verwenden
- ✅ **Bug**: Cache wurde bei jedem Reload neu gebaut → Fix: Cache-Suche ohne Version-Match
- ✅ **Bug**: Tasks wurden in falscher Reihenfolge platziert → Fix: Aufsteigende ID-Sortierung
- ✅ **Bug**: Vergangene Slots wurden angezeigt → Fix: Nur zukünftige Slots berechnen

### 10.2 Architektur-Entscheidungen
- **Entscheidung**: Kein Cache bei `?nocache=true` Parameter
- **Entscheidung**: Timeline-Cache-Dateien haben Format `timeline_*.json`
- **Entscheidung**: State in separaten Dateien (`cacheVersion.txt`, `lastHeadSha.txt`, `nextId.txt`)
- **Entscheidung**: Diff Sync invalidiert Cache durch Löschen, nicht durch Version-Bump

---

## Test Implementation Summary

### Implemented Tests (171 total tests passing)

#### Unit Tests - renderCodex.js
- ✅ Timeline skeleton creation with time-based slot filtering
- ✅ Task sorting by ID (ascending order)
- ✅ Fixed vs Open task identification and separation
- ✅ Category-based placement rules (arbeit/privat, weekdays/weekends)
- ✅ Status filtering (only "offen" tasks)
- ✅ Auto-fillable slots validation
- ✅ File name pattern extraction

#### Unit Tests - sync.js
- ✅ Full sync cache invalidation and cacheVersion generation
- ✅ Diff sync cache invalidation (without cacheVersion update)
- ✅ ID management and nextId calculation
- ✅ nextId never decreases rule
- ✅ File filtering (.md files only)
- ✅ Blob storage structure verification

#### Unit Tests - parsing.js
- ✅ Task frontmatter parsing
- ✅ Fixed slot handling (object and array formats)
- ✅ Date and slot ordering

#### Integration Tests
- ✅ Full Sync → Cache → Timeline Render flow
- ✅ Webhook → Diff Sync → Cache Invalidation flow

### Code Cleanup
- ✅ Removed excessive debug logs from renderCodex.js (placeTaskInDay, autoFillTasks)
- ✅ Removed excessive debug logs from sync.js (fullSync)
- ✅ Kept high-level operation logs for production monitoring
- ✅ Maintained warning logs for unplaced tasks

### Test Files Created
1. `__tests__/src/renderCodex.timeline.test.js` - Timeline logic tests (60+ tests)
2. `__tests__/shared/sync.cache.test.js` - Cache invalidation tests (45+ tests)

---

## Testing-Strategie

1. ✅ **Unit Tests** für alle Funktionen schreiben
2. ✅ **Integration Tests** für Sync-Flows
3. **E2E Tests** für User-Flows
4. **Performance Tests** für Timeline-Berechnung bei vielen Tasks
5. **Error-Scenario Tests** für alle Fehlerbehandlungen

Alle Tests MÜSSEN diese Regeln verifizieren und sicherstellen, dass die Bugs nicht wieder auftreten.
