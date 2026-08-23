import { hsym, type IService } from "../core/ecs";
import type { Three } from "../util/types";

export interface PostCfg {
    gamma: number;
    exposure: number;

    bloomPower: number;

    saturation: number;
    vignette: number;
    grain: number;
    chromaticAberration: number;
    colorAdd: Three<number>;
    colorMul: Three<number>;
}

export interface BloomCfg {
    threshold: number;
    knee: number;
    maxPasses: number;
}

export interface GlitchCfg {
    enabled: boolean;
    offset: number;
    probability: number;
    reroll: boolean;
    rotate: boolean;
    blockSize: number;
}

/**
 * A singleton that gets read by the RP
 */
export class VisualService implements IService {
    public readonly name = "VisualService";

    public readonly bloomConfig: BloomCfg = {
        threshold: 10,
        knee: 0.6,
        maxPasses: 10,
    };

    public readonly postConfig: PostCfg = {
        gamma: 1.4,
        exposure: 5,
        bloomPower: 0.5,
        saturation: 1,
        vignette: .5,
        grain: 0.05,
        chromaticAberration: 0.05,
        colorAdd: [0, 0, 0],
        colorMul: [1, 1, 1],
    };

    public readonly glitchConfig: GlitchCfg = {
        enabled: false,
        offset: 0,
        probability: 0.3,
        reroll: false,
        rotate: false,
        blockSize: 32,
    };
}

export const VisualSrv = hsym<VisualService>("VisualService");
