import type { WebGpu } from "..";
import { DEPTHTEST_GREATER_WRITE, TRI_STRIP_CULLED } from "./constants";

export function createDevsprite(g: WebGpu) {
    const { module } = g.shaderModules.devsprite;

    return g.device.createRenderPipeline({
        label: "devsprite",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [],
        }),
        primitive: TRI_STRIP_CULLED,
        vertex: { module },
        fragment: {
            module,
            targets: [{ format: "rgba8unorm-srgb" }],
        },
        depthStencil: DEPTHTEST_GREATER_WRITE,
    });
}
