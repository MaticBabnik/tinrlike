import type { WGpu } from "../gpu";
import { TRI_LIST_CULLED } from "./constants";

export function createBlur(g: WGpu, format: GPUTextureFormat) {
    const { module } = g.shaderModules.blur1d;

    return g.device.createRenderPipeline({
        label: "blur",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.blur],
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
