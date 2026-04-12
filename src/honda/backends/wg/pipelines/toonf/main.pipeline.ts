import type { WGpu } from "../../gpu";
import { TRI_LIST_CULLED, VERTEX_POS_UV_NORM } from "../constants";

type TMainKind = "mainAlphaClip" | "mainAlphaBlend";

const prefixMap: Record<TMainKind, string> = {
    mainAlphaClip: "mac",
    mainAlphaBlend: "mab",
}

export function createMainPipeline(
    g: WGpu,
    kind: TMainKind,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    multisample: number,
): GPURenderPipeline {
    const module = g.getShaderModule("toonf/toon");

    return g.device.createRenderPipeline({
        label: `${kind}:${depthFormat}:${multisample}x`,
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [
                g.bindGroupLayouts["toonf/main"],
                g.bindGroupLayouts.material,
            ],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
            entryPoint: `m_vertex`,
            buffers: VERTEX_POS_UV_NORM,
        },
        fragment: {
            module,
            entryPoint: `${prefixMap[kind]}_fragment`,
            targets: [
                {
                    format: colorFormat,
                    blend: kind === "mainAlphaBlend" ? {
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
                    } : undefined,

                },
            ],
        },
        depthStencil: {
            format: depthFormat,
            depthCompare: "greater-equal",
            depthWriteEnabled: true,
        },
        multisample: {
            alphaToCoverageEnabled: false,
            count: multisample,
        },
    });
}

const _cache: Record<string, GPURenderPipeline> = {};

export function getMainPipeline(
    g: WGpu,
    kind: TMainKind,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    multisample: number,
): GPURenderPipeline {
    const key = `${kind}:${colorFormat}:${depthFormat}:${multisample}x`;
    if (!_cache[key]) {
        _cache[key] = createMainPipeline(
            g,
            kind,
            colorFormat,
            depthFormat,
            multisample,
        );
    }
    return _cache[key];
}
