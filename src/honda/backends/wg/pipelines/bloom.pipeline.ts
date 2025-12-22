import type { WGpu } from "../gpu";
import { TRI_LIST_CULLED } from "./constants";

export function createBloom(g: WGpu) {
    const { module } = g.shaderModules.bloom;

    return g.device.createRenderPipeline({
        label: "bloom",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.bloom],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
        },
        fragment: {
            module,
            targets: [{ format: "rgba16float" }],
        },
    });
}
