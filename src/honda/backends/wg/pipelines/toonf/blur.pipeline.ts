import type { WGpu } from "../../gpu";

function createBlur(
    gpu: WGpu,
    fmt: GPUTextureFormat,
    additive: boolean = false,
) {
    const module = gpu.getShaderModule("toonf/toon");

    return gpu.device.createRenderPipeline({
        label: `blur:${fmt}${additive ? ":additive" : ""}`,
        layout: gpu.device.createPipelineLayout({
            bindGroupLayouts: [gpu.bindGroupLayouts['toonf/blur']],
        }),
        vertex: { module, entryPoint: "br_vertex" },
        fragment: {
            module,
            entryPoint: "br_fragment",
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

export function getBlurPipeline(
    gpu: WGpu,
    fmt: GPUTextureFormat,
    additive: boolean = false,
) {
    const key = `${fmt}:${additive}`;

    if (!cache.has(key)) {
        const pipeline = createBlur(gpu, fmt, additive);
        cache.set(key, pipeline);
    }

    return cache.get(key)!;
}
