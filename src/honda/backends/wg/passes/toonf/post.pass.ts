import type { WGpu } from "../../gpu";
import { getPostPipeline } from "../../pipelines/toonf/post.pipeline";
import type { IMultiSamplable, ITViewable } from "../../texture";
import type { IPass } from "../pass.interface";

export class PostPass implements IPass {
    private pipeline: GPURenderPipeline;
    private bindGroup?: GPUBindGroup;
    private sampler: GPUSampler;

    public constructor(
        private g: WGpu,
        private postCfg: GPUBuffer,
        private color: ITViewable & Partial<IMultiSamplable>,
        private bloom: ITViewable,
        private output: ITViewable,
    ) {
        this.pipeline = getPostPipeline(g, output.format);
        this.sampler = g.device.createSampler({
            label: "toonfPostSampler",
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
        });
    }

    private createBindGroup() {
        this.bindGroup = this.g.device.createBindGroup({
            label: "toonfPostBG",
            layout: this.g.bindGroupLayouts["toonf/post"],
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.postCfg },
                },
                {
                    binding: 1,
                    resource: this.color.view,
                },
                {
                    binding: 2,
                    resource: this.bloom.view,
                },
                {
                    binding: 3,
                    resource: this.sampler,
                },
            ],
        });
    }

    public apply(): void {
        if (!this.bindGroup || this.color.resized) {
            this.createBindGroup();
        }

        const pass = this.g.cmdEncoder.beginRenderPass({
            label: "toonfPostPass",
            colorAttachments: [
                {
                    view: this.output.view,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
            timestampWrites: this.g.timestamp("post"),
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(3, 1, 0, 0);

        pass.end();
    }
}
