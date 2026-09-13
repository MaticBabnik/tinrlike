import type { ToonContext } from "../context";
import { TRI_LIST_CULLED } from "../../../pipelineConstants";

export function getPostPipeline(ctx: ToonContext, targetFormat: GPUTextureFormat): GPURenderPipeline {
    return ctx.pipeline(`post:${targetFormat}`, () => {
        const module = ctx.module;

        return ctx.device.createRenderPipeline({
            label: `post:${targetFormat}`,
            layout: ctx.device.createPipelineLayout({
                bindGroupLayouts: [ctx.layouts["toonf/post"]],
            }),
            primitive: TRI_LIST_CULLED,
            vertex: { module, entryPoint: "p_vertex" },
            fragment: {
                module,
                entryPoint: "p_fragment",
                targets: [{ format: targetFormat }],
            },
        });
    });
}
