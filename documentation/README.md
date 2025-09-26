# CodexMiroir Documentation

This directory contains the complete documentation for the CodexMiroir task management system.

## Architecture Documentation

**📋 [arc42.md](arc42.md)** - Complete system architecture documentation following the arc42 standard, including:
- System overview and goals
- Architecture decisions and constraints  
- Building blocks and runtime scenarios
- Deployment infrastructure
- Quality requirements and risks
- C4 model diagrams with Mermaid

## Migration Overview ✅ COMPLETED

The CodexMiroir application has been successfully migrated from a traditional React/Express/PostgreSQL stack to a minimalistic Azure Functions + Blob Storage architecture following the "Spiegelkodex" philosophy.

### Completed Phases:

**✅ Phase 1: Foundation**
- Azure Functions setup with modular architecture
- Core task management (createTask, completeTask, pushToEnd, report, when)  
- Markdown-based storage in Azure Blob Storage
- Token-based user authentication

**✅ Phase 2: Voice & AI Integration**
- German voice command processing with OpenAI GPT
- Automatic task decomposition for large tasks
- Pattern-matching fallback for offline operation
- Enhanced API with voice-optimized endpoints

**✅ Phase 3: Frontend Migration** 
- Progressive Web App (PWA) with offline support
- Static asset serving through Azure Functions
- Service worker for caching and background sync
- Complete removal of Next.js/React dependencies

## Documentation Structure

- **[arc42.md](arc42.md)** - Main architecture documentation
- **[api/](api/)** - API endpoint documentation
- **api/endpoints.md** - Detailed API reference