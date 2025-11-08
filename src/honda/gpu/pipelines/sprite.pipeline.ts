import { WebGpu } from "..";

export function createSprite(g: WebGpu) {
    const { module } = g.shaderModules.devsprite;

    return g.device.createRenderPipeline({
        label: "sprite",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [
                g.bindGroupLayouts.devsprite
            ],
        }),
        primitive: {
            topology: 'triangle-strip',
            cullMode: 'none',
        },
        vertex: {
            module,
            buffers: []
        },
        fragment: {
            module,
            targets: [{
                format: g.pFormat,
                blend: {
                    color: {
                        srcFactor: 'src-alpha',
                        dstFactor: 'one-minus-src-alpha',
                        operation: 'add',
                    },
                    alpha: {
                        srcFactor: 'one',
                        dstFactor: 'one-minus-src-alpha',
                        operation: 'add',
                    },
                }
            }],

        },
    });
}
