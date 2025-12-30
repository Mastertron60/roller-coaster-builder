# Roller Coaster Builder

## Overview

This is an interactive 3D roller coaster builder game built with React and Three.js. Users can place track points on the ground to create custom roller coaster tracks, adjust their heights by dragging, and then ride the coaster in first-person view. The application uses a fullscreen WebGL canvas with a build mode for construction and a ride mode for experiencing the created track.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The application is a React single-page application using Three.js (via React Three Fiber) for 3D rendering:

- **React Three Fiber**: Provides declarative 3D scene management through React components
- **@react-three/drei**: Helper components for common 3D patterns (OrbitControls, textures, lines)
- **Zustand**: Lightweight state management for game state, audio, and roller coaster data
- **Tailwind CSS + shadcn/ui**: UI component library for overlay controls and HUD elements
- **Vite**: Build tool with hot module replacement and GLSL shader support

### Key Game Components

- **TrackBuilder**: Handles ground plane interaction for placing track points
- **TrackPoint**: Individual draggable control points for adjusting track height
- **Track**: Renders the spline-based track using Catmull-Rom curves with rail and support geometry
- **CoasterCar**: The ride vehicle that follows the track curve
- **BuildCamera/RideCamera**: Switches between orbit controls (build mode) and first-person following (ride mode)
- **GameUI**: Overlay interface with mode controls and track manipulation buttons

### State Management

Three Zustand stores manage application state:
- `useRollerCoaster`: Track points, ride progress, mode switching (build/ride)
- `useGame`: Generic game phase management (ready/playing/ended)
- `useAudio`: Sound effect control and muting

### Backend Architecture

The backend uses Express.js with a simple structure:
- **Express server** with JSON body parsing and request logging middleware
- **Vite middleware** integration for development HMR
- **Static file serving** for production builds
- **Storage interface pattern** with in-memory implementation (MemStorage) ready for database swapping

### Data Storage

- **Drizzle ORM** configured with PostgreSQL dialect
- **Schema** defined in `shared/schema.ts` with a basic users table
- **drizzle-zod** integration for schema validation
- Current implementation uses in-memory storage but is structured for easy PostgreSQL migration

### Build System

Custom build script (`script/build.ts`) that:
- Builds frontend with Vite to `dist/public`
- Bundles server with esbuild to `dist/index.cjs`
- Selectively bundles common dependencies to reduce cold start times
- Outputs CommonJS for Node.js compatibility

## External Dependencies

### 3D Graphics
- **three**: Core WebGL library
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Helper components (OrbitControls, useTexture, Line)
- **@react-three/postprocessing**: Visual effects (not heavily used currently)
- **vite-plugin-glsl**: GLSL shader imports

### Database
- **drizzle-orm**: Type-safe ORM
- **drizzle-kit**: Schema migrations and push
- **pg**: PostgreSQL client
- **connect-pg-simple**: Session storage (available but not implemented)

### UI Framework
- **@radix-ui/\***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### State & Data Fetching
- **zustand**: Lightweight state management
- **@tanstack/react-query**: Server state management (configured but minimal API usage)

### Server
- **express**: Web framework
- **express-session**: Session management (available)
- **zod**: Runtime validation