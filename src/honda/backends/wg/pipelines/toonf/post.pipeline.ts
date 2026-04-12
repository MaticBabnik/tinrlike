import type { WGpu } from "../../gpu";
import { TRI_LIST_CULLED } from "../constants";

export function createPostPipeline(
    g: WGpu,
    targetFormat: GPUTextureFormat,
    resolve: boolean,
): GPURenderPipeline {
    const module = g.getShaderModule(`toonf/toon`);

    return g.device.createRenderPipeline({
        label: `post:${targetFormat}:${resolve}`,
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [
                g.bindGroupLayouts[
                    resolve ? "toonf/postresolve" : "toonf/post"
                ],
            ],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: { module, entryPoint: "p_vertex" },
        fragment: {
            module,
            entryPoint: resolve ? "pr_fragment" : "p_fragment",
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
    resolve: boolean,
): GPURenderPipeline {
    const key = `${targetFormat}:${resolve}`;
    if (!_cache[key]) {
        _cache[key] = createPostPipeline(g, targetFormat, resolve);
    }
    return _cache[key];
}
