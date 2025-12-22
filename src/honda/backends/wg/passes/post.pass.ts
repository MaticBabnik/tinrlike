import { Mat4, Vec3 } from "wgpu-matrix";
import { StructBuffer } from "../buffer";
import { WGpu } from "../gpu";
import type { IPass } from "./pass.interface";
import { CameraSystem } from "@/honda/systems/camera";
import { nn } from "@/honda/util";
import { Three } from "@/honda/gpu2";
import { ITViewable } from "../textures";
import { UniformData } from "./gatherData.pass";
import { getPostProcess } from "../pipelines";

export interface PostSettings {
    fogColor: Vec3 | Three<number>;
    fogStart: number;
    fogEnd: number;
    fogDensity: number;

    gamma: number;
    exposure: number;
}

interface PostCfg extends PostSettings {
    inverseProjection: Mat4;
    camera: Mat4;
}

export class PostprocessPass implements IPass {
    protected settings: StructBuffer;
    protected bindGroup: GPUBindGroup | null = null;
    protected pipeline: GPURenderPipeline;

    constructor(
        private gpu: WGpu,

        private postSettings: PostSettings,
        
        private uniforms: UniformData,
        
        private shaded: ITViewable,
        private depth: ITViewable,

        private out: ITViewable
    ) {
        this.settings = new StructBuffer(
            gpu,
            gpu.getStruct("postprocess", "PostCfg"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "postSettings",
        );

        this.pipeline = getPostProcess(gpu, out.format);
    }

    protected createBindGroup() {
        this.bindGroup = this.gpu.device.createBindGroup({
            label: "postbg",
            layout: this.gpu.bindGroupLayouts.post,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.settings.gpuBuf,
                    },
                },
                {
                    binding: 1,
                    resource: this.shaded.view,
                },
                {
                    binding: 2,
                    resource: this.depth.view,
                },
            ],
        });
    }

    apply() {
        if (!this.bindGroup || this.shaded.resized) {
            this.createBindGroup();
        }

        this.settings.set({
            inverseProjection: this.uniforms.pInv,
            camera: this.uniforms.v,

            ... this.postSettings
        });

        const post = this.gpu.cmdEncoder.beginRenderPass({
            label: "post",
            colorAttachments: [
                {
                    view: this.out.view,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: [1, 0, 1, 1],
                },
            ],
            timestampWrites: this.gpu.timestamp("post"),
        });

        post.setPipeline(this.pipeline);
        this.settings.push();
        post.setBindGroup(0, this.bindGroup);
        post.draw(3);
        post.end();
    }
}
