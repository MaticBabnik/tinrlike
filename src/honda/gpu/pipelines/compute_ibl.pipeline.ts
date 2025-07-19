import { WebGpu } from "..";

export function createIblIrradiance(g: WebGpu) {
    const { module } = g.shaderModules.compute_ibl;

    return g.device.createComputePipeline({
        label: "ibl_irradiance",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [g.bindGroupLayouts.computeIbl],
        }),
        compute: { module, entryPoint: 'irradiance' },
    });
}

export function createIblSpecular(g: WebGpu) {
    const { module } = g.shaderModules.compute_ibl;

    return g.device.createComputePipeline({
        label: "c_ibl_specular",
        layout: g.device.createPipelineLayout({
            bindGroupLayouts: [
                g.bindGroupLayouts.computeIbl,
            ],
        }),
        compute: { module, entryPoint: 'specular' },
    });
}
