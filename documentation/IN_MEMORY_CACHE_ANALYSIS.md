# In-Memory Cache Analyse: Vergleich der Architektur-Ansätze

**Datum:** 2025-10-11  
**Status:** Analyse  
**Kontext:** Evaluation ob In-Memory Cache sinnvoller wäre als aktueller Blob-Storage-basierter Cache

---

## 📋 Zusammenfassung

### Aktueller Ansatz: **Blob-Storage-basierter Cache**
- Tasks werden in Azure Blob Storage gespeichert (`raw/userId/tasks/*.md`)
- Timeline wird als JSON-Artefakt gecacht (`artifacts/userId/timeline_<version>.json`)
- Cache wird bei jeder Aktion (create/update/complete) invalidiert
- Git-Sync läuft asynchron über Webhooks oder manuelle Syncs

### Vorgeschlagener Ansatz: **In-Memory Cache mit Shared Memory**
- Timeline für eingeloggte User in-memory (gemeinsamer Speicher über Functions)
- Operationen (create/update/complete) arbeiten auf Memory-Cache
- Bei Operationen: Storage-Save + optional Git-Sync
- Bei fehlendem Memory-Cache: Rebuild from Storage + optional Sync

---

## 🏗️ Architektur-Details

### Aktueller Ansatz (Blob-Storage-basiert)

```
┌─────────────────┐
│  HTTP Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  renderCodex    │─────▶│  Blob Storage    │
│  (Function)     │      │  raw/tasks/*.md  │
└────────┬────────┘      │  artifacts/*.json│
         │               └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Build Timeline │
│  (on cache miss)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return JSON    │
└─────────────────┘

Operations: create/update/complete
├─▶ Save to Blob Storage (raw/tasks/*.md)
├─▶ Invalidate Cache (delete artifacts/*.json)
└─▶ Optional: Sync to GitHub
```

**Cache-Strategie:**
- Version basiert auf: `baseVersion_YYYYMMDD_HH`
- `baseVersion` aus `state/cacheVersion.txt` (invalidiert bei Actions)
- Stündliche Auto-Invalidierung durch Stunden-Suffix
- Cache HIT: Timeline aus `artifacts/userId/timeline_*.json` laden
- Cache MISS: Timeline neu bauen, als Artefakt speichern

### Vorgeschlagener Ansatz (In-Memory)

```
┌─────────────────┐
│  HTTP Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  renderCodex    │─────▶│  Shared Memory   │
│  (Function)     │      │  Map<userId, {   │
└────────┬────────┘      │    timeline,     │
         │               │    tasks[]       │
         │               │  }>              │
         ▼               └──────────────────┘
┌─────────────────┐
│  Memory HIT?    │
│  Yes: return    │
│  No: rebuild    │
└─────────────────┘

Operations: create/update/complete
├─▶ Update Memory Cache (Timeline + Tasks Array)
├─▶ Save to Blob Storage (raw/tasks/*.md)
└─▶ Optional: Sync to GitHub

Rebuild Trigger:
- User not in Memory
- Manual refresh
- Cold start (Function restart)
```

**Cache-Strategie:**
- Global `Map<userId, TimelineData>` über alle Functions
- Keine Persistierung des Caches (nur in-memory)
- Bei Cold Start oder fehlendem Entry: Rebuild from Storage
- Tasks-Array im Memory für schnelle Operationen

---

## ⚖️ Vor- und Nachteile

### Aktueller Ansatz: Blob-Storage-basiert

#### ✅ Vorteile

1. **Persistenz & Konsistenz**
   - Cache überlebt Function-Restarts (kein Cold-Start-Problem)
   - Konsistente Daten über alle Function-Instanzen hinweg
   - Kein State-Management zwischen Instanzen nötig

2. **Skalierbarkeit**
   - Azure Functions skaliert horizontal automatisch
   - Jede Instanz kann unabhängig auf Blob Storage zugreifen
   - Keine Shared-Memory-Probleme bei Multi-Instance-Deployment

3. **Audit & Debugging**
   - Cache-Artefakte sind inspizierbar (`artifacts/*.json`)
   - Blob Storage bietet Versioning/Soft-Delete (optional)
   - Einfaches Debugging: Cache-Files direkt im Portal ansehen

4. **Git-Sync-Kompatibilität**
   - Tasks in Blob Storage spiegeln Git-Repo (Source of Truth)
   - Einfache Reconciliation zwischen Storage und Git
   - Webhook-Sync kann direkt Storage aktualisieren

