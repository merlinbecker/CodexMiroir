# Git-Sync-Strategie im Hybrid-Cache-Ansatz

**Datum:** 2025-10-11  
**Kontext:** Git-Sync-Verhalten mit User-spezifischem Cache und TTL  

---

## 🎯 Kernfrage

**Wie oft Git-Sync?**
- Alle 15 Minuten (periodisch)?
- Nur nach Änderung (on-demand)?
- Beides?

**Was passiert mit dem Webhook?**
- Wie invalidiert er den Cache?
- Wie verhält er sich bei Multi-User?

---

## 📊 Aktuelle Git-Sync-Mechanismen

### 1. **Webhook-basierter Sync** (Push von GitHub → Azure)

```javascript
// src/githubWebhook.js
// Trigger: GitHub Push Event
// Flow:
GitHub Push → Webhook Endpoint → applyDiff → Update Storage → Invalidate Cache
```

**Was passiert:**
1. User pusht von anderem Gerät (z.B. Mobile, CLI)
2. GitHub sendet Push-Event an Azure Function
3. Webhook identifiziert geänderte Task-Files
4. `applyDiff()`: Updated Storage (`raw/tasks/*.md`)
5. **Cache-Invalidierung:** Löscht ALLE Timeline-Artefakte

**Problem im aktuellen System:**
- Webhook invalidiert **global** (alle User)
- Auch wenn nur User A gepusht hat, wird Cache von User B gelöscht

### 2. **Manual Sync** (User-initiated)

```javascript
// src/manualSync.js
// Trigger: User klickt "Sync" in UI
// Modi:
// - full: Kompletter Download von GitHub → Storage
// - diff: Nur Änderungen seit letztem Sync
```

**Wann notwendig:**
- User arbeitet auf mehreren Geräten
- User editiert Tasks direkt in GitHub
- Nach Cold-Start (für frische Daten)

### 3. **Auto-Sync bei Task-Operationen** (Azure → GitHub)

```javascript
// src/createTask.js, updateTask.js, completeTask.js
// Nach Task-Operation:
1. Update Storage (raw/tasks/*.md)
2. Optional: Push zu GitHub (wenn VIA_PR=true)
3. Invalidate Cache
```

---

## 🔄 Empfohlene Git-Sync-Strategie (Hybrid-Ansatz)

### Grundprinzip: **"Lazy Sync + Event-driven Invalidation"**

```
┌─────────────────────────────────────────────────────────┐
│  Sync-Strategie                                         │
├─────────────────────────────────────────────────────────┤
│  1. Task-Operation (create/update/complete)             │
│     → Sofort: Storage Update                            │
│     → Optional: Git Push (wenn aktiviert)               │
│     → Invalidate: NUR betroffener User-Cache            │
│                                                          │
│  2. Webhook (GitHub → Azure)                            │
│     → Parse: Welcher User betroffen? (aus path)         │
│     → Update: Storage für betroffenen User              │
│     → Invalidate: NUR betroffenen User-Cache            │
│                                                          │
│  3. Timeline-Render                                     │
│     → Check: Cache valid? (TTL, Version)                │
│     → Miss: Rebuild from Storage (kein Git-Pull!)       │
│     → Optional: Background-Sync wenn Cache älter 15min  │
│                                                          │
│  4. Manual Sync (User-Request)                          │
│     → Full-Sync: GitHub → Storage                       │
│     → Invalidate: Betroffenen User-Cache                │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Detaillierte Sync-Szenarien

### Szenario 1: **User erstellt Task in Web-UI**

```
User A: Erstellt Task 0042 in Web-UI (renderCodex anzeige)

┌─────────────────────────────────────────────────────┐
│ createTask.js                                       │
├─────────────────────────────────────────────────────┤
│ 1. Generiere Task-File (0042-Titel.md)             │
│ 2. Speichere in Storage: raw/userA/tasks/0042-*.md │
│ 3. Optional: Push zu GitHub (wenn VIA_PR=true)     │
│ 4. Invalidiere Cache: artifacts/userA/timeline_*.json │
│ 5. Return Success                                   │
└─────────────────────────────────────────────────────┘

