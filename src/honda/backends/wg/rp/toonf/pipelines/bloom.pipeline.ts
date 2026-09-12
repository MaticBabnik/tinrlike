import type { WGpu } from "../../../gpu";

function createBloomThreshold(gpu: WGpu, fmt: GPUTextureFormat) {
    const module = gpu.getShaderModule("toonf/toon");

    return gpu.device.createRenderPipeline({
        label: `bloomThreshold:${fmt}`,
        layout: gpu.device.createPipelineLayout({
            bindGroupLayouts: [gpu.bindGroupLayouts["toonf/bloom"]],
        }),
        vertex: { module, entryPoint: "bm_vertex" },
        fragment: {
            module,
            entryPoint: "bm_fragment",
            targets: [{ format: fmt }],
        },
    });
}

const cache = new Map<string, GPURenderPipeline>();

export function getBloomThresholdPipeline(gpu: WGpu, fmt: GPUTextureFormat) {
    const key = fmt;

    if (!cache.has(key)) {
        const pipeline = createBloomThreshold(gpu, fmt);
        cache.set(key, pipeline);
    }

    return cache.get(key)!;
}
