import {
    GPUMatAlpha,
    type IGPUMat,
    type IGPUMatDesc,
    type IGPUTex,
} from "../interface";
import type { Three, Four } from "@/honda";
import { RefCntBase } from "./refCountBase";

export abstract class MaterialBase extends RefCntBase implements IGPUMat {
    public label: string;

    public readonly baseTexture: IGPUTex | undefined;
    public readonly metRhgTexture: IGPUTex | undefined;
    public readonly normalTexture: IGPUTex | undefined;
    public readonly emissionTexture: IGPUTex | undefined;

    public colorFactor: Four<number> = [1, 1, 1, 1];
    public emissionFactor: Three<number> = [0, 0, 0];
    public metallicFactor = 0;
    public roughnessFactor = 1;
    public alphaCutoff = 0.5;
    public normalScale = 1;
    public alphaMode: GPUMatAlpha = GPUMatAlpha.MASK;

    public constructor(d: IGPUMatDesc) {
        super();
        this.baseTexture = d.baseTexture;
        this.metRhgTexture = d.metRhgTexture;
        this.normalTexture = d.normalTexture;
        this.emissionTexture = d.emissionTexture;
        this.label = d.label ?? "Material";
        this.colorFactor = d.colorFactor ?? [1, 1, 1, 1];
        this.emissionFactor = d.emissionFactor ?? [0, 0, 0];
        this.metallicFactor = d.metallicFactor ?? 0;
        this.roughnessFactor = d.roughnessFactor ?? 1;
        this.alphaCutoff = d.alphaCutoff ?? 0.5;
        this.normalScale = d.normalScale ?? 1;
        this.alphaMode = d.alphaMode ?? GPUMatAlpha.MASK;

        this.baseTexture?.rcUse();
        this.metRhgTexture?.rcUse();
        this.normalTexture?.rcUse();
        this.emissionTexture?.rcUse();
    }

    public abstract push(): void;

    protected _rcDestroy(): void {
        this.baseTexture?.rcRelease();
        this.metRhgTexture?.rcRelease();
        this.normalTexture?.rcRelease();
        this.emissionTexture?.rcRelease();
    }
}
