import type { WGpu } from "./gpu";
import {
    bindGroupLayout,
    createBindGroupLayoutsFromArray,
} from "./bindGroupBuilder";

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
        })
        .binding(1, "f", "texture")
        .binding(2, "f", "sampler"),

    bindGroupLayout("flipx").binding(0, "f", "texture"),

    bindGroupLayout("debugline")
        .binding(0, "v", "buffer", { type: "uniform" })
        .binding(1, "v", "buffer", { type: "read-only-storage" })
        .binding(2, "v", "buffer", { type: "read-only-storage" }),

    bindGroupLayout("edge")
        .binding(0, "f", "buffer", { type: "uniform" })
        .binding(1, "f", "texture")
        .binding(2, "f", "texture", { sampleType: "unfilterable-float" })
        .binding(3, "f", "sampler", { type: "non-filtering" }),
] as const;

export function createBindGroupLayouts(g: WGpu) {
    return createBindGroupLayoutsFromArray(g.device, layouts);
}
