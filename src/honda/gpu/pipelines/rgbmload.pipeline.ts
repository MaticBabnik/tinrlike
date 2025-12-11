import type { WebGpu } from "..";
import { TRI_LIST_CULLED } from "./constants";

export function createRgbmload(g: WebGpu) {
    const { module } = g.shaderModules.rgbmload;

    return g.device.createRenderPipeline({
        label: "rgbmload",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.rgbmload],
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
