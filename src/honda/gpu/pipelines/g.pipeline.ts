import type { WebGpu } from "..";
import {
    TRI_LIST_CULLED,
    DEPTHTEST_GREATER_WRITE,
    VERTEX_POS_UV_NORM,
    VERTEX_POS_UV_NORM_TAN,
    VERTEX_POS_UV_NORM_SKIN,
} from "./constants";

export function createG(g: WebGpu) {
    const { module } = g.shaderModules.g;

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
                { format: "rgba8unorm-srgb" },
                { format: "rgba8unorm" },
                { format: "rg8unorm" },
                { format: "rgba8unorm" },
            ],
        },
        depthStencil: DEPTHTEST_GREATER_WRITE,
    });
}

export function createGNorm(g: WebGpu) {
    const { module } = g.shaderModules.gnorm;

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
                { format: "rgba8unorm-srgb" },
                { format: "rgba8unorm" },
                { format: "rg8unorm" },
                { format: "rgba8unorm" },
            ],
        },
        depthStencil: DEPTHTEST_GREATER_WRITE,
    });
}

export function createGSkin(g: WebGpu) {
    const { module } = g.shaderModules.gskin;

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
                { format: "rgba8unorm-srgb" },
                { format: "rgba8unorm" },
                { format: "rg8unorm" },
                { format: "rgba8unorm" },
            ],
        },
        depthStencil: DEPTHTEST_GREATER_WRITE,
    });
}
