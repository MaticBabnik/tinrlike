import type * as TG from "./gltf.types";
import type { TTypedArrayCtor, TypedArrays } from "./types";
import { GPUMatAlpha, GPUTexAddr } from "@/honda/gpu2";

export const CTYPE_TO_CTOR = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
} satisfies Record<TG.TComponentType, TTypedArrayCtor<TypedArrays>>;

export const SCALARS_PER_ELEMENT = {
    SCALAR: 1,
    MAT2: 2 * 2,
    MAT3: 3 * 3,
    MAT4: 4 * 4,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    STRING: 0,
} satisfies Record<TG.TAccessorType, number>;

export const SUPPORTED_EXTENSIONS: string[] = [
    "EXT_texture_webp",
    "EXT_texture_avif",
    "KHR_lights_punctual",
    "KHR_materials_emissive_strength",
];

export const SAMPLER_TO_GPU: Record<TG.TWrap, GPUTexAddr> = {
    33071: GPUTexAddr.Clamp,
    33648: GPUTexAddr.Mirror,
    10497: GPUTexAddr.Repeat,
};

export const ALPHA_MODE_MAP: Record<TG.TAlphaMode, GPUMatAlpha> = {
    BLEND: GPUMatAlpha.BLEND,
    MASK: GPUMatAlpha.MASK,
    OPAQUE: GPUMatAlpha.OPAQUE,
};
