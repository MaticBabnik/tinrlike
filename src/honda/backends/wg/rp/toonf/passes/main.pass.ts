import { Pass } from "@/honda/gpu2";
import { StructBuffer, type StructArrayBuffer } from "../../../buffer";
import type { IMultiSamplable, ITViewable, ShadowMapTexture } from "../../../texture";
import type { IPass } from "../../common/passes/pass.interface";
import type { ToonContext } from "../context";
import type { MeshDraws2, ToonDrawCall, UniformData } from "./gather.pass";
import type { Mat4 } from "wgpu-matrix";
import { DrawBinder, drawMesh } from "./draw-util";

type MainUniforms = {
    vp: Mat4;
    vInv: Mat4;
    nLights: number;
    nShadowmaps: number;
};

export class MainPass implements IPass {
    private meshBindGroup: GPUBindGroup;
    private uniformBuf: StructBuffer<MainUniforms>;

    public constructor(
        private ctx: ToonContext,
        private uniforms: UniformData,
        private meshDraws: MeshDraws2,
        meshInstanceBuffer: StructArrayBuffer,
        lightBuffer: StructArrayBuffer,

        private color: ITViewable & IMultiSamplable,
        private depth: ITViewable & IMultiSamplable,
        private shadowmaps: ShadowMapTexture,
    ) {
        this.uniformBuf = new StructBuffer<MainUniforms>(
            ctx.wg,
            ctx.struct("MainUniforms"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "mainUniformBuffer",
        );

        this.meshBindGroup = ctx.device.createBindGroup({
            label: "mainMeshBG",
            layout: ctx.layouts["toonf/main"],
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuf.gpuBuf },
                },
                {
                    binding: 1,
                    resource: { buffer: meshInstanceBuffer.gpuBuf },
                },
                {
                    binding: 2,
                    resource: { buffer: lightBuffer.gpuBuf },
                },
                {
                    binding: 3,
                    resource: this.shadowmaps.view,
                },
                {
                    binding: 4,
                    resource: ctx.device.createSampler({
                        label: "shadowmapSampler",
                        compare: "greater",
                        minFilter: "linear",
                        magFilter: "linear",
                    }),
                },
            ],
        });
    }

    private drawList(binder: DrawBinder, rp: GPURenderPassEncoder, list: ToonDrawCall[]) {
        for (const draw of list) {
            if (!(draw.passes & Pass.Main)) continue;

            binder.bind(draw.slot.impl.mainPipeline(draw.alpha), draw.slot.bindGroup);
            drawMesh(rp, draw, true);
        }
    }

    public apply(): void {
        // push new uniforms
        this.uniformBuf.set({
            vp: this.uniforms.vp,
            vInv: this.uniforms.vInv,
            nLights: this.uniforms.nLights,
            nShadowmaps: this.uniforms.nShadowmaps,
        });
        this.uniformBuf.push();

        const rp = this.ctx.wg.encoder.beginRenderPass({
            label: "mainPass",
            colorAttachments: [
                {
                    view: this.color.view,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 5, g: 5, b: 5, a: 1 },
                },
            ],
            depthStencilAttachment: {
                view: this.depth.view,
                depthLoadOp: "load",
                depthStoreOp: "store",
            },
            timestampWrites: this.ctx.wg.timestamp("main"),
        });

        rp.setBindGroup(0, this.meshBindGroup);

        const binder = new DrawBinder(rp);

        rp.pushDebugGroup("opaque");
        this.drawList(binder, rp, this.meshDraws.main.opaque);
        rp.popDebugGroup();

        rp.pushDebugGroup("blend");
        this.drawList(binder, rp, this.meshDraws.main.blend ?? []);
        rp.popDebugGroup();

        rp.end();
    }

    public destroy(): void {
        this.uniformBuf.destroy();
    }
}
