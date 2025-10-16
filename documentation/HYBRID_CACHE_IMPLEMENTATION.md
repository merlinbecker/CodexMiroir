# Hybrid Cache Implementation - Summary

**Datum:** 2025-10-11  
**Branch:** copilot/change-authentication-to-oauth2  
**Status:** ✅ Implemented

---

## 🎯 Implementierte Features

### 1. **User-spezifische Cache-Invalidierung**

**File:** `shared/storage.js`

```javascript
// NEU: Invalidiert nur betroffenen User
async function invalidateCacheForUser(userId)

// DEPRECATED: Alte globale Invalidierung (für Migration)
async function invalidateCache()
```

**Vorteile:**
- ✅ User-Isolation: User A's Änderungen invalidieren nicht User B's Cache
- ✅ Performance: Weniger Cache-Rebuilds
- ✅ Skalierbar: Jeder User hat eigenen Cache-Lifecycle

---

### 2. **Dual-Layer Cache mit TTL**

**File:** `src/renderCodex.js`

**Architektur:**
```
┌─────────────────────────────────────────┐
│  Layer 1: Local Memory (1-5ms)         │
│  - TTL: 5 Minuten                       │
│  - Flüchtig (Cold Start → weg)         │
│  - Pro Function-Instance                │
└────────────┬────────────────────────────┘
             │ MISS
             ▼
┌─────────────────────────────────────────┐
│  Layer 2: Blob Storage (100ms)         │
│  - TTL: 15 Minuten                      │
│  - Persistent (überlebt Cold Start)     │
│  - artifacts/userId/timeline.json       │
└────────────┬────────────────────────────┘
             │ MISS
             ▼
┌─────────────────────────────────────────┐
│  Layer 3: Rebuild from Storage (2-5s)  │
│  - Liest: raw/userId/tasks/*.md        │
│  - Baut Timeline neu auf                │
│  - KEIN Git-Pull nötig!                 │
└─────────────────────────────────────────┘
```

**Features:**
- ✅ TTL-basierte Validierung (statt stündlicher Cache-Version)
- ✅ Automatische Invalidierung nach 15 Min
- ✅ Local Memory Layer für ultra-schnelle Responses
- ✅ Keine ETag-basierte Client-Caching mehr (Server managed Cache)

**Entfernt:**
- ❌ Stündliche Cache-Version (`_YYYYMMDD_HH`)
- ❌ `getCacheVersion()` Function
- ❌ ETag HTTP Header

---

### 3. **Git-Push-Logik korrigiert**

**Files:** `src/createTask.js`, `src/updateTask.js`, `src/completeTask.js`

**Neue Logik:**
```javascript
const hasGitConfig = OWNER && REPO && TOKEN;

if (hasGitConfig) {
  if (VIA_PR === true) {
    → Erstelle Feature-Branch
    → Commit zu Branch
    → Öffne Pull Request
  } else {
    → Commit direkt zu main/default branch
  }
} else {
  → Nur Storage-Update (kein Git)
}
```

**Klarstellung:**
- ✅ **Git-Push passiert IMMER** (außer keine Config)
- ✅ **VIA_PR** steuert nur: PR vs. Direct Push
- ✅ **Storage-Only Mode:** Wenn OWNER/REPO/TOKEN fehlen

**Response-Felder:**
```json
{
  "ok": true,
  "id": "0042",
  "gitPushed": true,  // NEU: Boolean Flag
  "commitSha": "abc123...",
  "htmlUrl": "https://github.com/...",
  "prUrl": "https://github.com/.../pull/123",  // Nur wenn VIA_PR=true
  "prNumber": 123  // Nur wenn VIA_PR=true
}
```

---

### 4. **Webhook mit User-Extraktion**

**File:** `src/githubWebhook.js`

**Neue Logik:**
1. Parse Commit-Payload
2. Extrahiere `userId` aus jedem geänderten Pfad
   - Pattern: `codex-miroir/userId/tasks/NNNN-Title.md`
   - Extract: `userId`
3. Gruppiere Änderungen nach `userId`
4. Pro User:
   - `applyDiff()` → Sync Storage
   - `invalidateCacheForUser(userId)` → Invalidiere nur diesen User
5. Return: Array mit Results pro User

**Vorteile:**
- ✅ User-Isolation: Webhook invalidiert nur betroffene User
- ✅ Multi-User-Push: Ein Commit kann mehrere User betreffen
- ✅ Detailliertes Logging: Welcher User, wie viele Files

**Response:**
```json
{
  "ok": true,
  "head": "abc123...",
  "usersAffected": 2,
  "results": [
    {
      "userId": "userA",
      "filesChanged": 3,
      "cacheInvalidation": { "userId": "userA", "cacheCleared": 1 },
      "changed": 3,
      "removed": 0
    },
    {
      "userId": "userB",
      "filesChanged": 1,
      "cacheInvalidation": { "userId": "userB", "cacheCleared": 1 },
      "changed": 1,
      "removed": 0
    }
  ]
}
```

