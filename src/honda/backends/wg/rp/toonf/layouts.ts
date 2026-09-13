import { bindGroupLayout, createBindGroupLayoutsFromArray } from "../../bindGroupBuilder";

const layouts = [
    bindGroupLayout("toonf/depth")
        .binding(0, "v", "buffer", {
            type: "uniform",
            hasDynamicOffset: true,
            minBindingSize: 64,
        })
        .binding(1, "v", "buffer", { type: "read-only-storage" }),

    bindGroupLayout("toonf/main")
        .binding(0, "vf", "buffer", { type: "uniform" })
        .binding(1, "v", "buffer", { type: "read-only-storage" })
        .binding(2, "f", "buffer", { type: "uniform" })
        .binding(3, "f", "texture", {
            sampleType: "depth",
            viewDimension: "2d-array",
        })
        .binding(4, "f", "sampler", { type: "comparison" }),

    bindGroupLayout("toonf/blur")
        .binding(0, "f", "buffer", {
            type: "uniform",
            hasDynamicOffset: true,
        })
        .binding(1, "f", "texture")
        .binding(2, "f", "sampler"),

    bindGroupLayout("toonf/bloom").binding(0, "f", "buffer", { type: "uniform" }).binding(1, "f", "texture"),

    bindGroupLayout("toonf/post")
        .binding(0, "f", "buffer", { type: "uniform" })
        .binding(1, "f", "texture")
        .binding(2, "f", "texture")
        .binding(3, "f", "sampler"),

    bindGroupLayout("toonf/glitch")
        .binding(0, "vf", "buffer", { type: "uniform" })
        .binding(1, "v", "buffer", { type: "read-only-storage" })
        .binding(2, "f", "sampler")
        .binding(3, "f", "texture"),
] as const;

export type ToonLayouts = ReturnType<typeof createToonLayouts>;

export function createToonLayouts(device: GPUDevice) {
    return createBindGroupLayoutsFromArray(device, layouts);
}