5. **Cache-Invalidierung ist explizit**
   - Klare Semantik: Aktion → Invalidierung → Rebuild
   - Zeitbasierte Invalidierung (Stunden-Suffix) funktioniert gut
   - Keine Race-Conditions zwischen Reads/Writes

#### ❌ Nachteile

1. **Latenz bei Cache-Miss**
   - Timeline-Rebuild dauert (alle Tasks lesen + parsen + platzieren)
   - Blob Storage I/O ist langsamer als In-Memory
   - Bei vielen Users: Cache-Misses nach jeder Invalidierung

2. **Übermäßige Invalidierung**
   - Jede Task-Operation invalidiert ALLE User-Caches
   - Stündliche Auto-Invalidierung auch bei Inaktivität
   - Viele Rebuilds, obwohl sich nichts geändert hat (andere User)

3. **Storage-Kosten**
   - Cache-Artefakte belegen Speicher
   - Bei vielen Usern: Viele Cache-Files (`artifacts/userId/timeline_*.json`)
   - Alte Cache-Versions werden nicht automatisch gelöscht

4. **Komplexität bei Cache-Versions-Management**
   - `cacheVersion.txt` + Stunden-Suffix = komplexe Versionierung
   - Alte Artefakte müssen manuell cleaned werden
   - Cache-Lookup sucht ALLE `artifacts/userId/timeline_*` (ineffizient)

---

### Vorgeschlagener Ansatz: In-Memory Cache

#### ✅ Vorteile

1. **Extrem schnelle Reads**
   - Timeline direkt aus Memory (keine I/O)
   - Operationen (get/update) in Mikrosekunden statt Millisekunden
   - Perfekt für hohe Read-Frequenz (renderCodex wird oft aufgerufen)

2. **Einfachere Architektur**
   - Keine Cache-Versions-Verwaltung nötig
   - Keine Artefakte im Blob Storage
   - Logik: "Ist im Memory? Ja → return, Nein → build + cache"

3. **Geringere Blob-Storage-Kosten**
   - Keine Cache-Artefakte (`artifacts/` wird nicht benötigt)
   - Nur rohe Task-Files (`raw/tasks/*.md`) im Storage
   - Weniger Storage-Transaktionen

4. **Automatische User-Isolation**
   - Jeder User hat seinen eigenen Memory-Entry
   - Operationen eines Users beeinflussen andere nicht
   - Kein globaler Cache-Invalidierungs-Overhead

5. **Natürliche "Cache-Eviction"**
   - Cold Start → Memory leer → Rebuild nur für aktive User
   - Inaktive User belegen keinen Memory (werden nicht rebuilt)
   - LRU-Eviction möglich (älteste Timeline aus Memory entfernen)

#### ❌ Nachteile

1. **Cold-Start-Problem**
   - Bei Function-Restart: ALLE User-Timelines sind weg
   - Erste Requests nach Cold-Start sind langsam (Rebuild)
   - Azure Functions können jederzeit recycled werden (unvorhersehbar)

2. **Multi-Instance-Probleme**
   - Bei horizontaler Skalierung: Mehrere Function-Instanzen
   - Jede Instanz hat eigenen Memory → Inkonsistenz zwischen Instanzen
   - Load Balancer routet Requests unterschiedlich → User trifft verschiedene Instanzen
   - **Lösung nötig:** Sticky Sessions oder Distributed Cache (Redis)

3. **Memory-Limits**
   - Azure Functions haben Memory-Limits (abhängig von Plan)
   - Viele aktive User → große Memory-Consumption
   - Bei 1000 Usern á 50 KB Timeline = 50 MB Memory nur für Caches
   - Consumption-Plan: 1,5 GB Memory-Limit gesamt

4. **Komplexe Invalidierungs-Logik**
   - Wann aus Memory entfernen? (TTL? LRU? Manual?)
   - Zeitbasierte Invalidierung schwieriger (muss in-memory getracked werden)
   - Race-Conditions: Read während Write (Locking nötig?)

5. **Kein Audit-Trail**
   - Cache-State ist flüchtig (keine Persistierung)
   - Debugging schwieriger: "Warum zeigt User X falsche Daten?"
   - Keine History: Kann nicht nachvollziehen, wann Cache invalidiert wurde

