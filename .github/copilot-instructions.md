# Tinrlike/Honda Code Style Guide

This repository contains a game and game engine.

## Project Structure

```
src/ai              - AI code
src/assets          - UI assets (for vue)
src/constants       - Game constants
src/honda           - Game engine code
src/scripts         - Game scripts
src/ui              - UI code (for vue)
src/scenes          - Files that set up game scenes
src/main.ts         - Entry point for the game
src/pipeline.ts     - GPU pipeline init
```

### Engine Code Structure

```
./honda/backends/**/  - Backend-specific code (Noop, WebGPU)
./honda/core/         - Core engine code (ECS, scene graph, transforms)
./honda/gpu2/         - GPU abstraction layer (wraps backends)
./storage/            - Data Storage
./systems/**/         - Game systems and their components (physics, sounds, scripting, etc.)
./ui/                 - UI core (for communication between game and UI)
./util/               - Other system-like things and functions
./util/cache/         - Caching utilities
./util/gltf/          - GLTF loading utilities
```

## Extra Notes

- We use $ prefixed names for internal properties/methods. These should be used with caution from game code.

