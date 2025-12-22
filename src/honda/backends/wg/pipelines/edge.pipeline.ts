import type { WGpu } from "../gpu";
import { TRI_LIST_CULLED } from "./constants";

export function createEdge(
    g: WGpu,
    format: GPUTextureFormat,
): GPURenderPipeline {
    const module = g.getShaderModule("edge");

    return g.device.createRenderPipeline({
        label: `edge:${format}`,
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.edge],
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

export function getEdge(g: WGpu, format: GPUTextureFormat): GPURenderPipeline {
    if (!_cache[format]) {
        _cache[format] = createEdge(g, format);
    }
    return _cache[format];
}
