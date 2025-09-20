# Overview

Codex Caché is a minimalistic Progressive Web App (PWA) designed as a dual-FIFO task manager for personal productivity. The application manages two separate task backlogs (professional and private) with strict first-in-first-out task ordering. The system emphasizes mental offloading and focus by displaying only the current active task prominently, with AI-powered task chunking and automatic reprioritization based on deadlines.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application uses React with TypeScript as the primary frontend framework, built with Vite for fast development and production builds. The UI follows a mobile-first, minimalistic design approach using:

- **React Components**: Modular component structure with custom hooks for state management
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **Theme System**: Dual-theme architecture supporting light mode (private tasks) and dark mode (professional tasks)
- **PWA Features**: Service worker implementation for offline functionality and app-like experience
- **Routing**: Wouter for lightweight client-side routing

## Backend Architecture
The backend is built with Express.js and follows a RESTful API design pattern:

- **Express Server**: Lightweight REST API with middleware for request logging and error handling
- **Storage Layer**: Abstracted storage interface supporting both in-memory and database implementations
- **Route Organization**: Separated route handlers for different task operations (CRUD, chunking, completion)
- **Development Integration**: Vite middleware integration for seamless development experience

## Data Storage Solutions
The application uses a flexible data storage approach:

- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection**: Neon serverless PostgreSQL for cloud-hosted database
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Runtime Storage**: In-memory storage implementation for development and testing

## Task Management System
The core functionality revolves around strict FIFO task management:

- **Dual Backlogs**: Separate task queues for professional and private contexts
- **FIFO Ordering**: Tasks are processed in strict order without manual reordering
- **Status Management**: Simple three-state system (pending, active, completed)
- **Auto-chunking**: AI-powered task breakdown into 3.5-hour work blocks
- **Smart Reprioritization**: Automatic task reordering based on deadlines and urgency

## Authentication and Authorization
The application implements a token-based security model:

- **Secure Tokens**: Separate read/write access tokens for different operations
- **Long URLs**: Cryptographically secure random URLs for access control
- **Session Management**: PostgreSQL-based session storage using connect-pg-simple

# External Dependencies

## AI Integration
- **OpenAI API**: Used for intelligent task chunking and reprioritization
- **GPT Models**: Latest GPT model integration for natural language processing of task descriptions

## UI and Styling
- **Radix UI**: Comprehensive set of accessible React components for core UI elements
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide Icons**: Consistent icon library for UI elements
- **Inter Font**: Google Fonts integration for typography

## Database and Storage
- **Neon Database**: Serverless PostgreSQL hosting platform
- **Drizzle ORM**: Type-safe database toolkit for schema management and queries
- **PostgreSQL**: Primary database engine for persistent data storage

## Development and Build Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Type safety and enhanced developer experience
- **React Query**: Data fetching and caching library for API interactions
- **Wouter**: Lightweight routing solution for React applications

## PWA and Performance
- **Service Worker**: Custom implementation for offline functionality and caching
- **Web Speech API**: Browser-native speech recognition for voice input
- **React Hook Form**: Form state management and validation
- **Date-fns**: Date manipulation and formatting utilities

## Hosting and Deployment
- **Replit Integration**: Development environment plugins and tools
- **Node.js Runtime**: Server-side JavaScript execution environment
- **ESBuild**: Fast JavaScript bundler for production builds