import { WebGpu } from "..";
import { TRI_LIST_CULLED } from "./constants";

export function creatFlipx(g: WebGpu) {
    const { module } = g.shaderModules.flipx;

    return g.device.createRenderPipeline({
        label: "flipx",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.flipx],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: { module },
        fragment: {
            module,
            targets: [{ format: "rgba16float" }],
        },
    });
}
