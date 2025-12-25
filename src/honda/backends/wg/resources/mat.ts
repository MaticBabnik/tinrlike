import { MaterialBase } from "@/honda/gpu2/base/materialBase";
import {
    GPUMatAlpha,
    type IGPUMat,
    type IGPUMatDesc,
} from "@/honda/gpu2/interface";

import { StructBuffer } from "../buffer";
import type { WGpu } from "../gpu";
import type { WGTex } from "./tex";
import type { WGTexData } from "./texData";
import type { Four, Three } from "@/honda";

export class WGMat extends MaterialBase implements IGPUMat {
    private static _materialIdCounter = 0;
    public readonly id: number;

    public uniforms: StructBuffer<{
        baseFactor: Four<number>;
        emissionFactor: Three<number>;
        metalFactor: number;
        roughFactor: number;
        normalScale: number;
        alphaCutoff: number;
        ignoreAlpha: number;
    }>;
    public bindGroup: GPUBindGroup;

    public hasNormal: boolean = false;

    constructor(
        protected gpu: WGpu,
        d: IGPUMatDesc,
    ) {
        super(d);

        if (this.normalTexture) {
            this.hasNormal = true;
        }

        this.id = (this.hasNormal ? 1 << 30 : 0) | WGMat._materialIdCounter++;

        this.uniforms = new StructBuffer(
            gpu,
            gpu.getStruct("g", "Material"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            d.label,
        );

        const base = (this.baseTexture ?? gpu.getDefaultTexture()) as WGTex;
        const metRhg = (this.metRhgTexture ?? gpu.getDefaultTexture()) as WGTex;
        const emission = (this.emissionTexture ??
            gpu.getDefaultTexture()) as WGTex;

        this.bindGroup = gpu.device.createBindGroup({
            label: this.label,
            layout: this.hasNormal
                ? gpu.bindGroupLayouts.materialNormal
                : gpu.bindGroupLayouts.material,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniforms.gpuBuf },
                },
                {
                    binding: 1,
                    resource: (base.data as WGTexData).views[
                        "rgba8unorm-srgb"
                    ]!,
                },
                {
                    binding: 2,
                    resource: base.sampler,
                },
                {
                    binding: 3,
                    resource: (metRhg.data as WGTexData).views.rgba8unorm!,
                },
                {
                    binding: 4,
                    resource: metRhg.sampler,
                },
                {
                    binding: 5,
                    resource: (emission.data as WGTexData).views.rgba8unorm!,
                },
                {
                    binding: 6,
                    resource: emission.sampler,
                },
            ],
        });

        this.push();
    }

    public push(): void {
        this.uniforms.set({
            baseFactor: this.colorFactor,
            emissionFactor: this.emissionFactor,
            metalFactor: this.metallicFactor,
            roughFactor: this.roughnessFactor,
            normalScale: this.normalScale,
            alphaCutoff: this.alphaCutoff,
            ignoreAlpha: this.alphaMode === GPUMatAlpha.OPAQUE ? 1 : 0,
        });

        this.uniforms.push();
    }

    protected _rcDestroy(): void {
        // release resources
        super._rcDestroy();

        // destroy own stuff
    }
}