6. **Git-Sync-Komplexität**
   - Memory ist nicht Git-synced
   - Webhook-Update muss Memory invalidieren (nicht nur Storage)
   - Race-Condition: Webhook kommt während Operation an
   - **Beispiel:** User updated Task → Memory + Storage update → Webhook überschreibt Storage → Memory ist stale

---

## 🔬 Kritische Szenarien

### Szenario 1: Multi-Instance-Deployment

**Problem:**
```
Function Instance A: User1's Timeline in Memory (Task 0001 = "offen")
Function Instance B: User1's Timeline in Memory (Task 0001 = "offen")

User1 markiert Task 0001 als abgeschlossen:
→ Request trifft Instance A
→ Instance A: Memory Update (Task 0001 = "abgeschlossen")
→ Instance A: Storage Update

Nächster Request von User1:
→ Request trifft Instance B (Load Balancer!)
→ Instance B: Liefert ALTE Timeline aus Memory (Task 0001 = "offen")
```

**Lösung:**
- Distributed Cache (z.B. Azure Redis Cache) statt lokalem Memory
- Sticky Sessions (Azure Front Door / API Management)
- Memory nur als "Hot Cache", Storage als "Source of Truth" + Invalidierung

**Aktueller Ansatz:**
- Kein Problem, da Blob Storage von allen Instanzen geteilt wird
- Cache-Artefakte sind konsistent über alle Instanzen

### Szenario 2: Cold Start nach Inaktivität

**Problem:**
```
User1 war 30 Minuten inaktiv
→ Function wurde recycled (Azure Consumption Plan)
→ Memory ist leer

User1 öffnet App:
→ renderCodex: Memory MISS
→ Rebuild from Storage (alle Tasks lesen + parsen + Timeline bauen)
→ 2-5 Sekunden Latenz
```

**Aktueller Ansatz:**
- Cache-Artefakte im Blob Storage überlebt Cold Start
- Erste Request nach Cold Start: Cache HIT (schnell)

### Szenario 3: Git-Webhook + gleichzeitige User-Operation

**Problem:**
```
T0: User1 updated Task 0005 (Memory + Storage)
T1: GitHub Webhook kommt an (Push von anderem Gerät)
    → Webhook überschreibt ALL Tasks in Storage (fullSync)
    → Memory ist jetzt stale (hat alte Version von Task 0005)
T2: User1 rendert Timeline
    → Memory HIT (zeigt veraltete Daten!)
```

**Lösung:**
- Webhook muss Memory invalidieren (schwierig bei Multi-Instance)
- Alternative: Memory-TTL (z.B. 5 Minuten), dann automatisch rebuild

**Aktueller Ansatz:**
- Webhook invalidiert Cache (delete artifacts)
- Nächster Request: Cache MISS → Rebuild from Storage (aktuell)

---

## 📊 Performance-Vergleich (geschätzt)

### Blob-Storage-basiert (aktuell)

| Operation | Latenz | Storage I/O | Skalierbarkeit |
|-----------|--------|-------------|----------------|
| Timeline Render (Cache HIT) | ~100ms | 1 read (JSON) | ⭐⭐⭐⭐⭐ Excellent |
| Timeline Render (Cache MISS) | ~2-5s | 50-500 reads (alle Tasks) | ⭐⭐⭐⭐ Good |
| Task Create | ~500ms | 2 writes (Task + invalidate) | ⭐⭐⭐⭐⭐ Excellent |
| Task Complete | ~500ms | 2 writes (Task + invalidate) | ⭐⭐⭐⭐⭐ Excellent |
| Cold Start Impact | ⭐⭐⭐⭐⭐ None | Cache überlebt Cold Start | - |

### In-Memory (vorgeschlagen)

| Operation | Latenz | Storage I/O | Skalierbarkeit |
|-----------|--------|-------------|----------------|
| Timeline Render (Memory HIT) | ~1-5ms | 0 | ⭐⭐ Requires Redis |
| Timeline Render (Memory MISS) | ~2-5s | 50-500 reads (rebuild) | ⭐⭐⭐⭐ Good |
| Task Create | ~50ms | 1 write (Task) | ⭐⭐ Requires Redis |
| Task Complete | ~50ms | 1 write (Task) | ⭐⭐ Requires Redis |
| Cold Start Impact | ⭐⭐ Severe | Alle User müssen rebuilden | - |

