import type { ToonContext } from "../context";
import { TRI_LIST_CULLED, VERTEX_POS_UV_NORM } from "../../../pipelineConstants";

export interface IFresnelPipelineDesc {
    /** group(1) layout, owned by the material implementation */
    material: GPUBindGroupLayout;
    colorFormat: GPUTextureFormat;
    depthFormat: GPUTextureFormat;
    multisample: number;
}

/**
 * Additive, depth tested but not written: the surface itself is invisible,
 * only the emitted fresnel term gets added on top of what's behind it.
 */
export function getFresnelPipeline(ctx: ToonContext, d: IFresnelPipelineDesc): GPURenderPipeline {
    const key = `mainFresnel:${d.material.label}:${d.colorFormat}:${d.depthFormat}:${d.multisample}x`;

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
                entryPoint: "m_vertex",
                buffers: VERTEX_POS_UV_NORM,
            },
            fragment: {
                module,
                entryPoint: "mf_fragment",
                targets: [
                    {
                        format: d.colorFormat,
                        blend: {
                            color: {
                                srcFactor: "one",
                                dstFactor: "one",
                                operation: "add",
                            },
                            alpha: {
                                srcFactor: "zero",
                                dstFactor: "one",
                                operation: "add",
                            },
                        },
                    },
                ],
            },
            depthStencil: {
                format: d.depthFormat,
                depthCompare: "greater-equal",
                depthWriteEnabled: false,
            },
            multisample: {
                alphaToCoverageEnabled: false,
                count: d.multisample,
            },
        });
    });
}
