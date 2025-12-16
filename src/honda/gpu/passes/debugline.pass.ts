import { Game } from "../../state";
import { makeStructuredView } from "webgpu-utils";
import type { IPass } from "./pass.interface";
import { CameraSystem, DebugSystem } from "@/honda/systems";

export class DebugLinePass implements IPass {
    protected uniforms = makeStructuredView(
        Game.gpu.shaderModules.devline.defs.structs.Uniforms,
    );

    protected debugSystem: DebugSystem;
    protected cameraSystem: CameraSystem;

    protected uniformsGpu: GPUBuffer;
    protected vertexGpu: GPUBuffer;
    protected colorGpu: GPUBuffer;

    protected bindGroup: GPUBindGroup;

    constructor() {
        this.debugSystem = Game.ecs.getSystem(DebugSystem);
        this.cameraSystem = Game.ecs.getSystem(CameraSystem);

        this.uniformsGpu = Game.gpu.device.createBuffer({
            size: this.uniforms.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.vertexGpu = Game.gpu.device.createBuffer({
            size: this.debugSystem.$vertPositionBuffer.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.colorGpu = Game.gpu.device.createBuffer({
            size: this.debugSystem.$instColorBuffer.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = Game.gpu.device.createBindGroup({
            layout: Game.gpu.bindGroupLayouts.debugline,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformsGpu,
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
            viewProjection: this.cameraSystem.viewProjMtx,
        });

        Game.gpu.device.queue.writeBuffer(
            this.uniformsGpu,
            0,
            this.uniforms.arrayBuffer,
        );

        Game.gpu.device.queue.writeBuffer(
            this.vertexGpu,
            0,
            this.debugSystem.$vertPositionBuffer.buffer,
            0,
            n * 2 * 4 * 4,
        );

        Game.gpu.device.queue.writeBuffer(
            this.colorGpu,
            0,
            this.debugSystem.$instColorBuffer.buffer,
            0,
            n * 4 * 4,
        );

        const pass = Game.cmdEncoder.beginRenderPass({
            colorAttachments: [
                {
                    loadOp: "load",
                    storeOp: "store",
                    view: Game.gpu.canvasView,
                },
            ],
            timestampWrites: Game.gpu.timestamp("debug_line"),
        });

        pass.setPipeline(Game.gpu.pipelines.debugline);

        pass.setBindGroup(0, this.bindGroup);

        pass.draw(n * 2);

        pass.end();
    }
}
