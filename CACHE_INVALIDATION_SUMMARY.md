# Cache Invalidation Improvements - Implementation Summary

## Problem Statement

The timeline cache needed to be invalidated more frequently to ensure data freshness:
1. **Time-based invalidation**: Cache should invalidate when current time slots change (e.g., morning → afternoon → evening)
2. **Action-based invalidation**: Cache should invalidate when tasks are updated or marked as completed

## Solution Overview

### 1. Centralized Cache Invalidation Helper

**File**: `shared/storage.js`

Added `invalidateCache()` function that:
- Generates a new timestamp-based cache version
- Deletes all existing timeline artifacts
- Returns the new cache version and count of cleared caches

```javascript
async function invalidateCache() {
  const timestamp = Date.now().toString();
  await putTextBlob("state/cacheVersion.txt", timestamp, "text/plain");
  
  const artifactBlobs = await list("artifacts/");
  for (const blob of artifactBlobs) {
    await deleteBlob(blob);
  }
  
  return { cacheVersion: timestamp, cacheCleared: artifactBlobs.length };
}
```

### 2. Time-Based Cache Versioning

**File**: `src/renderCodex.js`

Modified `getCacheVersion()` to include the current hour in the cache version:

```javascript
async function getCacheVersion() {
  const storedVersion = await getTextBlob("state/cacheVersion.txt");
  const baseVersion = storedVersion?.trim() || Date.now().toString();
  
  // Add current hour for automatic slot invalidation
  const now = new Date();
  const currentHour = now.getHours();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(currentHour).padStart(2, '0');
  
  return `${baseVersion}_${year}${month}${day}_${hour}`;
}
```

**Impact**: 
- Cache automatically invalidates every hour
- When time transitions between slots (e.g., 9:00 AM - morning → afternoon), the cache version changes
- Past slots are no longer shown because the timeline skeleton only includes future slots

### 3. Action-Based Cache Invalidation

**Files**: `src/updateTask.js`, `src/completeTask.js`

Added `invalidateCache()` calls after task modifications:

**In updateTask.js:**
```javascript
// Update cache
await putTextBlob(`raw/tasks/${id}.md`, newMd, "text/markdown");

// Invalidate timeline cache
const cacheInvalidation = await invalidateCache();
context.log(`[updateTask] Cache invalidated: ${JSON.stringify(cacheInvalidation)}`);
```

**In completeTask.js:**
```javascript
// Update cache
await putTextBlob(`raw/tasks/${id}.md`, newMd, "text/markdown");

// Invalidate timeline cache
const cacheInvalidation = await invalidateCache();
context.log(`[completeTask] Cache invalidated: ${JSON.stringify(cacheInvalidation)}`);
```

**Impact**:
- When a task is updated via API, the timeline cache is immediately invalidated
- When a task is marked as completed, the timeline cache is immediately invalidated
- Next timeline request will rebuild the cache with updated data

### 4. Sync Operations

**File**: `shared/sync.js`

Updated both `fullSync()` and `applyDiff()` to use the new `invalidateCache()` helper:

```javascript
// In fullSync()
const cacheInvalidation = await invalidateCache();

// In applyDiff()
const cacheInvalidation = await invalidateCache();
```

**Impact**:
- Consistent cache invalidation across all sync operations
- Webhook triggers now properly invalidate cache
- Manual sync operations invalidate cache

## Cache Invalidation Flow

### Scenario 1: Time Passes (Automatic)
```
Current time: 8:55 AM → Cache version: baseVersion_20240115_08
Current time: 9:05 AM → Cache version: baseVersion_20240115_09
                      → Cache rebuilt with new slots (morning slot no longer shown)
```

### Scenario 2: Task Update (API Action)
```
1. User calls PUT /api/tasks/0001
2. updateTask.js updates GitHub
3. updateTask.js updates blob storage
4. updateTask.js calls invalidateCache()
   - New cacheVersion generated
   - All timeline_*.json artifacts deleted
5. Next timeline request rebuilds cache with updated task
```

### Scenario 3: Task Completion (API Action)
```
1. User calls POST /api/tasks/0001/complete
2. completeTask.js updates GitHub
3. completeTask.js updates blob storage
4. completeTask.js calls invalidateCache()
   - New cacheVersion generated
   - All timeline_*.json artifacts deleted
5. Next timeline request rebuilds cache without completed task
```

### Scenario 4: Webhook/Sync (External Change)
```
1. GitHub webhook fires (push event)
2. githubWebhook.js calls applyDiff()
3. applyDiff() calls invalidateCache()
   - New cacheVersion generated
   - All timeline_*.json artifacts deleted
4. Next timeline request rebuilds cache with synced tasks
```

## Testing

Added 8 new tests:

### Cache Invalidation Tests (`__tests__/shared/storage.invalidateCache.test.js`)
- ✓ Generates new timestamp-based cacheVersion
- ✓ Deletes all timeline caches
- ✓ Handles no existing caches
- ✓ Returns cacheVersion and cacheCleared count

### Time-Based Cache Versioning Tests (`__tests__/src/renderCodex.cacheVersion.test.js`)
- ✓ Cache version includes current hour
- ✓ Cache version changes when hour changes
- ✓ Cache version stays same within the same hour
- ✓ Cache version changes at slot transitions

**Total Test Suite**: 179 tests passing

## Benefits

1. **Improved Data Freshness**: Timeline always shows current data
2. **Automatic Time-Based Updates**: No manual intervention needed when time passes
3. **Immediate Action Feedback**: Changes via API immediately reflected in timeline
4. **Consistent Behavior**: All invalidation paths use the same helper function
5. **Minimal Code Changes**: Surgical modifications to existing codebase
6. **Well Tested**: Comprehensive test coverage for new functionality

## Cache Version Format

Format: `baseVersion_YYYYMMDD_HH`

Examples:
- `1234567890_20240115_09` - January 15, 2024 at 9 AM
- `1234567890_20240115_14` - January 15, 2024 at 2 PM
- `1234567890_20240115_19` - January 15, 2024 at 7 PM

This ensures cache automatically invalidates every hour, which aligns with slot transition times.