---

## 🔄 Sync-Strategie

### **Git-Sync passiert bei:**

1. ✅ **Task-Operationen** (create/update/complete)
   - Wenn `hasGitConfig`: Git-Push (PR oder Direct)
   - Storage-Update: Immer
   - Cache-Invalidierung: Nur betroffener User

2. ✅ **Webhook** (GitHub → Azure)
   - Trigger: Push von anderem Gerät
   - Sync: GitHub → Storage (nur geänderte Files)
   - Cache-Invalidierung: Nur betroffene User

3. ✅ **Manual Sync** (User-Request)
   - Trigger: User klickt "Sync"-Button
   - Sync: Full oder Diff (GitHub → Storage)
   - Cache-Invalidierung: Anfragender User

### **Rebuild passiert bei:**

- Cache MISS (Memory + Blob)
- Cache EXPIRED (> TTL)
- Nach Cache-Invalidierung

**Wichtig:** Rebuild ≠ Sync!
- Rebuild: Liest aus **Storage** (nicht Git!)
- Sync: Lädt von **GitHub** (nur bei Events)

---

## 📊 Performance-Erwartungen

| Operation | Latenz (erwartet) | Storage I/O | Git-Calls |
|-----------|-------------------|-------------|-----------|
| **Timeline Render (Local HIT)** | 1-5ms | 0 | 0 |
| **Timeline Render (Blob HIT)** | 50-100ms | 1 read | 0 |
| **Timeline Render (MISS)** | 2-5s | 50-500 reads | 0 |
| **Task Create** | 500ms-2s | 1 write | 1-2 (PR/Direct) |
| **Task Update** | 500ms-2s | 1 read + 1 write | 2-3 (PR/Direct) |
| **Task Complete** | 500ms-2s | 1 read + 1 write | 2-3 (PR/Direct) |
| **Webhook** | 5-10s | 1-100 writes | 1-100 |

---

## 🧪 Test-Plan

### Test 1: **Cache-HIT Performance**

**Ziel:** Verifiziere Local Memory Cache

```bash
# Setup
curl -X POST https://.../api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"kategorie":"arbeit","body":"Test Task"}'

# Test
time curl -H "Authorization: Bearer $TOKEN" https://.../codex
# Expected: 1-5ms (Local HIT)

time curl -H "Authorization: Bearer $TOKEN" https://.../codex
# Expected: 1-5ms (Local HIT again)
```

**Erwartung:**
- 1. Request: Blob HIT oder MISS (50-100ms oder 2-5s)
- 2. Request: Local HIT (1-5ms)
- Log: `[renderCodex] Local cache HIT for {userId}`

---

### Test 2: **Cache-MISS & Rebuild**

**Ziel:** Verifiziere Rebuild from Storage

```bash
# Trigger Cache-Invalidierung
curl -X POST https://.../api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"kategorie":"arbeit","body":"Test Task 2"}'

# Timeline rendern (Cache invalidiert)
time curl -H "Authorization: Bearer $TOKEN" https://.../codex
# Expected: 2-5s (MISS → Rebuild)
```

**Erwartung:**
- Log: `[renderCodex] Cache MISS for {userId} - rebuild required`
- Log: `[renderCodex] Building timeline for {userId} from storage...`
- Response: Enthält neue Task
- Duration: 2-5 Sekunden

---

### Test 3: **TTL-Expiry**

**Ziel:** Verifiziere automatische Invalidierung nach 15 Min

```bash
# 1. Erstelle Task → Cache wird aufgebaut
curl -X POST https://.../api/tasks ...

# 2. Rendere Timeline (Cache HIT)
curl https://.../codex
# Expected: Local/Blob HIT

# 3. Warte 16 Minuten (oder setze TTL für Test auf 10 Sekunden)

# 4. Rendere Timeline (Cache EXPIRED)
curl https://.../codex
# Expected: MISS → Rebuild
```

**Erwartung:**
- Log: `[renderCodex] Blob cache EXPIRED for {userId} (age: 960s > TTL: 900s)`
- Rebuild passiert automatisch

---

### Test 4: **User-Isolation**

**Ziel:** Verifiziere dass User A's Änderungen nicht User B's Cache invalidieren

```bash
# User A: Erstelle Task
curl -X POST https://.../api/tasks \
  -H "Authorization: Bearer $TOKEN_A" \
  -d '{"kategorie":"arbeit","body":"User A Task"}'

# User B: Rendere Timeline (sollte NICHT invalidiert sein)
curl -H "Authorization: Bearer $TOKEN_B" https://.../codex
# Expected: Cache HIT (User B unberührt)
```

