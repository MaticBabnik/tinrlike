import type { WGpu } from "../../gpu";
import { TRI_LIST_CULLED, VERTEX_POS_UV } from "../constants";

export function createDepthPipeline(
    g: WGpu,
    kind: "depthOpaque" | "depthAlphaClip",
    format: GPUTextureFormat,
    multisample: number,
    shadow: boolean,
): GPURenderPipeline {
    const module = g.getShaderModule("toonf/toon");

    return g.device.createRenderPipeline({
        label: `${kind}:${format}:${multisample}x:${shadow ? "shadow" : "main"}`,
        layout: g.device.createPipelineLayout({
            bindGroupLayouts:
                kind === "depthOpaque"
                    ? [g.bindGroupLayouts["toonf/depth"]]
                    : [
                          g.bindGroupLayouts["toonf/depth"],
                          g.bindGroupLayouts["toonf/mat-alpha-clip"],
                      ],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
            entryPoint: kind === "depthOpaque" ? "do_vertex" : "dac_vertex",
            buffers: VERTEX_POS_UV,
        },
        fragment: {
            module,
            entryPoint: kind === "depthOpaque" ? "do_fragment" : "dac_fragment",
            targets: [],
        },
        depthStencil: {
            format,
            depthCompare: "greater",
            depthWriteEnabled: true,
            depthBias: shadow ? -5 : 0,
            depthBiasSlopeScale: shadow ? -5 : 0,
            depthBiasClamp: -5,
        },
        multisample: {
            alphaToCoverageEnabled: false,
            count: multisample,
        },
    });
}

const _cache: Record<string, GPURenderPipeline> = {};

export function getDepthPipeline(
    g: WGpu,
    kind: "depthOpaque" | "depthAlphaClip",
    format: GPUTextureFormat,
    multisample: number,
    shadow = false,
): GPURenderPipeline {
    const key = `${kind}:${format}:${multisample}x:${shadow ? "shadow" : "main"}`;
    if (!_cache[key]) {
        _cache[key] = createDepthPipeline(g, kind, format, multisample, shadow);
    }
    return _cache[key];
}