**Hinweis:** In-Memory ohne Distributed Cache (Redis) ist **nicht produktionsfähig** bei Multi-Instance.

---

## 💡 Empfehlung: Hybrid-Ansatz

### Option 1: **Optimierter Blob-Storage-Cache (Empfohlen)**

**Verbesserungen am aktuellen System:**

1. **User-spezifische Cache-Invalidierung**
   ```javascript
   // Aktuell: Invalidiere ALL Caches
   await invalidateCache(); // Löscht artifacts/*
   
   // Besser: Invalidiere nur betroffenen User
   await invalidateCacheForUser(userId); // Löscht nur artifacts/userId/*
   ```

2. **TTL-basierte Invalidierung (statt stündlich)**
   ```javascript
   // Statt: cacheVersion = "baseVersion_YYYYMMDD_HH"
   // Besser: TTL in Artefakt-Metadata
   
   async function getCachedTimeline(userId) {
     const cache = await getTextBlob(`artifacts/${userId}/timeline.json`);
     if (!cache) return null;
     
     const data = JSON.parse(cache);
     const age = Date.now() - new Date(data.cacheCreatedAt).getTime();
     const TTL = 15 * 60 * 1000; // 15 Minuten
     
     if (age > TTL) {
       return null; // Cache abgelaufen
     }
     
     return data;
   }
   ```

3. **Lazy Invalidierung (nur bei Bedarf löschen)**
   ```javascript
   // Statt: Bei Operation alle Artefakte löschen
   // Besser: Flag "dirty" setzen, beim nächsten Read neu bauen
   
   await putTextBlob(`state/${userId}/cacheValid.txt`, "false");
   ```

**Vorteile:**
- ✅ Behält alle Vorteile des aktuellen Systems (Persistenz, Skalierbarkeit)
- ✅ Eliminiert Hauptnachteile (übermäßige Invalidierung, User-Isolation)
- ✅ Keine neue Infrastruktur nötig (Redis)
- ✅ Einfach zu implementieren

### Option 2: **In-Memory mit Redis (für später)**

Falls Performance kritisch wird (>1000 aktive User):

1. **Azure Redis Cache** als Distributed Cache
   ```javascript
   const redis = require('redis');
   const client = redis.createClient({
     url: process.env.AZURE_REDIS_CONNECTION_STRING
   });
   
   async function getTimeline(userId) {
     // 1. Versuche Redis
     const cached = await client.get(`timeline:${userId}`);
     if (cached) return JSON.parse(cached);
     
     // 2. Rebuild from Storage
     const timeline = await buildTimeline(userId);
     
     // 3. Cache in Redis (TTL 15 Min)
     await client.setEx(`timeline:${userId}`, 900, JSON.stringify(timeline));
     
     return timeline;
   }
   ```

2. **Invalidierung via Redis**
   ```javascript
   async function invalidateUserCache(userId) {
     await client.del(`timeline:${userId}`);
   }
   ```

**Vorteile:**
- ✅ Extrem schnell (1-5ms Latency)
- ✅ Multi-Instance-safe (shared Redis)
- ✅ TTL + LRU Eviction automatisch

**Nachteile:**
- ❌ Zusätzliche Kosten (~€60/Monat für Basic Redis)
- ❌ Zusätzliche Komplexität
- ❌ Mehr Infrastruktur zu managen

---

## 🎯 Finale Bewertung

### Für CodexMiroir (aktueller Stand):

| Kriterium | Blob-Storage (aktuell) | In-Memory (vorgeschlagen) | Hybrid (empfohlen) |
|-----------|------------------------|---------------------------|---------------------|
| **Performance (Read)** | ⭐⭐⭐⭐ 100ms | ⭐⭐⭐⭐⭐ 1-5ms | ⭐⭐⭐⭐⭐ 1-5ms |
| **Performance (Cold Start)** | ⭐⭐⭐⭐⭐ Keine Impact | ⭐⭐ Alle rebuilden | ⭐⭐⭐⭐⭐ Keine Impact |
| **Skalierbarkeit** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐ Needs Redis | ⭐⭐⭐⭐⭐ Excellent |
| **Konsistenz** | ⭐⭐⭐⭐⭐ Storage = Truth | ⭐⭐⭐ Multi-Instance Issues | ⭐⭐⭐⭐⭐ Storage = Truth |
| **Komplexität** | ⭐⭐⭐ Mittel | ⭐⭐ Hoch (Race Conditions) | ⭐⭐⭐⭐ Niedrig |
| **Kosten** | ⭐⭐⭐⭐ Niedrig | ⭐⭐ Redis ~€60/Monat | ⭐⭐⭐⭐ Niedrig |
| **Debugging** | ⭐⭐⭐⭐⭐ Artefakte inspizierbar | ⭐⭐ Flüchtig | ⭐⭐⭐⭐⭐ Artefakte inspizierbar |

