import type { AlphaMode, AnyMatType, Material } from "@/honda/gpu2/material";
import type { ToonMaterialRegistry } from "./registry";

/**
 * Per-material backend data, stored in `Material.$backendData`.
 * Implementations extend it with whatever they need.
 */
export interface ToonMatSlot {
    /** registry that allocated this slot; slots from another RP are stale */
    readonly owner: ToonMaterialRegistry;
    readonly impl: IToonMatImpl;
    /** stable (per registry) id, used for sorting draws */
    readonly id: number;
    /** last frame the slot was synced with its material */
    frame: number;
    /** group(1) for every geometry pass */
    bindGroup: GPUBindGroup;
}

export type ToonMatSlotBase = Omit<ToonMatSlot, "bindGroup">;

/** render target setup the material pipelines are built for */
export interface ToonMatTargets {
    color: GPUTextureFormat;
    depth: GPUTextureFormat;
    multisample: number;
    shadow: GPUTextureFormat;
}

/**
 * ToonF implementation of one material type.
 */
export interface IToonMatImpl<T extends AnyMatType = AnyMatType, S extends ToonMatSlot = ToonMatSlot> {
    readonly type: T;

    /** create GPU data, fully synced with `m` */
    alloc(m: Material<T>, base: ToonMatSlotBase): S;

    /** sync GPU data with `m` (dirty flags, sampler changes...) */
    update(m: Material<T>, s: S): void;

    free(s: S): void;

    mainPipeline(alpha: AlphaMode): GPURenderPipeline;

    depthPipeline(alpha: AlphaMode, shadow: boolean): GPURenderPipeline;
}
