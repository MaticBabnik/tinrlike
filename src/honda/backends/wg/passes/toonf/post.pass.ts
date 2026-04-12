import type { WGpu } from "../../gpu";
import { getPostPipeline } from "../../pipelines/toonf/post.pipeline";
import type { IMultiSamplable, ITViewable } from "../../texture";
import type { IPass } from "../pass.interface";

export class PostPass implements IPass {
    private pipeline: GPURenderPipeline;
    private bindGroup?: GPUBindGroup;
    private resolve: boolean;

    public constructor(
        private g: WGpu,
        private color: ITViewable & Partial<IMultiSamplable>,
        private output: ITViewable,
    ) {
        this.resolve = color.multisample !== undefined && color.multisample > 1;
        this.pipeline = getPostPipeline(g, output.format, this.resolve);
    }

    private createBindGroup() {
        this.bindGroup = this.g.device.createBindGroup({
            label: "toonfPostBG",
            layout: this.g.bindGroupLayouts[
                this.resolve ? "toonf/postresolve" : "toonf/post"
            ],
            entries: [
                {
                    binding: 0,
                    resource: this.color.view,
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