### 📌 Empfehlung: **Hybrid-Ansatz (Option 1)**

**Kurz:**
- Behalte **Blob-Storage-Cache** als Basis
- Optimiere **User-spezifische Invalidierung**
- Füge **TTL-basierte Cache-Prüfung** hinzu
- Optional: **Local In-Memory Layer** (pro Function-Instance) als "Hot Cache"

**Implementierung:**
```javascript
// Dual-Layer Cache: Local Memory (hot) + Blob Storage (persistent)

const localCache = new Map(); // Pro Function-Instance

async function getTimeline(userId) {
  // Layer 1: Local Memory (1-5ms)
  const local = localCache.get(userId);
  if (local && local.validUntil > Date.now()) {
    return local.timeline;
  }
  
  // Layer 2: Blob Storage (100ms)
  const blob = await getTextBlob(`artifacts/${userId}/timeline.json`);
  if (blob) {
    const data = JSON.parse(blob);
    const age = Date.now() - new Date(data.cacheCreatedAt).getTime();
    if (age < 15 * 60 * 1000) { // 15 Min TTL
      // Cache lokal für 5 Minuten
      localCache.set(userId, {
        timeline: data,
        validUntil: Date.now() + 5 * 60 * 1000
      });
      return data;
    }
  }
  
  // Layer 3: Rebuild from Storage (2-5s)
  const timeline = await buildTimeline(userId);
  
  // Cache in Blob + Local
  await putTextBlob(
    `artifacts/${userId}/timeline.json`, 
    JSON.stringify(timeline)
  );
  localCache.set(userId, {
    timeline,
    validUntil: Date.now() + 5 * 60 * 1000
  });
  
  return timeline;
}
```

**Vorteile dieses Ansatzes:**
- ✅ Beste Performance: Local Cache (1-5ms) für wiederholte Requests
- ✅ Multi-Instance-safe: Blob Storage als Truth
- ✅ Cold-Start-safe: Blob Storage überlebt Function-Restarts
- ✅ Keine zusätzlichen Kosten (Redis)
- ✅ User-Isolation: Jeder User hat eigenen Cache
- ✅ Automatisches TTL-Management
- ✅ Einfach zu implementieren

---

## 🚀 Nächste Schritte (wenn Hybrid-Ansatz gewählt)

1. **Refactor `storage.js`**
   - `invalidateCacheForUser(userId)` statt `invalidateCache()`
   - TTL-Check in `getCachedTimeline(userId)`

2. **Refactor `renderCodex.js`**
   - Dual-Layer Cache implementieren (Local Map + Blob)
   - User-spezifische Cache-Keys (`artifacts/${userId}/timeline.json`)

3. **Refactor Operations** (`createTask`, `updateTask`, `completeTask`)
   - Invalidiere nur betroffenen User-Cache
   - Setze "dirty"-Flag statt Delete

4. **Testing**
   - Multi-User-Tests (User A ändert Task, User B sieht es nicht)
   - Cold-Start-Tests (Function restart, Cache überlebt)
   - Performance-Tests (Cache HIT vs MISS Latency)

---

## 📚 Fazit

**Frage:** Ist In-Memory Cache sinnvoller?

**Antwort:** 
- **Nein, nicht als reiner In-Memory-Ansatz** (ohne Redis)
  - Zu viele Probleme: Multi-Instance, Cold Start, Race Conditions
  - Benötigt Redis für Production → Zusätzliche Kosten + Komplexität
  
- **Ja, als Hybrid-Ansatz** (Local Memory + Blob Storage)
  - Bestes aus beiden Welten: Speed + Persistenz + Einfachheit
  - Minimale Änderungen am aktuellen System
  - Keine neuen Dependencies
  - **Empfohlen!**

**TL;DR:** Optimiere den aktuellen Blob-Storage-Cache mit User-spezifischer Invalidierung und optionalem Local-Memory-Layer. Verzichte auf reinen In-Memory-Ansatz ohne Distributed Cache.
