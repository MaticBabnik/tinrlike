import type { DebugSystem } from "@/honda/systems";
import { StructBuffer } from "../buffer";
import type { WGpu } from "../gpu";
import type { ITViewable } from "../texture";
import type { UniformData } from "./gatherData.pass";
import type { IPass } from "./pass.interface";
import { getDebuglinePipeline } from "../pipelines";

export class DebugLinePass implements IPass {
    private uniforms: StructBuffer;
    private vertexGpu: GPUBuffer;
    private colorGpu: GPUBuffer;
    private bindGroup: GPUBindGroup;
    private pipeline: GPURenderPipeline;

    constructor(
        private gpu: WGpu,
        private debugSystem: DebugSystem,
        private uniformData: UniformData,
        private out: ITViewable,
    ) {
        this.pipeline = getDebuglinePipeline(gpu, out.format);

        this.uniforms = new StructBuffer(
            gpu,
            gpu.getStruct("devline", "Uniforms"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "debugLineUniforms",
        );

        this.vertexGpu = gpu.device.createBuffer({
            size: this.debugSystem.$vertPositionBuffer.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: "debugLineVertexBuffer",
        });

        this.colorGpu = gpu.device.createBuffer({
            size: this.debugSystem.$instColorBuffer.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: "debugLineColorBuffer",
        });

        this.bindGroup = gpu.device.createBindGroup({
            layout: gpu.bindGroupLayouts.debugline,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniforms.gpuBuf,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.vertexGpu,
                    },
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.colorGpu,
                    },
                },
            ],
        });
    }

    apply() {
        const n = this.debugSystem.$lineCount;
        if (n === 0) return;

        this.uniforms.set({
            viewProjection: this.uniformData.vp,
        });
        this.uniforms.push();

        this.gpu.device.queue.writeBuffer(
            this.vertexGpu,
            0,
            this.debugSystem.$vertPositionBuffer.buffer,
            0,
            n * 2 * 4 * 4,
        );
        this.gpu.device.queue.writeBuffer(
            this.colorGpu,
            0,
            this.debugSystem.$instColorBuffer.buffer,
            0,
            n * 4 * 4,
        );

        const pass = this.gpu.cmdEncoder.beginRenderPass({
            colorAttachments: [
                {
                    loadOp: "load",
                    storeOp: "store",
                    view: this.out.view,
                },
            ],
            timestampWrites: this.gpu.timestamp("debug"),
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(n * 2);
        pass.end();
    }
}
