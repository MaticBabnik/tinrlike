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

The only backend is WebGPU (`WGpu`). It is abstract enough that `src/honda/gpu2/` defines interfaces (`IGPUImplementation`, `IGPUBuf`, `IGPUTex`, `IGPUMat`) that the rest of the engine uses.

`WGpu` owns:

- **Viewport textures** — resizable render targets (`ViewportTexture`, `ViewportMipTexture`, `ShadowMapTexture`) that are automatically reallocated on canvas resize.
- **Bind group layouts** — created once in `createBindGroupLayouts()` and reused across passes.
- **Shader loading** — all `.wgsl` files under `src/honda/backends/wg/shaders/` are eagerly imported as strings via `import.meta.glob`, parsed by `webgpu-utils` `makeShaderDataDefinitions` to produce struct reflection data. Shaders are accessed by path without the `.wgsl` suffix (e.g. `"toonf/toon"`).
- **Passes** — `IPass` objects added via `gpu.addPass()`; called in order each frame.
- **GPU timestamp queries** — performance profiling with per-pass labels.

### Render pipelines (Render Paths)

Two render paths exist under `src/honda/backends/wg/passes/`:

| Path    | Directory                            | Description                      |
|---------|--------------------------------------|----------------------------------|
| `toonF` | `passes/toonf/` + `pipelines/toonf/` | Active toon-shaded deferred path |
| `def1`  | `passes/def1/` + `pipelines/def1/`   | Legacy deferred path             |

The active path is assembled in `src/toonf.rp.ts`, which creates all buffers and passes and wires them together. Pass order: GatherData → Depth → Shadowmaps → Main → (Resolve if MSAA) → Bloom → Post.

**GatherDataPass** reads from ECS systems each frame (camera matrices, mesh instances, lights) and uploads them to GPU buffers for downstream passes.

### Animation system (`src/honda/animation/`)

Two generations coexist:

- **`HAnimation`** (legacy) — flat list of channels driven directly by a time value; stores sampled data on `SceneNode.transform`.
- **`AnimationLayerStack` / `HAnim2Clip` / `HAnim2LayerDriver`** (current) — layer-based blending. A `AnimationLayerDef` describes a skeleton (joints by glTF node ID). An `AnimationLayerStack` holds named `AnimationLayer`s, each with per-bone weights and masks. `HAnim2LayerDriver` attaches a clip to a layer and samples it.

### glTF loading (`src/honda/util/gltf/`)

`GltfBinary` loads raw glTF binary; `GltfLoader` parses it into engine objects (scene nodes, meshes, materials, lights, animations, skins). Loaded assets are cached and registered with `AssetService` by name. Nodes get `meta.gltfId` and `meta.gltfNodeId` for animation binding.

### Settings persistence

`WGSettings` (anisotropy, multisample, renderScale, shadowMapSize, debugRenderers) is stored in `localStorage` via `GameStorage` (`src/storage.ts`) under the key `"settings"`.

### Path alias

`@/` maps to `src/` (configured in `tsconfig.app.json`).
