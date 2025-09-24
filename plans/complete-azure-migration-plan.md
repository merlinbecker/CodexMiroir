# Complete Azure Function Migration Plan

## Objective
Completely migrate the project to be Azure Function-only, removing all old Next.js/Express infrastructure and moving the Azure Function to the root directory as a static PWA.

## Current State Analysis

### Files to DELETE (Old Infrastructure)
- `client/` - React frontend source code
- `server/` - Express server infrastructure  
- `shared/` - Shared utilities for Express setup
- Root level config files:
  - `package.json` (Express/React dependencies)
  - `package-lock.json` 
  - `vite.config.ts`
  - `tsconfig.json`
  - `tailwind.config.ts`
  - `postcss.config.js`
  - `components.json`
  - `drizzle.config.ts`
- Documentation about Express setup:
  - `server/` related docs
- Build artifacts:
  - `dist/` (if exists)

### Files to KEEP
- `documentation/` - Azure Function documentation
- `plans/` - Implementation plans
- `attached_assets/` - Project assets
- `codequality/` - Quality tools
- `.github/` - GitHub workflows
- `.devcontainer/` - Dev container config
- Git files (`.git/`, `.gitignore`)
- Project meta files (README, etc.)

### Files to MOVE (Azure Function → Root)
From `codex-miroir-fn/` to root:
- `host.json` → Root
- `package.json` → Root (Azure Function dependencies)
- `package-lock.json` → Root
- `codex/` → Root (API function)
- `static/` → Root (Static serving function)
- Static assets:
  - `index.html` → Root
  - `manifest.json` → Root  
  - `sw.js` → Root
  - `assets/` → Root
- Scripts:
  - `integrate-frontend.sh` → Root (needs updating)
  - `README.md` → Root (merge with existing)

## Implementation Steps

### Phase 1: Clean Preparation (30 min)
1. **Backup current state** - Ensure we can rollback if needed
2. **Document current Azure Function structure** - Before moving
3. **Identify all file dependencies** - Ensure nothing breaks

### Phase 2: File Removal (15 min)
1. **Remove Express/React infrastructure**:
   ```bash
   rm -rf client/
   rm -rf server/ 
   rm -rf shared/
   rm package.json package-lock.json
   rm vite.config.ts tsconfig.json tailwind.config.ts
   rm postcss.config.js components.json drizzle.config.ts
   ```
2. **Clean up any build artifacts**

### Phase 3: Azure Function Migration (45 min)
1. **Move Azure Function files to root**:
   - Copy `codex-miroir-fn/*` to root
   - Update file paths in scripts
   - Update documentation
2. **Update routing and configuration**:
   - Ensure `host.json` works in root
   - Verify function routes still work
   - Update integration scripts

### Phase 4: Static PWA Optimization (60 min)
1. **Pre-build static assets** - No runtime build needed
2. **Optimize PWA configuration**:
   - Service worker optimization
   - Manifest.json configuration
   - Cache strategies for static assets
3. **Ensure offline functionality**
4. **Remove any build-time dependencies**

### Phase 5: Testing & Documentation (30 min)
1. **Test Azure Function locally**:
   - API endpoints work
   - Static file serving works
   - PWA features work offline
2. **Update documentation**:
   - New project structure
   - Deployment instructions
   - Remove old setup docs
3. **Update CI/CD if needed**

## Risks & Considerations

### High Risk
- **Breaking existing deployment** - Need careful testing
- **Losing functionality** - Static PWA might miss dynamic features
- **Service worker conflicts** - Cache management complexity

### Medium Risk  
- **Path dependencies** - Scripts might reference old paths
- **Environment variables** - Config changes needed
- **Documentation gaps** - Need comprehensive updates

### Low Risk
- **File cleanup** - Easy to add back if needed
- **Directory structure** - Straightforward migration

## Success Criteria

1. ✅ **Single directory structure**: Everything in root, no subdirectories for app logic
2. ✅ **Static PWA**: No build step required, works offline
3. ✅ **Azure Function only**: No Express/React development dependencies
4. ✅ **All functionality preserved**: API and frontend both work
5. ✅ **Deployment ready**: Simple `func azure functionapp publish` deployment

## Rollback Plan

If migration fails:
1. `git checkout` to previous commit
2. Restore backup of `codex-miroir-fn/` if needed
3. Document what went wrong for future attempts

## Estimated Time
**Total: 3 hours** (with thorough testing)

## Recommendation
This is significant work that will completely change the project structure. Benefits:
- ✅ **Simpler deployment** - Single Azure Function app
- ✅ **Lower maintenance** - No dual infrastructure
- ✅ **Cost effective** - One hosting solution
- ❌ **Less flexibility** - Harder to change frontend tech later
- ❌ **Azure vendor lock-in** - Tied to Azure Functions

**Proceed? This will make the project Azure Function-only with no way back to Express/React development model.**