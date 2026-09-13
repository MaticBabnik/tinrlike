import type { ToonContext } from "../context";
import { TRI_LIST_CULLED, VERTEX_POS_UV } from "../../../pipelineConstants";

export type TDepthKind = "depthOpaque" | "depthAlphaClip";

export interface IDepthPipelineDesc {
    kind: TDepthKind;
    /**
     * group(1) layout, owned by the material implementation.
     * Opaque shaders don't read it, but keeping it in the layout lets passes
     * bind material groups without caring which pipeline is active.
     */
    material: GPUBindGroupLayout;
    format: GPUTextureFormat;
    multisample: number;
    shadow: boolean;
    skin?: boolean;
}

export function getDepthPipeline(ctx: ToonContext, d: IDepthPipelineDesc): GPURenderPipeline {
    const skin = d.skin ?? false;
    const key = `${d.kind}:${d.material.label}:${d.format}:${d.multisample}x:${d.shadow ? "shadow" : "main"}:${skin}`;

    return ctx.pipeline(key, () => {
        const module = ctx.module;

        const prefix = d.kind === "depthOpaque" ? "do" : "dac";
        const vertexPrefix = skin ? `${prefix}_sk` : prefix;

        return ctx.device.createRenderPipeline({
            label: key,
            layout: ctx.device.createPipelineLayout({
                bindGroupLayouts: [ctx.layouts["toonf/depth"], d.material],
            }),
            primitive: d.shadow ? { topology: "triangle-list", cullMode: "none" } : TRI_LIST_CULLED,
            vertex: {
                module,
                entryPoint: `${vertexPrefix}_vertex`,
                buffers: VERTEX_POS_UV,
            },
            fragment: {
                module,
                entryPoint: `${prefix}_fragment`,
                targets: [],
            },
            depthStencil: {
                format: d.format,
                depthCompare: "greater",
                depthWriteEnabled: true,
                depthBias: d.shadow ? -5 : 0,
                depthBiasSlopeScale: d.shadow ? -5 : 0,
                depthBiasClamp: -5,
            },
            multisample: {
                alphaToCoverageEnabled: false,
                count: d.multisample,
            },
        });
    });
}