**Erwartung:**
- User A: Log `[createTask] Cache invalidated for user userA`
- User B: Log `[renderCodex] Local cache HIT for userB` oder `Blob cache HIT`
- User B's Cache wurde NICHT gelöscht

---

### Test 5: **Git-Push-Verhalten**

**Ziel:** Verifiziere Git-Push je nach Konfiguration

**Test 5a: Mit GitHub Config, VIA_PR=false**
```bash
# ENV: GITHUB_OWNER=..., GITHUB_REPO=..., GITHUB_TOKEN=..., CREATE_VIA_PR=false

curl -X POST https://.../api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"kategorie":"arbeit","body":"Direct Push Test"}'
```

**Erwartung:**
- Response: `"gitPushed": true`
- Response: `"commitSha": "abc123..."`
- Response: NO `prUrl` / `prNumber`
- Log: `[createTask] Pushing to GitHub (VIA_PR: false)`
- GitHub: Commit direkt auf main branch

**Test 5b: Mit GitHub Config, VIA_PR=true**
```bash
# ENV: CREATE_VIA_PR=true

curl -X POST https://.../api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"kategorie":"arbeit","body":"PR Test"}'
```

**Erwartung:**
- Response: `"gitPushed": true`
- Response: `"prUrl": "https://github.com/.../pull/123"`
- Response: `"prNumber": 123`
- Log: `[createTask] Pushing to GitHub (VIA_PR: true)`
- GitHub: Pull Request erstellt

**Test 5c: Ohne GitHub Config**
```bash
# ENV: Entferne GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN

curl -X POST https://.../api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"kategorie":"arbeit","body":"Storage Only Test"}'
```

**Erwartung:**
- Response: `"gitPushed": false`
- Response: NO `commitSha`, `htmlUrl`, `prUrl`
- Log: `[createTask] No GitHub config found - skipping Git push (storage-only mode)`
- Storage: File gespeichert in `raw/userId/tasks/*.md`

---

### Test 6: **Webhook Multi-User**

**Ziel:** Verifiziere User-spezifische Webhook-Invalidierung

**Setup:**
1. User A und User B haben jeweils Tasks
2. User A pusht von Mobile (direkt zu GitHub)
3. GitHub sendet Webhook mit Commits für User A

**Test:**
```bash
# Simuliere Webhook (oder trigger via echtem Push)
curl -X POST https://.../github/webhook \
  -H "X-Hub-Signature-256: sha256=..." \
  -H "X-GitHub-Event: push" \
  -d '{
    "after": "abc123...",
    "commits": [{
      "modified": ["codex-miroir/userA/tasks/0042-Updated.md"]
    }]
  }'
```

**Erwartung:**
- Response: `"usersAffected": 1`
- Response: `"results": [{"userId": "userA", "filesChanged": 1, ...}]`
- Log: `[Webhook] User userA: 1 added/modified, 0 removed`
- Log: `[Webhook] Cache invalidated for user userA`
- Log: NO mention of userB
- User B's Cache bleibt intakt

**Verifikation:**
```bash
# User A: Timeline rendern (Cache invalidiert)
curl -H "Authorization: Bearer $TOKEN_A" https://.../codex
# Expected: MISS → Rebuild (zeigt Updates)

# User B: Timeline rendern (Cache HIT)
curl -H "Authorization: Bearer $TOKEN_B" https://.../codex
# Expected: HIT (keine Invalidierung)
```

---

### Test 7: **Cold Start Recovery**

**Ziel:** Verifiziere dass Blob Cache Cold Start überlebt

**Simulation:**
```bash
# 1. Rendere Timeline (baut Cache auf)
curl -H "Authorization: Bearer $TOKEN" https://.../codex

# 2. Simuliere Cold Start (restart Function oder warte auf Azure Recycling)
# (kann nicht manuell getriggert werden, aber passiert automatisch bei Inaktivität)

# 3. Rendere Timeline erneut
curl -H "Authorization: Bearer $TOKEN" https://.../codex
```

**Erwartung:**
- Local Memory Cache: MISS (leer nach Cold Start)
- Blob Storage Cache: HIT (überlebt Cold Start)
- Log: `[renderCodex] Local cache HIT for {userId}` → NEIN
- Log: `[renderCodex] Blob cache HIT for {userId}` → JA
- Duration: ~100ms (Blob read, nicht Rebuild)

---

### Test 8: **nocache Parameter**

**Ziel:** Verifiziere Cache-Bypass

```bash
# Mit Cache
curl -H "Authorization: Bearer $TOKEN" https://.../codex
# Expected: HIT (schnell)

# Ohne Cache
curl -H "Authorization: Bearer $TOKEN" "https://.../codex?nocache=true"
# Expected: MISS → Rebuild (langsam)
```

