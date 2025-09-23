# CodexMiroir Migration Documentation

This directory contains documentation for the migration from Next.js/Express to Azure Functions architecture.

## Migration Overview

The CodexMiroir application is being migrated from a traditional React/Express/PostgreSQL stack to a minimalistic Azure Functions + Blob Storage architecture following the "Spiegelkodex" philosophy.

## Migration Phases

### Phase 1: Foundation (Current)
- Azure Functions setup
- Basic task management (createTask, completeTask, pushToEnd, report, when)
- Markdown-based storage in Azure Blob Storage
- API-key authentication

### Phase 2: Core Migration (Planned)
- Voice command processing
- AI task decomposition
- Enhanced frontend integration
- Complete data migration

### Phase 3: Frontend Adaptation (Planned)
- API integration with new endpoints
- UI simplification for FIFO workflow
- Theme integration (Dark/Light for Pro/Priv)

## Documentation Structure

- `phase1/` - Phase 1 implementation documentation
- `phase2/` - Phase 2 implementation documentation  
- `phase3/` - Phase 3 implementation documentation
- `api/` - API documentation
- `migration/` - Migration guides and scripts