import type { Four, Three } from "../util/types";
import type { IGPUTex } from "./interface";
import { AlphaMode, MaterialType, Pass } from "./material";

export type PbrMaterialProps = {
    baseTexture: IGPUTex | undefined;
    metRghTexture: IGPUTex | undefined;
    normalTexture: IGPUTex | undefined;
    emissionTexture: IGPUTex | undefined;

    colorFactor: Four<number>;
    emissionFactor: Three<number>;
    metallicFactor: number;
    roughnessFactor: number;
    normalScale: number;
};

export const PBR_MATERIAL_DEFAULTS = {
    colorFactor: [1, 1, 1, 1],
    emissionFactor: [0, 0, 0],
    metallicFactor: 0,
    roughnessFactor: 0.5,
    normalScale: 1,
} satisfies Partial<PbrMaterialProps>;

export const PbrMaterial = new MaterialType<
    PbrMaterialProps,
    typeof PBR_MATERIAL_DEFAULTS,
    "alphaMode" | "alphaClip" | "passes"
>("gltfpbr", PBR_MATERIAL_DEFAULTS, {
    alphaMode: AlphaMode.AlphaClip,
    passes: Pass.All,
    alphaClip: 0.5,
});
