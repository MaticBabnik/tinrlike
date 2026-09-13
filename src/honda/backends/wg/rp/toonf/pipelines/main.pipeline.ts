import type { ToonContext } from "../context";
import { TRI_LIST_CULLED, VERTEX_POS_UV_NORM } from "../../../pipelineConstants";

export type TMainKind = "mainAlphaClip" | "mainAlphaBlend";

const prefixMap: Record<TMainKind, string> = {
    mainAlphaClip: "mac",
    mainAlphaBlend: "mab",
};

export interface IMainPipelineDesc {
    kind: TMainKind;
    /** group(1) layout, owned by the material implementation */
    material: GPUBindGroupLayout;
    colorFormat: GPUTextureFormat;
    depthFormat: GPUTextureFormat;
    multisample: number;
    skin?: boolean;
}

export function getMainPipeline(ctx: ToonContext, d: IMainPipelineDesc): GPURenderPipeline {
    const skin = d.skin ?? false;
    const key = `${d.kind}:${d.material.label}:${d.colorFormat}:${d.depthFormat}:${d.multisample}x:${skin}`;

    return ctx.pipeline(key, () => {
        const module = ctx.module;

        return ctx.device.createRenderPipeline({
            label: key,
            layout: ctx.device.createPipelineLayout({
                bindGroupLayouts: [ctx.layouts["toonf/main"], d.material],
            }),
            primitive: TRI_LIST_CULLED,
            vertex: {
                module,
                entryPoint: skin ? `m_sk_vertex` : `m_vertex`,
                buffers: VERTEX_POS_UV_NORM,
            },
            fragment: {
                module,
                entryPoint: `${prefixMap[d.kind]}_fragment`,
                targets: [
                    {
                        format: d.colorFormat,
                        blend:
                            d.kind === "mainAlphaBlend"
                                ? {
                                      color: {
                                          srcFactor: "src-alpha",
                                          dstFactor: "one-minus-src-alpha",
                                          operation: "add",
                                      },
                                      alpha: {
                                          srcFactor: "one",
                                          dstFactor: "one",
                                          operation: "max",
                                      },
                                  }
                                : undefined,
                    },
                ],
            },
            depthStencil: {
                format: d.depthFormat,
                depthCompare: "greater-equal",
                depthWriteEnabled: true,
            },
            multisample: {
                alphaToCoverageEnabled: false,
                count: d.multisample,
            },
        });
    });
}