**Erwartung:**
- Log: `[renderCodex] Cache BYPASS requested for {userId}`
- Log: `[renderCodex] Building timeline for {userId} from storage...`
- Duration: 2-5 Sekunden (trotz vorhandenem Cache)

---

## 🐛 Known Issues / Limitations

### 1. **Multi-Instance Local Cache Inconsistency**

**Problem:**
- Local Memory Cache ist pro Function-Instance
- Bei horizontaler Skalierung: Mehrere Instanzen
- User trifft verschiedene Instanzen → verschiedene Local Caches

**Impact:** Gering
- Blob Cache ist konsistent (shared)
- Worst-case: Cache MISS auf anderer Instanz → Blob HIT (100ms)
- Nur bei hoher Last (>1000 req/min) relevant

**Mitigation (falls nötig):**
- Azure Redis Cache als Distributed Cache
- Sticky Sessions (Azure Front Door)

### 2. **TTL-Check bei jedem Request**

**Problem:**
- `cacheCreatedAt` muss geparst werden (JSON)
- Timestamp-Vergleich bei jedem Request

**Impact:** Minimal
- Nur bei Cache HIT relevant
- Parsing + Vergleich: <1ms

**Mitigation:** Already optimal

### 3. **Storage-Only Mode Edge Cases**

**Problem:**
- Wenn User update/complete ohne Git-Config macht
- Dann von anderem Gerät mit Git-Config: Conflict möglich

**Impact:** Selten
- Nur wenn User zwischen Devices mit/ohne Git-Config wechselt

**Mitigation:**
- Dokumentation: Entweder IMMER Git oder IMMER Storage-only
- Manual Sync überschreibt Storage mit Git (conflict resolution)

---

## 📝 Migration Notes

### Breaking Changes

1. **Cache-Artefakt-Pfad geändert**
   - ALT: `artifacts/timeline_<version>.json` (global)
   - NEU: `artifacts/userId/timeline.json` (user-spezifisch)
   - **Action:** Alte Caches werden ignoriert, bei Bedarf löschen

2. **Keine ETag-basierte Client-Caching mehr**
   - ALT: ETag Header mit `If-None-Match` → 304
   - NEU: `Cache-Control: no-cache` → immer 200
   - **Action:** Client muss nicht angepasst werden (Server managed Cache)

3. **Response-Format geändert (Task-Operations)**
   - NEU: `"gitPushed": boolean` Flag
   - NEU: `"filename": string` (bei createTask)
   - **Action:** Frontend kann optional auswerten

### Backward Compatibility

- ✅ `invalidateCache()` bleibt als deprecated verfügbar
- ✅ Alte Cache-Artefakte werden ignoriert (nicht gelöscht)
- ✅ API-Endpoints unverändert
- ✅ Response-Format erweitert (nicht breaking)

---

## 🚀 Deployment Checklist

- [x] Code implementiert und committed
- [ ] Tests durchgeführt (siehe Test-Plan oben)
- [ ] Dokumentation aktualisiert
- [ ] ENV-Variablen geprüft:
  - `GITHUB_OWNER` (optional, für Git-Push)
  - `GITHUB_REPO` (optional, für Git-Push)
  - `GITHUB_TOKEN` (optional, für Git-Push)
  - `CREATE_VIA_PR` (optional, default: false)
  - `GITHUB_WEBHOOK_SECRET` (für Webhook-Verifikation)
- [ ] Azure Function App neu deployen
- [ ] Alte Cache-Artefakte optional löschen (Cleanup)
- [ ] Monitoring: Cache-HIT-Rate, Rebuild-Frequency, Response-Times

---

## 📚 Weitere Dokumentation

- [IN_MEMORY_CACHE_ANALYSIS.md](./IN_MEMORY_CACHE_ANALYSIS.md) - Architektur-Vergleich
- [GIT_SYNC_STRATEGY.md](./GIT_SYNC_STRATEGY.md) - Git-Sync-Details
- [CACHE_INVALIDATION_SUMMARY.md](./CACHE_INVALIDATION_SUMMARY.md) - Alte Implementation (deprecated)

---

## ✅ Fertig!

Der Hybrid-Cache-Ansatz ist vollständig implementiert:
- ✅ User-spezifische Cache-Invalidierung
- ✅ Dual-Layer Cache (Memory + Blob) mit TTL
- ✅ Git-Push bei allen Task-Operationen (außer no-config)
- ✅ Webhook mit User-Extraktion
- ✅ Storage-Only Mode für Users ohne Git-Config

**Nächste Schritte:** Test-Plan durchführen und Deployment vorbereiten.
