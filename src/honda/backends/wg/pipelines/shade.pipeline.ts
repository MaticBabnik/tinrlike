import type { WGpu } from "../gpu";
import { TRI_LIST_CULLED } from "./constants";

function createShade(g: WGpu, targetFormat: GPUTextureFormat) {
    const module = g.getShaderModule("shade");

    return g.device.createRenderPipeline({
        label: `shade:${targetFormat}`,

        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.shadeMain],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format: targetFormat }],
        },
    });
}

const _cache = new Map<GPUTextureFormat, GPURenderPipeline>();

export function getShadePipeline(
    g: WGpu,
    targetFormat: GPUTextureFormat,
): GPURenderPipeline {
    let pipeline = _cache.get(targetFormat);
    if (!pipeline) {
        pipeline = createShade(g, targetFormat);
        _cache.set(targetFormat, pipeline);
    }
    return pipeline;
}
