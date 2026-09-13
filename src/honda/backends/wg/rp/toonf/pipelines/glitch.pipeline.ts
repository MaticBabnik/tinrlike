import type { ToonContext } from "../context";

export function getGlitchPipeline(ctx: ToonContext, targetFormat: GPUTextureFormat): GPURenderPipeline {
    return ctx.pipeline(`glitch:${targetFormat}`, () => {
        const module = ctx.module;

        return ctx.device.createRenderPipeline({
            label: `glitch:${targetFormat}`,
            layout: ctx.device.createPipelineLayout({
                bindGroupLayouts: [ctx.layouts["toonf/glitch"]],
            }),
            primitive: {
                cullMode: "none",
                topology: "triangle-strip",
            },
            vertex: { module, entryPoint: "pg_vertex" },
            fragment: {
                module,
                entryPoint: "pg_fragment",
                targets: [{ format: targetFormat }],
            },
        });
    });
}
