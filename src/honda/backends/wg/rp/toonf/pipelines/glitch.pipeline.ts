import type { WGpu } from "../../../gpu";

export function createGlitchPipeline(
    g: WGpu,
    targetFormat: GPUTextureFormat,
): GPURenderPipeline {
    const module = g.getShaderModule(`toonf/toon`);

    return g.device.createRenderPipeline({
        label: `glitch:${targetFormat}`,
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts["toonf/glitch"]],
        }),
        primitive: {
            cullMode: "none",
            topology: "triangle-strip",
        },
        vertex: { module, entryPoint: "pg_vertex" },
        fragment: {
            module,
            entryPoint: "pg_fragment",
            targets: [
                {
                    format: targetFormat,
                },
            ],
        },
    });
}

const _cache: Record<string, GPURenderPipeline> = {};

export function getGlitchPipeline(
    g: WGpu,
    targetFormat: GPUTextureFormat,
): GPURenderPipeline {
    const key = `${targetFormat}`;
    if (!_cache[key]) {
        _cache[key] = createGlitchPipeline(g, targetFormat);
    }
    return _cache[key];
}
