import type { ToonContext } from "../context";

export function getBloomThresholdPipeline(ctx: ToonContext, fmt: GPUTextureFormat) {
    return ctx.pipeline(`bloomThreshold:${fmt}`, () => {
        const module = ctx.module;

        return ctx.device.createRenderPipeline({
            label: `bloomThreshold:${fmt}`,
            layout: ctx.device.createPipelineLayout({
                bindGroupLayouts: [ctx.layouts["toonf/bloom"]],
            }),
            vertex: { module, entryPoint: "bm_vertex" },
            fragment: {
                module,
                entryPoint: "bm_fragment",
                targets: [{ format: fmt }],
            },
        });
    });
}
