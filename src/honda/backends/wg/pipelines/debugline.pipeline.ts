import type { WGpu } from "../gpu";

function createDebugline(g: WGpu, format: GPUTextureFormat): GPURenderPipeline {
    const module = g.getShaderModule("devline");

    return g.device.createRenderPipeline({
        label: "debugline",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.debugline],
        }),
        primitive: {
            topology: "line-list",
            cullMode: "none",
        },
        vertex: {
            module,
            buffers: [],
        },
        fragment: {
            module,
            targets: [
                {
                    format,
                },
            ],
        },
    });
}

const cache = new Map<string, GPURenderPipeline>();

export function getDebuglinePipeline(g: WGpu, format: GPUTextureFormat) {
    const key = `debugline:${format}`;

    if (cache.has(key)) {
        return cache.get(key)!;
    }

    const pipeline = createDebugline(g, format);
    cache.set(key, pipeline);
    return pipeline;
}
