import { makeShaderDataDefinitions, type ShaderDataDefinitions, type StructDefinition } from "webgpu-utils";
import { nn } from "@/honda/util";
import type { WGpuComposite } from "../../gpu/gpu";
import { createToonLayouts, type ToonLayouts } from "./layouts";
import toonSrc from "./toon.wgsl?raw";

/**
 * Everything ToonF passes share: the shader module, its struct reflection,
 * bind group layouts and a pipeline cache. Lives and dies with the RP.
 */
export class ToonContext {
    public readonly module: GPUShaderModule;
    public readonly defs: ShaderDataDefinitions;
    public readonly layouts: ToonLayouts;

    private _pipelines = new Map<string, GPURenderPipeline>();

    public constructor(public readonly wg: WGpuComposite) {
        this.module = wg.device.createShaderModule({
            label: "toonf/toon",
            code: toonSrc,
        });
        this.defs = makeShaderDataDefinitions(toonSrc);
        this.layouts = createToonLayouts(wg.device);
    }

    public get device(): GPUDevice {
        return this.wg.device;
    }

    public struct(name: string): StructDefinition {
        return nn(this.defs.structs[name], `No struct '${name}' in toon.wgsl`);
    }

    public pipeline(key: string, create: () => GPURenderPipeline): GPURenderPipeline {
        return this._pipelines.getOrInsertComputed(key, create);
    }
}
