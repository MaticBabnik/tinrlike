import { Pass } from "@/honda/gpu2";
import type { StructArrayBuffer } from "../../../buffer";
import type { IMultiSamplable, ITViewable } from "../../../texture";
import type { IPass } from "../../common/passes/pass.interface";
import type { ToonContext } from "../context";
import type { MeshDraws2, UniformData } from "./gather.pass";
import { DrawBinder, drawMesh } from "./draw";

export class DepthPass implements IPass {
    private meshBindGroup: GPUBindGroup;
    private vpBuffer: GPUBuffer;

    public constructor(
        private ctx: ToonContext,
        private uniforms: UniformData,
        private meshDraws: MeshDraws2,
        meshInstanceBuffer: StructArrayBuffer,

        private depth: ITViewable & IMultiSamplable,
    ) {
        this.vpBuffer = ctx.device.createBuffer({
            label: "depthViewProjection",
            size: 4 * 4 * 4, // 4x4 matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.meshBindGroup = ctx.device.createBindGroup({
            label: "depthMeshBG",
            layout: ctx.layouts["toonf/depth"],
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.vpBuffer },
                },
                {
                    binding: 1,
                    resource: { buffer: meshInstanceBuffer.gpuBuf },
                },
            ],
        });
    }

    public apply(): void {
        // push new VP
        this.ctx.device.queue.writeBuffer(this.vpBuffer, 0, this.uniforms.vp.buffer, 0, 64);

        const rp = this.ctx.wg.encoder.beginRenderPass({
            label: "depthPrepass",
            colorAttachments: [],
            depthStencilAttachment: {
                view: this.depth.view,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 0,
            },
            timestampWrites: this.ctx.wg.timestamp("depthPrepass"),
        });

        rp.setBindGroup(0, this.meshBindGroup, [0]); // dynamic offset is 0 in depth pass

        const binder = new DrawBinder(rp);

        for (const draw of this.meshDraws.main.opaque) {
            if (!(draw.passes & Pass.Depth)) continue;

            binder.bind(draw.slot.impl.depthPipeline(draw.alpha, false), draw.slot.bindGroup);
            drawMesh(rp, draw, false);
        }

        rp.end();
    }

    public destroy(): void {
        this.vpBuffer.destroy();
    }
}
