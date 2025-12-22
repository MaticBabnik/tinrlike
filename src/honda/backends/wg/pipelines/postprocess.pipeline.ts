import type { WGpu } from "../gpu";
import { TRI_LIST_CULLED } from "./constants";

export function createPostProcess(
    g: WGpu,
    format: GPUTextureFormat,
): GPURenderPipeline {
    const module = g.getShaderModule("postprocess");

    return g.device.createRenderPipeline({
        label: "post",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.post],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format }],
        },
    });
}

const _cache: Record<string, GPURenderPipeline> = {};

export function getPostProcess(
    g: WGpu,
    format: GPUTextureFormat,
): GPURenderPipeline {
    if (!_cache[format]) {
        _cache[format] = createPostProcess(g, format);
    }
    return _cache[format];
}
