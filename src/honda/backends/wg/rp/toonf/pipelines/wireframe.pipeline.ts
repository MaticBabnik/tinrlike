import type { MeshIndexType } from "@/honda/gpu2";
import type { ToonContext } from "../context";

export interface IWireframePipelineDesc {
    /** group(1) layout, owned by the material implementation */
    material: GPUBindGroupLayout;
    /** group(2) layout, the mesh's position and index storage buffers */
    mesh: GPUBindGroupLayout;
    colorFormat: GPUTextureFormat;
    depthFormat: GPUTextureFormat;
    multisample: number;
    indexType: MeshIndexType;
}

/**
 * Non-indexed line-list without vertex buffers, the vertex shader pulls
 * the mesh from storage. The index type is baked in as an override.
 */
export function getWireframePipeline(ctx: ToonContext, d: IWireframePipelineDesc): GPURenderPipeline {
    const key = `mainWireframe:${d.material.label}:${d.colorFormat}:${d.depthFormat}:${d.multisample}x:idx${d.indexType}`;

    return ctx.pipeline(key, () => {
        const module = ctx.module;

        return ctx.device.createRenderPipeline({
            label: key,
            layout: ctx.device.createPipelineLayout({
                bindGroupLayouts: [ctx.layouts["toonf/main"], d.material, d.mesh],
            }),
            primitive: {
                topology: "line-list",
                cullMode: "none",
            },
            vertex: {
                module,
                entryPoint: "mw_vertex",
                constants: { mw_index_type: d.indexType },
            },
            fragment: {
                module,
                entryPoint: "mw_fragment",
                targets: [{ format: d.colorFormat }],
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
