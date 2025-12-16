import {
    makeShaderDataDefinitions,
    type ShaderDataDefinitions,
} from "webgpu-utils";
import type { WebGpu } from "..";

type ShaderKey =
    | "bloom"
    | "blur1d"
    | "compute_ibl"
    | "devline"
    | "devsprite"
    | "flipx"
    | "g"
    | "gnorm"
    | "gskin"
    | "postprocess"
    | "rgbmload"
    | "shade"
    | "shadow"
    | "shadowSkin"
    | "sky"
    | "ssao";

const shaderSources = import.meta.glob("./*.wgsl", {
    eager: true,
    query: "raw",
    import: "default",
}) as Record<ShaderKey, string>;

export default shaderSources;

interface IShaderModule {
    module: GPUShaderModule;
    defs: ShaderDataDefinitions;
}

export function createModules(g: WebGpu) {
    const ax = {} as Record<ShaderKey, IShaderModule>;

    for (const key in shaderSources) {
        const name = key.replace(".wgsl", "").replace("./", "") as ShaderKey;
        const code = shaderSources[key as ShaderKey];

        const module = g.device.createShaderModule({
            code,
            label: name,
        });

        const defs = makeShaderDataDefinitions(code);
        ax[name] = { module, defs };
    }

    return ax;
}