User A: Rendert Timeline
┌─────────────────────────────────────────────────────┐
│ renderCodex.js                                      │
├─────────────────────────────────────────────────────┤
│ 1. Check Local Memory: MISS (invalidiert)          │
│ 2. Check Blob Cache: MISS (invalidiert)            │
│ 3. Rebuild: Lese raw/userA/tasks/* (inkl. 0042)    │
│ 4. Build Timeline mit Task 0042                     │
│ 5. Cache: artifacts/userA/timeline.json + Local    │
│ 6. Return Timeline                                  │
└─────────────────────────────────────────────────────┘

User B: Rendert Timeline (parallel)
┌─────────────────────────────────────────────────────┐
│ renderCodex.js                                      │
├─────────────────────────────────────────────────────┤
│ 1. Check Local Memory: HIT (User B unverändert)    │
│ 2. Return Cached Timeline (keine Invalidierung!)   │
└─────────────────────────────────────────────────────┘
```

**Key-Point:** ✅ User B's Cache wird NICHT invalidiert (User-Isolation)

---

### Szenario 2: **User pusht von Mobile/CLI → Webhook**

```
User A: Pusht Task-Update von Mobile-App direkt zu GitHub

GitHub: Push-Event → Azure Webhook
┌─────────────────────────────────────────────────────┐
│ githubWebhook.js                                    │
├─────────────────────────────────────────────────────┤
│ 1. Parse Payload:                                   │
│    - commits[0].modified: [                         │
│        "codex-miroir/userA/tasks/0042-Update.md"    │
│      ]                                              │
│ 2. Extract userId: "userA" (from path)             │
│ 3. applyDiff(paths, ref, userId="userA")           │
│    → Fetch updated file from GitHub                │
│    → Update Storage: raw/userA/tasks/0042-*.md     │
│ 4. Invalidiere Cache: NUR artifacts/userA/*        │
│ 5. Update state/userA/lastHeadSha.txt              │
└─────────────────────────────────────────────────────┘

User A: Rendert Timeline (nächster Request)
┌─────────────────────────────────────────────────────┐
│ renderCodex.js                                      │
├─────────────────────────────────────────────────────┤
│ 1. Check Local Memory: MISS (Webhook invalidierte) │
│ 2. Check Blob Cache: MISS (Webhook invalidierte)   │
│ 3. Rebuild: Lese raw/userA/tasks/* (neue Daten)    │
│ 4. Return Timeline mit Updates                      │
└─────────────────────────────────────────────────────┘
```

**Verbesserung gegenüber aktuell:**
- Webhook extrahiert `userId` aus geänderten Pfaden
- Invalidiert **nur** betroffene User-Caches
- User B's Cache bleibt unberührt

---

### Szenario 3: **Cache-TTL läuft ab (15 Minuten)**

```
User A: Hat seit 20 Minuten keine Änderungen gemacht
User A: Rendert Timeline

┌─────────────────────────────────────────────────────┐
│ renderCodex.js                                      │
├─────────────────────────────────────────────────────┤
│ 1. Check Local Memory: HIT                         │
│    → validUntil: 12:05 (jetzt: 12:22)              │
│    → ❌ EXPIRED (> 5 Min)                           │
│                                                      │
│ 2. Check Blob Cache: HIT                           │
│    → cacheCreatedAt: 12:00 (jetzt: 12:22)          │
│    → ❌ EXPIRED (> 15 Min)                          │
│                                                      │
│ 3. Background-Sync (optional):                      │
│    → Check GitHub: state/userA/lastHeadSha.txt      │
│    → Compare mit aktuellem HEAD                     │
│    → Wenn unterschiedlich: applyDiff()              │
│                                                      │
│ 4. Rebuild: Lese raw/userA/tasks/*                 │
│ 5. Cache: artifacts/userA/timeline.json + Local    │
│ 6. Return Timeline                                  │
└─────────────────────────────────────────────────────┘
```

**Key-Points:**
- TTL = 15 Min für Blob Cache (konfigurierbar)
- TTL = 5 Min für Local Memory (kürzer, da flüchtig)
- **Optional:** Background-Sync prüft GitHub bei TTL-Expiry
- **Oder:** Nur rebuild from Storage (keine GitHub-Calls)

---

### Szenario 4: **Manual Sync (User klickt "Sync")**

```
User A: Klickt "Sync"-Button in UI

┌─────────────────────────────────────────────────────┐
│ manualSync.js (mode=full)                           │
├─────────────────────────────────────────────────────┤
│ 1. fullSync(BRANCH, clean=true, userId="userA")    │
│    → Fetch ALL tasks from GitHub: userA/tasks/*    │
│    → Update Storage: raw/userA/tasks/*             │
│    → Clean orphans (delete removed tasks)          │
│                                                      │
│ 2. Invalidiere Cache: artifacts/userA/*            │
│ 3. Update state/userA/lastHeadSha.txt              │
│ 4. Update state/userA/nextId.txt                   │
│ 5. Return: { ok: true, changed: 42, removed: 3 }  │
└─────────────────────────────────────────────────────┘

User A: Rendert Timeline (nächster Request)
┌─────────────────────────────────────────────────────┐
│ renderCodex.js                                      │
├─────────────────────────────────────────────────────┤
│ 1. Cache MISS (manual sync invalidierte)           │
│ 2. Rebuild from Storage (frisch von GitHub)        │
│ 3. Return Timeline                                  │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Implementierungs-Details

### 1. **User-spezifische Cache-Invalidierung**

```javascript
// shared/storage.js

async function invalidateCacheForUser(userId) {
  // Setze neue Cache-Version für User (optional)
  const timestamp = Date.now().toString();
  await putTextBlob(`state/${userId}/cacheVersion.txt`, timestamp, "text/plain");
  
  // Lösche User-spezifische Timeline-Artefakte
  const artifactBlobs = await list(`artifacts/${userId}/`);
  for (const blob of artifactBlobs) {
    await deleteBlob(blob);
  }
  
  return { 
    userId, 
    cacheVersion: timestamp, 
    cacheCleared: artifactBlobs.length 
  };
}

// DEPRECATED: Alte globale Invalidierung (nur für Migration)
async function invalidateCache() {
  // Legacy: Invalidiert ALLE User
  const timestamp = Date.now().toString();
  await putTextBlob("state/cacheVersion.txt", timestamp, "text/plain");
  
  const artifactBlobs = await list("artifacts/");
  for (const blob of artifactBlobs) {
    await deleteBlob(blob);
  }
  
  return { cacheVersion: timestamp, cacheCleared: artifactBlobs.length };
}
```

### 2. **Webhook: User-Extraktion aus Pfad**

```javascript
// src/githubWebhook.js

function extractUserIdFromPath(path) {
  // Path format: "codex-miroir/userId/tasks/0042-Title.md"
  const match = path.match(/^codex-miroir\/([^/]+)\/tasks\//);
  return match ? match[1] : null;
}

app.http("githubWebhook", {
  // ... existing code ...
  handler: async (request, context) => {
    // ... signature verification ...
    
    const payload = JSON.parse(bodyText);
    
    // Gruppiere Änderungen nach userId
    const changesByUser = new Map();
    
    for (const c of payload.commits || []) {
      for (const p of [...(c.added || []), ...(c.modified || [])]) {
        const userId = extractUserIdFromPath(p);
        if (!userId) continue;
        
        if (!changesByUser.has(userId)) {
          changesByUser.set(userId, { added: [], modified: [], removed: [] });
        }
        
        if (c.added?.includes(p)) {
          changesByUser.get(userId).added.push(p);
        } else {
          changesByUser.get(userId).modified.push(p);
        }
      }
      
      for (const p of c.removed || []) {
        const userId = extractUserIdFromPath(p);
        if (!userId) continue;
        
        if (!changesByUser.has(userId)) {
          changesByUser.set(userId, { added: [], modified: [], removed: [] });
        }
        changesByUser.get(userId).removed.push(p);
      }
    }
    
    // Verarbeite Änderungen pro User
    const results = [];
    for (const [userId, changes] of changesByUser) {
      context.log(`[Webhook] Processing changes for user: ${userId}`);
      
      const res = await applyDiff(changes, payload.after, userId);
      
      // Invalidiere NUR diesen User-Cache
      await invalidateCacheForUser(userId);
      
      results.push({ userId, ...res });
    }
    
    return {
      status: 200,
      jsonBody: { 
        ok: true, 
        usersAffected: results.length,
        results 
      }
    };
  }
});
```

### 3. **TTL-basierte Cache-Validierung**

```javascript
// src/renderCodex.js

const CACHE_TTL_BLOB = 15 * 60 * 1000;   // 15 Minuten
const CACHE_TTL_LOCAL = 5 * 60 * 1000;   // 5 Minuten
const localCache = new Map(); // Pro Function-Instance

async function getCachedTimeline(userId) {
  // Layer 1: Local Memory (schnellster)
  const local = localCache.get(userId);
  if (local && local.validUntil > Date.now()) {
    context.log(`[renderCodex] Local cache HIT for ${userId}`);
    return local.timeline;
  }
  
  // Layer 2: Blob Storage (persistent)
  const blobPath = `artifacts/${userId}/timeline.json`;
  const cached = await getTextBlob(blobPath);
  
  if (cached) {
    const data = JSON.parse(cached);
    const age = Date.now() - new Date(data.cacheCreatedAt).getTime();
    
    if (age < CACHE_TTL_BLOB) {
      context.log(`[renderCodex] Blob cache HIT for ${userId} (age: ${Math.floor(age/1000)}s)`);
      
      // Cache lokal für schnellere Wiederverwendung
      localCache.set(userId, {
        timeline: data,
        validUntil: Date.now() + CACHE_TTL_LOCAL
      });
      
      return data;
    } else {
      context.log(`[renderCodex] Blob cache EXPIRED for ${userId} (age: ${Math.floor(age/1000)}s)`);
    }
  }
  
  // Layer 3: Rebuild notwendig
  return null;
}

async function loadOrBuildTimeline(userId, context) {
  // Prüfe Cache
  const cached = await getCachedTimeline(userId);
  if (cached) {
    return { json: cached, fromCache: true };
  }
  
  context.log(`[renderCodex] Building timeline for ${userId}...`);
  
  // Optional: Background-Sync bei TTL-Expiry
  const shouldSync = await shouldBackgroundSync(userId);
  if (shouldSync) {
    context.log(`[renderCodex] Triggering background sync for ${userId}`);
    await backgroundSync(userId);
  }
  
  // Rebuild from Storage
  const timeline = await buildTimeline(userId);
  
  // Cache in Blob + Local
  const payload = {
    ...timeline,
    cacheCreatedAt: new Date().toISOString(),
    userId
  };
  
  await putTextBlob(
    `artifacts/${userId}/timeline.json`, 
    JSON.stringify(payload)
  );
  
  localCache.set(userId, {
    timeline: payload,
    validUntil: Date.now() + CACHE_TTL_LOCAL
  });
  
  return { json: payload, fromCache: false };
}
```

### 4. **Optional: Background-Sync bei TTL-Expiry**

```javascript
// src/renderCodex.js

async function shouldBackgroundSync(userId) {
  // Prüfe ob Git-Sync aktiviert ist
  if (!process.env.GITHUB_TOKEN) return false;
  
  // Prüfe letzten Sync-Timestamp
  const lastSyncText = await getTextBlob(`state/${userId}/lastSyncAt.txt`);
  if (!lastSyncText) return true; // Noch nie gesynced
  
  const lastSyncAt = new Date(lastSyncText.trim()).getTime();
  const age = Date.now() - lastSyncAt;
  
  // Sync wenn älter als 15 Minuten
  return age > 15 * 60 * 1000;
}

async function backgroundSync(userId) {
  try {
    // Diff-Sync: Nur Änderungen seit letztem Sync
    const lastHeadSha = await getTextBlob(`state/${userId}/lastHeadSha.txt`);
    const currentHeadSha = await getCurrentGitHubHead();
    
    if (lastHeadSha?.trim() === currentHeadSha) {
      console.log(`[backgroundSync] No changes for ${userId}`);
      return { changed: 0 };
    }
    
    // Sync nur geänderte Files
    const changes = await diffPaths(lastHeadSha, currentHeadSha, userId);
    const result = await applyDiff(changes, currentHeadSha, userId);
    
    // Update lastSyncAt
    await putTextBlob(`state/${userId}/lastSyncAt.txt`, new Date().toISOString());
    
    return result;
  } catch (error) {
    console.error(`[backgroundSync] Error for ${userId}:`, error);
    return { error: error.message };
  }
}
```

---

## 📊 Sync-Frequenz-Matrix

| Event | Git-Sync | Cache-Invalidierung | Wer betroffen |
|-------|----------|---------------------|---------------|
| **Task Create/Update/Complete** | Optional (VIA_PR) | User-spezifisch | Nur operierender User |
| **GitHub Webhook** | Nein (Daten von GitHub) | User-spezifisch | Nur User in Commits |
| **Timeline Render (TTL expired)** | Optional Background | Nein (Rebuild) | Nur anfragender User |
| **Manual Sync** | Ja (Full/Diff) | User-spezifisch | Nur anfragender User |
| **Cold Start** | Nein | Alle (Memory leer) | Alle (bei Bedarf) |

---

## 🎯 Empfohlene Konfiguration

### Variante A: **Minimaler Sync (Empfohlen für Start)**

```javascript
// .env
GITHUB_SYNC_ON_OPERATION=false  // Kein Auto-Sync bei create/update/complete
CACHE_TTL_BLOB=900000           // 15 Min (900000 ms)
CACHE_TTL_LOCAL=300000          // 5 Min (300000 ms)
BACKGROUND_SYNC_ENABLED=false   // Kein Auto-Sync bei TTL-Expiry
```

**Sync-Verhalten:**
- ✅ Task-Operationen: Nur Storage-Update (schnell)
- ✅ Webhook: Sync bei Push von anderen Geräten
- ✅ Manual Sync: User kann explizit syncen
- ✅ Cache: TTL-basiert, user-spezifisch

**Vorteile:**
- Minimale GitHub API Calls (Rate-Limit-schonend)
- Schnelle Responses (keine Sync-Delays)
- User kontrolliert Sync (explizit)

**Nachteile:**
- Daten zwischen Geräten nur via Webhook oder Manual Sync
- User muss gelegentlich "Sync" klicken

### Variante B: **Smart Sync (Empfohlen für Multi-Device)**

```javascript
// .env
GITHUB_SYNC_ON_OPERATION=true   // Auto-Sync bei create/update/complete
CACHE_TTL_BLOB=900000           // 15 Min
CACHE_TTL_LOCAL=300000          // 5 Min
BACKGROUND_SYNC_ENABLED=true    // Auto-Sync bei TTL-Expiry
```

**Sync-Verhalten:**
- ✅ Task-Operationen: Storage + GitHub (VIA_PR oder direct push)
- ✅ Webhook: Sync bei Push von anderen Geräten
- ✅ Timeline Render: Background-Sync wenn Cache expired
- ✅ Cache: TTL-basiert, user-spezifisch

**Vorteile:**
- Automatische Sync zwischen Geräten
- Immer aktuelle Daten (max. 15 Min alt)
- Keine manuelle Intervention nötig

**Nachteile:**
- Mehr GitHub API Calls (Rate-Limit beachten)
- Leicht längere Response-Times bei Operations

### Variante C: **Webhook-Only (Empfohlen für Single-Device)**

```javascript
// .env
GITHUB_SYNC_ON_OPERATION=false  // Kein Auto-Sync
CACHE_TTL_BLOB=900000           // 15 Min
CACHE_TTL_LOCAL=300000          // 5 Min
BACKGROUND_SYNC_ENABLED=false   // Kein Auto-Sync
```

**Sync-Verhalten:**
- ✅ Task-Operationen: Nur Storage
- ✅ Webhook: Sync bei Push (falls extern editiert)
- ✅ Manual Sync: Falls nötig
- ✅ Cache: TTL-basiert, user-spezifisch

**Vorteile:**
- Minimale Komplexität
- Keine GitHub API Calls außer Webhook
- Sehr schnell

**Nachteile:**
- Git-Repo nur via Webhook/Manual aktualisiert
- Nicht für Multi-Device ohne externes Tool

---

## 🚀 Migration-Plan

### Phase 1: User-spezifische Cache-Invalidierung

1. **Refactor `storage.js`**
   - Neue Funktion: `invalidateCacheForUser(userId)`
   - Alte Funktion behalten: `invalidateCache()` (deprecated)

2. **Update Task-Operations**
   - `createTask.js`: `invalidateCache()` → `invalidateCacheForUser(userId)`
   - `updateTask.js`: `invalidateCache()` → `invalidateCacheForUser(userId)`
   - `completeTask.js`: `invalidateCache()` → `invalidateCacheForUser(userId)`

3. **Update Webhook**
   - Extrahiere `userId` aus geänderten Pfaden
   - Rufe `invalidateCacheForUser(userId)` pro betroffenem User

### Phase 2: TTL-basierte Cache-Validierung

1. **Refactor `renderCodex.js`**
   - Implementiere `getCachedTimeline(userId)` mit TTL-Check
   - Entferne stündliche Cache-Version (kein `_YYYYMMDD_HH` mehr)
   - `cacheCreatedAt` in Timeline-Payload

2. **Testing**
   - Cache-HIT bei frischen Daten (< 15 Min)
   - Cache-MISS bei alten Daten (> 15 Min)
   - User-Isolation (User A's Update invalidiertNicht User B)

### Phase 3: Optional - Local Memory Layer

1. **Implementiere Dual-Layer Cache**
   - `Map<userId, { timeline, validUntil }>` in `renderCodex.js`
   - 5 Min TTL für Local Cache
   - Fallback zu Blob Cache

2. **Testing**
   - Performance-Messung (Local HIT vs Blob HIT vs MISS)
   - Memory-Consumption-Monitoring

### Phase 4: Optional - Background Sync

1. **Implementiere `shouldBackgroundSync(userId)`**
   - Prüfe `lastSyncAt` Timestamp
   - Prüfe `lastHeadSha` vs. aktueller HEAD

2. **Implementiere `backgroundSync(userId)`**
   - Diff-Sync statt Full-Sync
   - Error-Handling (keine Fehler an User, nur Logging)

---

## 📝 Zusammenfassung

### **Empfohlene Strategie:**

1. **Git-Sync-Frequenz:**
   - ❌ **NICHT** alle 15 Minuten periodisch
   - ✅ **Nur bei Änderung** (event-driven)
   - ✅ **Optional:** Background-Sync bei TTL-Expiry (Smart Sync)

2. **Webhook-Verhalten:**
   - ✅ Extrahiert `userId` aus geänderten Pfaden
   - ✅ Invalidiert **nur** betroffene User-Caches
   - ✅ Updated Storage für betroffene User
   - ✅ Keine globale Cache-Invalidierung mehr

3. **Cache-TTL:**
   - ✅ Blob Storage Cache: 15 Minuten
   - ✅ Local Memory Cache: 5 Minuten
   - ✅ User-spezifische Invalidierung bei Operations

4. **Sync-Trigger:**
   - ✅ **Webhook:** GitHub → Azure (andere Geräte pushen)
   - ✅ **Manual Sync:** User klickt "Sync" (explizit)
   - ✅ **Optional:** Background bei TTL-Expiry (implizit)
   - ❌ **NICHT:** Periodischer Sync alle X Minuten

### **Vorteile dieser Strategie:**

- ⚡ Schnell: Cache-Hits in 1-5ms (Local) oder 100ms (Blob)
- 🎯 Effizient: Nur Sync bei tatsächlichen Änderungen
- 👥 User-Isolation: Operationen beeinflussen nur betroffene User
- 🔄 Multi-Device: Webhook synchronisiert automatisch
- 💰 Kosteneffizient: Minimale GitHub API Calls
- 🛡️ Robust: Storage als Source of Truth, Cache optional

### **Start mit:**
- Variante A (Minimaler Sync) für einfachen Einstieg
- Upgrade zu Variante B (Smart Sync) wenn Multi-Device wichtig wird
