import {
    makeShaderDataDefinitions,
    type ShaderDataDefinitions,
} from "webgpu-utils";

const shaderSources = import.meta.glob("./*.wgsl", {
    eager: true,
    query: "raw",
    import: "default",
}) as Record<string, string>;

export default shaderSources;

interface IShaderModule {
    code: string;
    defs: ShaderDataDefinitions;
    module?: GPUShaderModule;
}

export function getModules() {
    const ax = {} as Record<string, IShaderModule>;

    for (const key in shaderSources) {
        const code = shaderSources[key];
        const name = key.replace(".wgsl", "").replace("./", "");

        const defs = makeShaderDataDefinitions(code);
        ax[name] = { code, defs };
    }

    return ax;
}
