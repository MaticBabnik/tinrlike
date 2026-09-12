# WG GPU backend: analysis & proposed structure

Covers `src/honda/backends/wg/gpu.ts` (monolith) and `src/honda/backends/wg/gpu/gpu1Core.ts … wgLayered.ts` (layered).

---

## 1. Bugs found

this will be adressed in the proposed design...

## 2. Why both designs are hard to work with
Reply: i know
---

## 3. Proposed pattern: independent modules + one orchestrator + a per-frame context

### Rules

1. **Modules don't know about each other.** Each concern is a small class that receives only what it needs (usually just the `GPUDevice`):
   - `WGSurface`: canvas, DPR / render scale, queued resize, acquiring the current canvas texture
   - `WGTimestamps`: query set, resolve, readback; owns its own "map pending?" state
   - `WGSamplerCache`: sampler key, cache, anisotropy
   - `WGGraveyard`: deferred destroy queue
2. **Only the orchestrator (`WGpu`) calls modules.** It owns *all* sequencing and *all* state. Cross-cutting behaviour ("on resize, resize viewports", "on device lost, stop rendering") is one visible line in `startFrame` / `frameEnd`, not a hook in another file.
3. **Per-frame state is an object that only exists during a frame.** Encoder, canvas target, and timestamp allocator live on a `WGFrame`, created in `startFrame` and dropped in `frameEnd`. Passes receive it as an argument (`apply(frame)`), so a stale or finished encoder can't be reached.

Reply:

1: thats mostly good, it's layers without the inheritance bullshit, it correctly replaces OOP slop with composition
2: does that mean I modules are event emitters? in that case I would prefer the thing.onEvent = (e)=>{} over proper event emitters
3: i like that but I dislike the idea of creating new objects every frame, we can just have one object with a .reset()

> **Answer:**
> 2: No, modules aren't event emitters. They're passive: the orchestrator calls into them and they never call out. Browser events (ResizeObserver, `device.lost`) only set a flag or field inside the module that owns them, and the orchestrator reads it at a safe point (`startFrame`). For anything that has to push outward (to the game), it's exactly your style: a single `onError` / `onLost` callback property. Invalidation (e.g. anisotropy change → materials rebuild bind groups) is pull-based via a version counter (`samplers.version`), so no event is needed there either.
> 3: Agreed. `WGFrame` is one object owned by `WGpu` with `$reset(no, enc, target)` called in `startFrame`. The `GPUCommandEncoder` inside it is still new every frame (WebGPU requires that), but the wrapper isn't.

### State as a discriminated union

Adding "lost" is now trivial, and "in a frame but with no encoder" can't be represented:

```ts
type WGState =
    | { kind: "idle" }
    | { kind: "frame"; frame: WGFrame }
    | { kind: "lost"; reason: string };
```

Reply:
the engine might sometimes do work outside a frame (mostly in load time) so to some extent I think there should always be an encoder available.
on the other hand we can do oneshot encoders which is cleaner. I also don't really want to constantly check the union state (and the state not being frame when doing anything is a panic situation)

my concerns are:
- do modules really only get used by the parent object? does that mean the backend public interface has to "proxy" a bunch of methods?
    I don't hate it but it's still a small pain

> **Answer:** Dropping the union. Status is a plain `const enum WGStatus { Idle, Frame, Lost }` field, with no narrowing at call sites.
> - **Wrong-state access panics:** `gpu.frame` is a getter that asserts `status === Frame`. Nobody checks; misuse just throws.
> - **Lost:** `startFrame` / `render` / `frameEnd` each early-return unless the status is what they expect, so the game loop in `main.ts` doesn't change.
> - **Always an encoder:** `gpu.encoder` is always valid. During a frame it's the frame encoder; otherwise it's the lazily created upload encoder (option B). `gpu.uploads.oneshot(label, enc => …)` covers the "record and submit right now" case at load time.
> - **Graveyard always defers** (no status check at all): a resource can be referenced by either the frame encoder or the pending upload encoder, and it's flushed right after every `submit`, which is always safe.
>
> **Proxying:** no. Rule 2 was too strict. Reworded: *modules never call each other; anyone holding `WGpu` may use a module directly* (`gpu.surface.width`, `gpu.samplers.get(d)`, `gpu.graveyard.bury(buf)`). Only the **lifecycle** methods are orchestrator-only, marked with the `$` prefix the codebase already uses for "internal" members (`$applyQueuedResize`, `$acquire`, `$flush`…). If that's not strict enough later, each module can split into a public interface and a lifecycle interface, but I don't think it's worth the boilerplate now.


### Narrow interfaces for consumers

- Resources (`WGBuf`, `WGTex`, `WGTexData`, `WGMat`) depend on a small `WGResourceHost { device; safeDestroy; samplers }` instead of a concrete class.
- Render pipelines and passes depend on a `WGRPHost` (device, bind group layouts, surface info) plus the `WGFrame` passed to `apply(frame)`.
- This removes `this as any` and lets the orchestrator change without touching passes.

Reply: the `this as any` thing is just because some things depend on the full object that you can't really pass from a non-final layer

