import type { WGpu } from "../gpu";

export function createDebugline(g: WGpu) {
    const module = g.getShaderModule("devline");

    return g.device.createRenderPipeline({
        label: "debugline",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.debugline],
        }),
        primitive: {
            topology: "line-list",
            cullMode: "none",
        },
        vertex: {
            module,
            buffers: [],
        },
        fragment: {
            module,
            targets: [
                {
                    format: g.pFormat,
                },
            ],
        },
    });
}
