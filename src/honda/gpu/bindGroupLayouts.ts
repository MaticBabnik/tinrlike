import type { WebGpu } from ".";
import {
    bindGroupLayout,
    createBindGroupLayoutsFromArray,
} from "../util/bindGroupBuilder";

const materialBase = bindGroupLayout("materialBase")
    .binding(0, "f", "buffer", { type: "uniform" }) // data
    .binding(1, "f", "texture") // albedo texture
    .binding(2, "f", "sampler") // albedo sampler
    .binding(3, "f", "texture") // metallic/roughness texture
    .binding(4, "f", "sampler") // metallic/roughness sampler
    .binding(5, "f", "texture") // emission texture
    .binding(6, "f", "sampler"); //emission sampler

const layouts = [
    bindGroupLayout("g")
        .binding(0, "v", "buffer", { type: "uniform" })
        .binding(1, "v", "buffer", { type: "read-only-storage" }),

    bindGroupLayout("gskin")
        .binding(0, "v", "buffer", { type: "uniform" })
        .binding(1, "v", "buffer", { type: "read-only-storage" }),

    bindGroupLayout("post")
        .binding(0, "f", "buffer", { type: "uniform" })
        .binding(1, "f", "texture")
        .binding(2, "f", "texture", { sampleType: "depth" })
        .binding(3, "f", "texture")
        .binding(4, "f", "texture"),

    bindGroupLayout("ssao")
        .binding(0, "f", "buffer", { type: "uniform" })
        .binding(1, "f", "texture", { sampleType: "unfilterable-float" })
        .binding(2, "f", "texture")
        .binding(3, "f", "texture", { sampleType: "depth" })
        .binding(4, "f", "sampler"),

    bindGroupLayout("shadeMain")
        .binding(0, "f", "buffer", { type: "uniform" })
        .binding(1, "f", "buffer", { type: "uniform" })
        .binding(2, "f", "texture")
        .binding(3, "f", "texture")
        .binding(4, "f", "texture")
        .binding(5, "f", "texture")
        .binding(6, "f", "texture", { sampleType: "depth" })
        .binding(7, "f", "texture", {
            sampleType: "depth",
            viewDimension: "2d-array",
        })
        .binding(8, "f", "sampler", { type: "comparison" }),

    bindGroupLayout("shadeIbl")
        .binding(0, "f", "buffer", { type: "uniform" })
        .binding(1, "f", "sampler")
        .binding(2, "f", "texture", { viewDimension: "cube" })
        .binding(3, "f", "texture", { viewDimension: "cube" }),

    bindGroupLayout("material", materialBase),

    bindGroupLayout("materialNormal", materialBase)
        .binding(7, "f", "texture")
        .binding(8, "f", "sampler"),

    bindGroupLayout("shadow")
        .binding(0, "v", "buffer", {
            type: "uniform",
            hasDynamicOffset: true,
            minBindingSize: 64,
        })
        .binding(1, "v", "buffer", { type: "read-only-storage" }),

    bindGroupLayout("bloom")
        .binding(0, "f", "buffer", { type: "uniform" })
        .binding(1, "f", "texture"),

    bindGroupLayout("blur")
        .binding(0, "f", "buffer", {
            type: "uniform",
            hasDynamicOffset: true,
            minBindingSize: 1280,
        })
        .binding(1, "f", "texture")
        .binding(2, "f", "sampler"),

    bindGroupLayout("rgbmload")
        .binding(0, "f", "buffer", { type: "uniform" })
        .binding(1, "f", "texture"),

    bindGroupLayout("computeIbl")
        .binding(0, "c", "texture", { viewDimension: "cube" })
        .binding(1, "c", "storageTexture", {
            format: "rgba16float",
            viewDimension: "2d-array",
        })
        .binding(2, "c", "sampler"),

    bindGroupLayout("flipx").binding(0, "f", "texture"),

    bindGroupLayout("devsprite")
        .binding(0, "v", "buffer", { type: "uniform" })
        .binding(1, "v", "buffer", { type: "read-only-storage" })
        .binding(2, "f", "texture")
        .binding(3, "f", "sampler"),

    bindGroupLayout("debugline")
        .binding(0, "v", "buffer", { type: "uniform" })
        .binding(1, "v", "buffer", { type: "read-only-storage" })
        .binding(2, "v", "buffer", { type: "read-only-storage" }),
] as const;

export function createBindGroupLayouts(g: WebGpu) {
    return createBindGroupLayoutsFromArray(g.device, layouts);
}
