import { Four } from "@/honda/gpu2";
import type { WGpu } from "../gpu";
import {
    TRI_LIST_CULLED,
    DEPTHTEST_GREATER_WRITE,
    VERTEX_POS_UV_NORM,
    VERTEX_POS_UV_NORM_TAN,
    VERTEX_POS_UV_NORM_SKIN,
} from "./constants";

function createG(g: WGpu, formats: Four<GPUTextureFormat>) {
    const module = g.getShaderModule("g");

    return g.device.createRenderPipeline({
        label: "gbuf",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [
                g.bindGroupLayouts.g,
                g.bindGroupLayouts.material,
            ],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
            buffers: VERTEX_POS_UV_NORM,
        },
        fragment: {
            module,
            targets: [
                { format: formats[0] },
                { format: formats[1] },
                { format: formats[2] },
                { format: formats[3] },
            ],
        },
        depthStencil: DEPTHTEST_GREATER_WRITE,
    });
}

function createGNorm(g: WGpu, formats: Four<GPUTextureFormat>) {
    const module = g.getShaderModule("gnorm");

    return g.device.createRenderPipeline({
        label: "gbuf(norm)",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [
                g.bindGroupLayouts.g,
                g.bindGroupLayouts.materialNormal,
            ],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
            buffers: VERTEX_POS_UV_NORM_TAN,
        },
        fragment: {
            module,
            targets: [
                { format: formats[0] },
                { format: formats[1] },
                { format: formats[2] },
                { format: formats[3] },
            ],
        },
        depthStencil: DEPTHTEST_GREATER_WRITE,
    });
}

function createGSkin(g: WGpu, formats: Four<GPUTextureFormat>) {
    const module = g.getShaderModule("gskin");

    return g.device.createRenderPipeline({
        label: "gbuf-skin",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [
                g.bindGroupLayouts.gskin,
                g.bindGroupLayouts.material,
            ],
        }),
        primitive: TRI_LIST_CULLED,
        vertex: {
            module,
            buffers: VERTEX_POS_UV_NORM_SKIN,
        },
        fragment: {
            module,
            targets: [
                { format: formats[0] },
                { format: formats[1] },
                { format: formats[2] },
                { format: formats[3] },
            ],
        },
        depthStencil: DEPTHTEST_GREATER_WRITE,
    });
}

const cache: Record<string, GPURenderPipeline> = {};

export function getGPipeline(
    g: WGpu,
    type: "g" | "gNorm" | "gSkin",
    formats: Four<GPUTextureFormat>,
): GPURenderPipeline {
    const key = `${type}-${formats.join("-")}`;
    if (cache[key]) return cache[key];

    let pipeline: GPURenderPipeline;
    if (type === "g") {
        pipeline = createG(g, formats);
    } else if (type === "gNorm") {
        pipeline = createGNorm(g, formats);
    } else {
        pipeline = createGSkin(g, formats);
    }

    cache[key] = pipeline;
    return pipeline;
}
