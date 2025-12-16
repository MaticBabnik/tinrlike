import type { WebGpu } from "..";

export function createDebugline(g: WebGpu) {
    const { module } = g.shaderModules.devline;

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
