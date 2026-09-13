import type { ToonContext } from "../context";

export function getBlurPipeline(ctx: ToonContext, fmt: GPUTextureFormat, additive: boolean = false) {
    const label = `blur:${fmt}${additive ? ":additive" : ""}`;

    return ctx.pipeline(label, () => {
        const module = ctx.module;

        return ctx.device.createRenderPipeline({
            label,
            layout: ctx.device.createPipelineLayout({
                bindGroupLayouts: [ctx.layouts["toonf/blur"]],
            }),
            vertex: { module, entryPoint: "br_vertex" },
            fragment: {
                module,
                entryPoint: "br_fragment",
                targets: [
                    {
                        format: fmt,
                        blend: additive
                            ? {
                                  alpha: {
                                      operation: "max",
                                      srcFactor: "one",
                                      dstFactor: "one",
                                  },
                                  color: {
                                      operation: "add",
                                      srcFactor: "one",
                                      dstFactor: "one",
                                  },
                              }
                            : undefined,
                    },
                ],
            },
        });
    });
}
