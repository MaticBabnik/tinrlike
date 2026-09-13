import { type AnyMaterial, FresnelMaterial, type IGPUTex, Material, Pass, type PbrMaterial } from "@/honda/gpu2";
import type { Three } from "@/honda/util/types";
import type * as TG from "./gltf.types";
import type { GltfLoader } from "./loader";

export interface GltfMaterialHookCtx {
    readonly loader: GltfLoader;
    readonly index: number;
    readonly json: TG.IMaterial;
    readonly extras: Record<string, unknown>;
    readonly name: string;
    texture(info: TG.ITextureInfo | undefined): IGPUTex | undefined;
    pbr(): Material<typeof PbrMaterial>;
}

export type GltfMaterialHook = (ctx: GltfMaterialHookCtx) => AnyMaterial | undefined;

function isThree(v: unknown): v is Three<number> {
    return Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === "number");
}

// depth only; `__holdout__` name or `holdout: true`
export const holdoutMaterialHook: GltfMaterialHook = (ctx) => {
    if (ctx.json.name !== "__holdout__" && ctx.extras.holdout !== true) {
        return undefined;
    }

    const m = ctx.pbr();
    m.render.passes = Pass.Depth;
    return m;
};

// `fresnelColor: Three<number>`, `fresnelPower?: number`
export const fresnelMaterialHook: GltfMaterialHook = (ctx) => {
    const { fresnelColor: color, fresnelPower: power } = ctx.extras;
    if (color === undefined) return undefined;

    if (!isThree(color)) {
        console.warn(`${ctx.name}: fresnelColor must be [r, g, b]`, color);
        return undefined;
    }

    return new Material(FresnelMaterial, typeof power === "number" ? { color, power } : { color }, ctx.name);
};
