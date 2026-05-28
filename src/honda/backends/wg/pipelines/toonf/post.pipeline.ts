import type { WGpu } from "../../gpu";
import { TRI_LIST_CULLED } from "../constants";

export function createPostPipeline(
    g: WGpu,
    targetFormat: GPUTextureFormat,
): GPURenderPipeline {
    const module = g.getShaderModule(`toonf/toon`);

    return g.device.createRenderPipeline({
        label: `post:${targetFormat}`,
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts["toonf/post"]],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: { module, entryPoint: "p_vertex" },
        fragment: {
            module,
            entryPoint: "p_fragment",
            targets: [
                {
                    format: targetFormat,
                },
            ],
        },
    });
}

const _cache: Record<string, GPURenderPipeline> = {};

export function getPostPipeline(
    g: WGpu,
    targetFormat: GPUTextureFormat,
): GPURenderPipeline {
    const key = `${targetFormat}`;
    if (!_cache[key]) {
        _cache[key] = createPostPipeline(g, targetFormat);
    }
    return _cache[key];
}