> **Answer:** Right, and composition fixes that for free: `WGpu` is the final type from the first line of its constructor, so `this` can be passed anywhere, fully typed. Given that and your migration replies 3 and 4, I'm **dropping `WGResourceHost` / `WGRPHost`**. Resources, RPs and passes all take the whole `WGpu` and may keep it. Modules are built first and only receive the `GPUDevice` (plus the canvas for the surface), so nothing sees a half-built `WGpu`.


### What this buys

- Cross-module interactions are ordinary sequential code in one ~150-line file. That's the only file you read to understand the frame lifecycle.
- Layered bugs 1, 4, 6 become impossible or local: the encoder is per-frame, destroy safety reads state directly, and the timestamp module owns its own pending-map flag.
- Each module is readable in isolation: `WGSurface` knows nothing about perf, `WGSamplerCache` knows nothing about frames.
- Precedent: wgpu-rs apps and Bevy's `RenderContext` work this way. A long-lived device context, a short-lived frame/encoder context passed down, and a single owner of sequencing.

Reply: ig bro

### Open question: work outside a frame

`WGBuf.copy` currently uses `gpu.cmdEncoder`, which may be called outside a frame. Options:

- **A.** Require a `WGFrame` argument (only callable during rendering).
- **B.** The orchestrator keeps a lazily created *upload encoder*. Out-of-frame copies go there, and `startFrame` submits it before the frame encoder. That's one more explicit line in the orchestrator.

Reply: i prefer B as I wouldn't want downstream things to implement their own logic

> **Answer:** B it is: the `WGUploads` module in `new-api.ts`. `frameEnd` submits `[uploads.$take(), frame.enc.finish()]` in one call, and `uploads.flush()` submits early when needed.
> One caveat, documented on the interface: `queue.writeBuffer` runs at call time, while copies recorded in the upload encoder only run at flush. So "record a copy from buffer X, then `writeBuffer(X)`" would copy the *new* data. Use `oneshot` when that ordering matters; for normal load-time uploads it doesn't.

---

## 4. Suggested migration

1. Extract the modules (`WGSurface`, `WGTimestamps`, `WGSamplerCache`, `WGGraveyard`) from the layered files, fixing the bugs above as they move.
2. Write the orchestrator `WGpu` against them.
3. Introduce `WGResourceHost` / `WGRPHost` and retype resources and `IWGRenderPipeline` against those.
4. Change `IPass.apply()` → `apply(frame: WGFrame)` and port passes one at a time.
5. Delete `gpu/gpu1Core.ts … wgLayered.ts` and the old monolith.

Reply: 
1. make a file called `new-api.ts` do interface-only overview of what your suggesting
2. yes
3. I still think resources should have access to most of the API
4. I think passes should be able to keep long-lived references to the whole `WGpu`

> **Answer:**
> 1. Done: `src/honda/backends/wg/new-api.ts`. Type-only, and it type-checks. The lifecycle ordering is written out in the doc comment on `WGpu`.
> 3. Agreed. Resources take `WGpu` (see the answer above).
> 4. Agreed. That also means **`IPass.apply()` stays argument-free**: passes read `this.gpu.frame.enc` / `this.gpu.frame.timestamp("bloom")`. Since `frame` is a reused singleton, the reference can even be cached on the pass. Step 4 of the migration shrinks to replacing `gpu.cmdEncoder` → `gpu.frame.enc` and `gpu.timestamp` → `gpu.frame.timestamp`.
>
> **Revised migration:**
> 1. Implement the modules (`WGSurface`, `WGSamplerCache`, `WGGraveyard`, `WGTimestamps`, `WGUploads`, `WGFrame`) from the layered files, fixing the section 1 bugs as they move.
> 2. Implement the orchestrator `WGpu` per `new-api.ts`.
> 3. Retype `IWGRenderPipeline` / factories against the new `WGpu`, and rename `cmdEncoder` / `timestamp` / `safeDestroy` usages in resources and passes.
> 4. Swap `main.ts` over.
> 5. Delete the old files.
5. will do

---

## 5. Round 2 decisions (supersede the answers above where they differ)

- **No graveyard.** Destroy is immediate; not destroying something that's recorded but not yet submitted is the caller's job. (Destroy *after* submit is always safe per the WebGPU spec, so the old `onSubmittedWorkDone` wait was never needed.)
- **No `WGUploads`, no `WGFrame`.** A single always-valid `gpu.encoder`: the frame encoder during a frame, otherwise lazily created on first access in each non-frame period and submitted at the next `startFrame` (or `gpu.flush()`). No `oneshot()`. The frame-only pieces are asserted individually: `gpu.surface.target` asserts `Frame`, and `gpu.timestamp()` returns undefined outside a frame.
- **`$` prefix** marks private/unsafe members on modules (TS has no friend classes).
- **Pull vs. callbacks:** pull for anything the frame loop consumes (resize, `samplers.version`, perf readback); a single `onX` property for rare outward events with no loop to poll from (`onLost`, `onError`).

- **Bind group layouts belong to render pipelines**, not `WGpu`. `WGpu` knows nothing about what it renders; it only runs whatever RP is active.

`new-api.ts` reflects this.
