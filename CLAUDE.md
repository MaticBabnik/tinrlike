# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev        # start Vite dev server
bun run build      # tsc + vite build
bun run type       # type check
bun run lint       # biome lint
bun run format     # biome format --write
```

There are no automated tests in this project.

## Architecture

**tinrlike** is a WebGPU 3D game engine ("Honda") bundled with a game that uses it. The entry point is `src/main.ts`, which mounts systems, creates the GPU backend, wires up the render pipeline, then kicks off `requestAnimationFrame`.

### Engine core (`src/honda/`)

The engine is exposed entirely through `src/honda/index.ts`.

**Global singleton** — `src/honda/state.ts` exports `Game`, a plain object holding all live engine state: `ecs`, `sceneManager`, `gpu`, `input`, `ui`, `time`, `deltaTime`. It is exposed to the browser console as `window.Game`.

**ECS** (`src/honda/core/ecs/`) — `ECS` dispatches component lifecycle events (`componentCreated` / `componentDestroyed`) to the registered `System` that owns that component type, and drives `earlyUpdate → update → lateUpdate` each frame. There is no component query; each system maintains its own internal list.

- `SceneNode` — tree node with a `Transform`, a list of `IComponent`s, and child nodes. Components are registered with the ECS immediately if the node is already in an active scene, or deferred until `attach`.
- `Scene extends SceneNode` — root of the scene tree; `activate()` / `deactivate()` propagate component registration.
- `SceneManager` — holds the live scene, swaps scenes at a safe point via `queueScene()` / `switchPoint()`.

**Systems** (`src/honda/systems/`) — `MeshSystem`, `CameraSystem`, `LightSystem`, `ScriptSystem`, `FizSystem`, `SoundSystem`. Each handles one component type.

**Services** (`src/honda/services/`) — singletons accessed via `Game.ecs.getService(Key)`: `AssetService` (named glTF asset registry), `DebugService`, `VisualService` (bloom config, post-process settings). Both systems and services are identified by typed symbol keys (`HSym<T>`) defined alongside each class.

### GPU backend (`src/honda/backends/wg/`)

The only backend is WebGPU (`WGpuComposite`, `backends/wg/gpu/gpu.ts`). The rest of the engine talks to it through the interfaces in `src/honda/gpu2/` (`IGPUImplementation`, `IGPUBuf`, `IGPUTex`, ...). `backends/noop/` is a placeholder implementation.

`WGpuComposite` owns the device, the canvas surface, deferred resource destruction, GPU timestamp queries, and the active **render path** (`IWGRenderPipeline`). Each frame it opens a command encoder, calls `rp.frame()`, and submits. Render paths are swapped with `switchRp()` (at the next frame) or `$switchRpImmed()`.

### Render path (`backends/wg/rp/`)

`rp/common/` has the render path interface, `WGRenderPipelineBase`, and `IPass`. The only render path is **ToonF** (toon-shaded forward), created by `makeToonForward(ecs, settings)` in `rp/toonf.rp.ts`, which builds all buffers, viewport textures and passes. `rp/toonf/` holds its passes, pipelines, material implementations, and the single shader `toon.wgsl` (reflected with `webgpu-utils` by `ToonContext`, which also caches pipelines and bind group layouts).

Pass order: GatherData → Depth → Shadows → Main → (Resolve if MSAA) → Bloom (if enabled) → Post → Glitch (if enabled).

**GatherDataPass** reads from ECS systems each frame (camera matrices, mesh instances, lights, materials), culls, sorts draws, and uploads them to GPU buffers for downstream passes.

### Materials (`src/honda/gpu2/material/`)

A `MaterialType` declares params, their defaults, and a fixed render state (alpha mode, passes); `Material<T>` is a refcounted instance of one. Types: `PbrMaterial`, `FresnelMaterial`. Backends allocate their data lazily; in ToonF, `ToonMaterialRegistry` maps each type to an `IToonMatImpl` (`rp/toonf/materials/`), and meshes whose type has no implementation are skipped.

### Animation system (`src/honda/animation/`)

Two generations coexist:

- **`HAnimation`** (legacy) — flat list of channels driven directly by a time value; stores sampled data on `SceneNode.transform`.
- **`AnimationLayerStack` / `HAnim2Clip` / `HAnim2LayerDriver`** (current) — layer-based blending. A `AnimationLayerDef` describes a skeleton (joints by glTF node ID). An `AnimationLayerStack` holds named `AnimationLayer`s, each with per-bone weights and masks. `HAnim2LayerDriver` attaches a clip to a layer and samples it.

### glTF loading (`src/honda/util/gltf/`)

`GltfBinary` loads raw glTF binary; `GltfLoader` parses it into engine objects (scene nodes, meshes, materials, lights, animations, skins). Loaded assets are cached and registered with `AssetService` by name. Nodes get `meta.gltfId` and `meta.gltfNodeId` for animation binding.

Material creation can be customized with hooks (`materialHooks.ts`), registered in `main.ts` via `GltfLoader.addMaterialHook()`. The first hook to return a material wins; otherwise the default PBR material is used. Built-in hooks: `holdoutMaterialHook` (`__holdout__` material name or `holdout: true` in extras → depth only) and `fresnelMaterialHook` (`fresnelColor`, `fresnelPower` in extras).

### Settings

There are currently no user settings: the settings menu is an empty placeholder and nothing is loaded from storage. Render settings are hardcoded in `main.ts` (passed to `WGpuComposite.obtain()` and `makeToonForward()`). Debug renderers are planned to come back.

### Path alias

`@/` maps to `src/` (configured in `tsconfig.app.json`).
