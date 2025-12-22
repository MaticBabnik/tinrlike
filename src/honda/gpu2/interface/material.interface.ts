import type { IGPUTex } from "./texture.interface";
import type { Four, Three } from "./types";
import type { IRefCnt } from "./rc.interface";
import type { GPUMatAlpha } from "./enums";

export interface IGPUMatDesc {
    label?: string;
    colorFactor?: Four<number>;
    emissionFactor?: Three<number>;
    metallicFactor?: number;
    roughnessFactor?: number;
    alphaCutoff?: number;
    normalScale?: number;
    alphaMode?: GPUMatAlpha;

    baseTexture: IGPUTex | undefined;
    metRhgTexture: IGPUTex | undefined;
    normalTexture: IGPUTex | undefined;
    emissionTexture: IGPUTex | undefined;
}

export interface IGPUMat
    extends IRefCnt,
        Required<Omit<IGPUMatDesc, `${string}Texture`>> {
    get baseTexture(): IGPUTex | undefined;
    get metRhgTexture(): IGPUTex | undefined;
    get normalTexture(): IGPUTex | undefined;
    get emissionTexture(): IGPUTex | undefined;

    push(): void;
}
