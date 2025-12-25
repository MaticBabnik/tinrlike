import type { WGpu } from "../gpu";

function createBloomThreshold(gpu: WGpu, fmt: GPUTextureFormat) {
    const module = gpu.getShaderModule("bloom");

    return gpu.device.createRenderPipeline({
        label: `bloom:threshold:${fmt}`,
        layout: gpu.device.createPipelineLayout({
            bindGroupLayouts: [gpu.bindGroupLayouts.bloom],
        }),
        vertex: { module },
        fragment: {
            module,
            targets: [{ format: fmt }],
        },
    });
}

function createBloomBlur(
    gpu: WGpu,
    fmt: GPUTextureFormat,
    additive: boolean = false,
) {
    const module = gpu.getShaderModule("blur");

    return gpu.device.createRenderPipeline({
        label: `bloom:blur:${fmt}${additive ? ":additive" : ""}`,
        layout: gpu.device.createPipelineLayout({
            bindGroupLayouts: [gpu.bindGroupLayouts.blur],
        }),
        vertex: { module },
        fragment: {
            module,
            targets: [
                {
                    format: fmt,
                    blend: additive
                        ? {
                              alpha: {
                                  operation: "max",
                                  srcFactor: "one",
                                  dstFactor: "one",
                              },
                              color: {
                                  operation: "add",
                                  srcFactor: "one",
                                  dstFactor: "one",
                              },
                          }
                        : undefined,
                },
            ],
        },
    });
}

const cache = new Map<string, GPURenderPipeline>();

export function getBloomThresholdPipeline(gpu: WGpu, fmt: GPUTextureFormat) {
    const key = `bloom:threshold:${fmt}`;

    if (!cache.has(key)) {
        const pipeline = createBloomThreshold(gpu, fmt);
        cache.set(key, pipeline);
    }

    return cache.get(key)!;
}

export function getBloomBlurPipeline(
    gpu: WGpu,
    fmt: GPUTextureFormat,
    additive: boolean = false,
) {
    const key = `bloom:blur:${fmt}:${additive}`;

    if (!cache.has(key)) {
        const pipeline = createBloomBlur(gpu, fmt, additive);
        cache.set(key, pipeline);
    }

    return cache.get(key)!;
}
