import {
    makeShaderDataDefinitions,
    type ShaderDataDefinitions,
} from "webgpu-utils";
import { ParsedRegistry, parseIntoRegistry } from "wesl";
import { WebGpu } from "..";

type ShaderKey =
    | "flipx"
    | "bloom"
    | "blur1d"
    | "g"
    | "gnorm"
    | "postprocess"
    | "shade"
    | "shadow"
    | "sky"
    | "ssao"
    | "rgbmload"
    | "compute_ibl"
    | "devsprite";

const shaderSources = import.meta.glob("./*.wgsl", {
    eager: true,
    query: "raw",
    import: "default",
}) as Record<ShaderKey, string>;

const sources2 = import.meta.glob("./**/*.w(e|g)sl", {
    eager: true,
    query: "raw",
    import: "default",
});

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

export function createShaderContext() {
    const registry: ParsedRegistry = { modules: {} };

    const pathsFixed = Object.fromEntries(Object.entries(sources2 as Record<string, string>).map(([k, v]) => [k.replace(/^\.\//, ''), v]));

    parseIntoRegistry(pathsFixed, registry, "honda", "honda");

    return registry;
}
