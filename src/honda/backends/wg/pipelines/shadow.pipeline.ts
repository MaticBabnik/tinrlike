import type { WGpu } from "../gpu";
import { TRI_LIST_CULLED, VERTEX_POS_SKIN, VERTEX_POS_UV } from "./constants";

export function createShadowSkin(
    g: WGpu,
    kind: "shadow" | "shadowSkin",
    format: GPUTextureFormat,
): GPURenderPipeline {
    const module = g.getShaderModule(kind);

    return g.device.createRenderPipeline({
        label: `${kind}:${format}`,
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.shadow],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
            buffers: kind === "shadow" ? VERTEX_POS_UV : VERTEX_POS_SKIN,
        },
        fragment: {
            module,
            targets: [],
        },
        depthStencil: {
            format,
            depthCompare: "greater",
            depthWriteEnabled: true,
            depthBias: -5,
            depthBiasSlopeScale: -5,
            depthBiasClamp: -100,
        },
    });
}

const _cache: Record<string, GPURenderPipeline> = {};

export function getShadowPipeline(
    g: WGpu,
    kind: "shadow" | "shadowSkin",
    format: GPUTextureFormat,
): GPURenderPipeline {
    const key = `${kind}:${format}`;
    if (!_cache[key]) {
        _cache[key] = createShadowSkin(g, kind, format);
    }
    return _cache[key];
}
