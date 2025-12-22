import type { IPass } from "./pass.interface";
import type { WGpu } from "../gpu";
import type { UniformData } from "./gatherData.pass";
import type { ITViewable, ShadowMapTexture } from "../textures";
import { getShadePipeline } from "../pipelines";
import { type StructArrayBuffer, StructBuffer } from "../buffer";

export class ShadePass implements IPass {
    private shadePipeline: GPURenderPipeline;
    private uniforms: StructBuffer;
    private bindGroup: GPUBindGroup | null = null;
    private shadowSampler: GPUSampler;

    constructor(
        private g: WGpu,

        private uniformData: UniformData,
        private lightInstanceBuffer: StructArrayBuffer,

        private gBase: ITViewable,
        private gNormal: ITViewable,
        private gMtlRgh: ITViewable,
        private gEmission: ITViewable,
        private gDepth: ITViewable,

        private shadowmaps: ShadowMapTexture,

        private shaded: ITViewable,
    ) {
        this.shadePipeline = getShadePipeline(g, shaded.format);
        this.shadowSampler = g.device.createSampler({
            label: "shadowSampler",
            compare: "greater",
            minFilter: "linear",
            magFilter: "linear",
        });

        this.uniforms = new StructBuffer(
            this.g,
            this.g.getStruct("shade", "ShadeUniforms"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "shadeUniforms",
        );
    }

    protected createBindGroup() {
        this.bindGroup = this.g.device.createBindGroup({
            label: "shadebg",
            layout: this.g.bindGroupLayouts.shadeMain,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniforms.gpuBuf },
                },
                {
                    binding: 1,
                    resource: { buffer: this.lightInstanceBuffer.gpuBuf },
                },
                {
                    binding: 2,
                    resource: this.gBase.view,
                },
                {
                    binding: 3,
                    resource: this.gNormal.view,
                },
                {
                    binding: 4,
                    resource: this.gMtlRgh.view,
                },
                {
                    binding: 5,
                    resource: this.gEmission.view,
                },
                {
                    binding: 6,
                    resource: this.gDepth.view,
                },
                {
                    binding: 7,
                    resource: this.shadowmaps.view,
                },
                {
                    binding: 8,
                    resource: this.shadowSampler,
                },
            ],
        });
    }

    apply() {
        if (!this.bindGroup || this.gBase.resized) {
            this.createBindGroup();
        }

        this.uniforms.set({
            VInv: this.uniformData.vInv,
            VPInv: this.uniformData.vpInv,
            camera: this.uniformData.v,
            shadowMapSize: this.shadowmaps.size,
            nLights: this.uniformData.nLights,
        });

        const pass = this.g.cmdEncoder.beginRenderPass({
            label: "shade",
            colorAttachments: [
                {
                    view: this.shaded.view,
                    clearValue: [0, 0, 0, 1],
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
            timestampWrites: this.g.timestamp("shade"),
        });
        this.uniforms.push();
        pass.setPipeline(this.shadePipeline);
        pass.setBindGroup(0, this.bindGroup!);
        pass.draw(3);
        pass.end();
    }
}
