import type { WebGpu } from "..";
import { TRI_LIST_CULLED, VERTEX_POS_UV } from "./constants";

export function createShadow(g: WebGpu) {
    const { module } = g.shaderModules.shadow;

    return g.device.createRenderPipeline({
        label: "shadow",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.shadow],
        }),
        // There used to be a comment about rendering both sides here
        // DO NOT! it leads to light bleeding on one-sided geometry
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
            buffers: VERTEX_POS_UV,
        },
        fragment: {
            module,
            targets: [],
        },
        depthStencil: {
            format: "depth24plus",
            depthCompare: "greater",
            depthWriteEnabled: true,
            depthBias: -5,
            depthBiasSlopeScale: -5,
            depthBiasClamp: -100,
        },
    });
}
