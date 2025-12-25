import type { Vec2 } from "wgpu-matrix";
import { StructBuffer } from "../buffer";
import type { WGpu } from "../gpu";
import { getEdge } from "../pipelines";
import type { ITViewable } from "../texture";
import type { UniformData } from "./gatherData.pass";
import type { IPass } from "./pass.interface";
import type { Two } from "@/honda/";

interface EdgeSettings {
    normalBoost: number;
    depthBoost: number;
}

interface SUniforms extends EdgeSettings {
    near: number;
    far: number;
    isOrtho: number;
    pixelSize: Vec2 | Two<number>;
}

export class EdgePass implements IPass {
    private pipeline: GPURenderPipeline;
    private bindGroup: GPUBindGroup | null = null;
    private uniforms: StructBuffer<SUniforms>;
    private sampler: GPUSampler;

    constructor(
        private gpu: WGpu,

        private settings: EdgeSettings,

        private uniformData: UniformData,
        private gNormal: ITViewable,
        private gDepth: ITViewable,

        private out: ITViewable,
    ) {
        this.pipeline = getEdge(gpu, out.format);
        this.sampler = gpu.device.createSampler({
            label: "edgeSampler",
            magFilter: "nearest",
            minFilter: "nearest",
        });
        this.uniforms = new StructBuffer(
            gpu,
            gpu.getStruct("edge", "Uniforms"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "edgeUniforms",
        );
    }

    protected createBindGroup() {
        this.bindGroup = this.gpu.device.createBindGroup({
            label: "edgebg",
            layout: this.gpu.bindGroupLayouts.edge,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniforms.gpuBuf },
                },
                {
                    binding: 1,
                    resource: this.gNormal.view,
                },
                {
                    binding: 2,
                    resource: this.gDepth.view,
                },
                {
                    binding: 3,
                    resource: this.sampler,
                },
            ],
        });
    }

    public apply() {
        if (!this.bindGroup || this.out.resized) {
            this.createBindGroup();
        }

        const pass = this.gpu.cmdEncoder.beginRenderPass({
            label: "edgePass",
            colorAttachments: [
                { loadOp: "clear", storeOp: "store", view: this.out.view },
            ],
            timestampWrites: this.gpu.timestamp("edge"),
        });

        this.uniforms.set({
            near: this.uniformData.near,
            far: this.uniformData.far,
            isOrtho: this.uniformData.isOrtho,
            pixelSize: [1 / this.out.width, 1 / this.out.height],

            ...this.settings,
        });
        this.uniforms.push();

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(3);

        pass.end();
    }
}
