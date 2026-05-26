import { hsym, System } from "@/honda/core/ecs";

/**
 * Basically just a global object for configuring rendering...
 * Stuff like bloom, postprocessing...
 *
 * No components since this is more of a "service" system,
 * not really related to any specific entities.
 *
 * TODO: move system-only systems into "resources"
 */
export class GraphicsSystem extends System {
    public componentType = class {
        public name = "nop";
    };

    public bloomConfig = {
        /**
         * What get's bloomed
         */
        threshold: 1,
        /**
         * Threshold smoothing basically.
         */
        knee: 0.5,
        /**
         * Max number of bloom passes.
         */
        maxPasses: 5,
    };

    public postConfig = {
        gamma: 2.2,

        exposure: 1,

        /**
         * Bloom multiplier basically color + bloom * bloomPower
         */
        bloomPower: 1,

        /**
         * Saturation multiplier. 1 is normal, 0 is grayscale, >1 is oversaturated.
         */
        saturation: 1,

        /**
         * Vignette strength.
         */
        vignette: 0.3,

        /**
         * shitty film grain power
         */
        grain: 0.1,

        /**
         * Amount of chromatic aberration.
         */
        chromaticAberration: 0.1,

        /**
         * Color that gets added to the final image.
         */
        colorAdd: [0, 0, 0],

        /**
         * Tint basically.
         */
        colorMul: [1, 1, 1],
    };
}

export const graphicsSystem = hsym<GraphicsSystem>("graphics");
