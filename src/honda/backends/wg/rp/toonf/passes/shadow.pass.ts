import type { StructArrayBuffer } from "../../../buffer";
import type { ShadowMapTexture } from "../../../texture";
import type { IPass } from "../../common/passes/pass.interface";
import type { ToonContext } from "../context";
import type { MeshDraws2, UniformData } from "./gather.pass";
import { align } from "../../../utils";
import { DrawBinder, drawMesh } from "./draw-util";

export class ShadowPass implements IPass {
    private meshBindGroup: GPUBindGroup;
    private matrixAlign: number;

    public constructor(
        private ctx: ToonContext,

        private uniforms: UniformData,
        private meshDraws: MeshDraws2,
        meshInstanceBuffer: StructArrayBuffer,

        private shadowMaps: ShadowMapTexture,
        lightVPBuffer: GPUBuffer,
    ) {
        this.matrixAlign = align(4 * 4 * 4, ctx.device.limits.minUniformBufferOffsetAlignment);

        this.meshBindGroup = ctx.device.createBindGroup({
            label: "shadowMeshBG",
            layout: ctx.layouts["toonf/depth"],
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: lightVPBuffer,
                        offset: 0,
                        size: 4 * 4 * 4, // one 4x4 matrix per dynamic offset
                    },
                },
                {
                    binding: 1,
                    resource: { buffer: meshInstanceBuffer.gpuBuf },
                },
            ],
        });
    }

    apply(): void {
        const n = Math.min(this.uniforms.nShadowmaps, this.shadowMaps.nLights);

        for (let i = 0; i < n; i++) {
            const rp = this.ctx.wg.encoder.beginRenderPass({
                label: `shadowmap:${i}`,
                colorAttachments: [],
                depthStencilAttachment: {
                    view: this.shadowMaps.views[i],
                    depthClearValue: 0,
                    depthLoadOp: "clear",
                    depthStoreOp: "store",
                },
                timestampWrites: this.ctx.wg.timestamp(`shadowmaps`),
            });

            rp.setBindGroup(0, this.meshBindGroup, [i * this.matrixAlign]);

            const binder = new DrawBinder(rp);

            // gather only puts shadow casters in here
            for (const draw of this.meshDraws.shadows[i].opaque) {
                binder.bind(draw.slot.impl.depthPipeline(draw.alpha, true), draw.slot.bindGroup);
                drawMesh(rp, draw, false);
            }

            // TODO: skinned meshes
            rp.end();
        }

        if (this.uniforms.nShadowmaps > this.shadowMaps.nLights) {
            console.warn("Not all shadowmaps could be rendered");
        }
    }
}
