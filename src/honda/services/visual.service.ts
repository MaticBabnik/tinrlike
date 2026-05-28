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

/**
 * A singleton that gets read by the RP
 */
export class VisualService implements IService {
    public readonly name = "VisualService";

    public readonly bloomConfig: BloomCfg = {
        threshold: 1,
        knee: 0.5,
        maxPasses: 5,
    };

    public readonly postConfig: PostCfg = {
        gamma: 1.8,
        exposure: 1,
        bloomPower: 1,
        saturation: 1,
        vignette: 1,
        grain: 0,
        chromaticAberration: 0.05,
        colorAdd: [0, 0, 0],
        colorMul: [1, 1, 1],
    };

}

export const VisualSrv = hsym<VisualService>('VisualService');