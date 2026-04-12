import { MeshIndexType } from "@/honda/gpu2";
import { StructBuffer, type StructArrayBuffer } from "../../buffer";
import type { WGpu } from "../../gpu";
import type { IMultiSamplable, ITViewable } from "../../texture";
import type { UniformData } from "../def1";
import type { IPass } from "../pass.interface";
import type { MeshDraws } from "./gather.pass";
import type { WGBuf, WGMat } from "../../resources";
import { getMainPipeline } from "../../pipelines/toonf/main.pipeline";
import type { Mat4 } from "wgpu-matrix";

type MainUniforms = {
    vp: Mat4;
    vInv: Mat4;
    nLights: number;
};

export class MainPass implements IPass {
    private mainAlphaClipPipeline: GPURenderPipeline;
    private mainAlphaBlendPipeline: GPURenderPipeline;
    private meshBindGroup: GPUBindGroup;
    private uniformBuf: StructBuffer<MainUniforms>;

    public constructor(
        private g: WGpu,
        private uniforms: UniformData,
        private meshDraws: MeshDraws,
        meshInstanceBuffer: StructArrayBuffer,
        lightBuffer: StructArrayBuffer,

        private color: ITViewable & IMultiSamplable,
        private depth: ITViewable & IMultiSamplable,
    ) {
        this.mainAlphaClipPipeline = getMainPipeline(
            g,
            "mainAlphaClip",
            color.format,
            depth.format,
            depth.multisample,
        );

        this.mainAlphaBlendPipeline = getMainPipeline(
            g,
            "mainAlphaBlend",
            color.format,
            depth.format,
            depth.multisample,
        );

        this.uniformBuf = new StructBuffer<MainUniforms>(
            g,
            g.getStruct("toonf/toon", "MainUniforms"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "mainUniformBuffer",
        );

        this.meshBindGroup = g.device.createBindGroup({
            label: "mainMeshBG",
            layout: g.bindGroupLayouts["toonf/main"],
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
            ],
        });
    }

    public apply(): void {
        // push new uniforms
        this.uniformBuf.set({
            vp: this.uniforms.vp,
            vInv: this.uniforms.vInv,
            nLights: this.uniforms.nLights,
        });
        this.uniformBuf.push();

        const rp = this.g.cmdEncoder.beginRenderPass({
            label: "mainPass",
            colorAttachments: [
                {
                    view: this.color.view,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
            depthStencilAttachment: {
                view: this.depth.view,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 0,
            },
            timestampWrites: this.g.timestamp("main"),
        });

        rp.pushDebugGroup("opaque");

        rp.setBindGroup(0, this.meshBindGroup);
        rp.setPipeline(this.mainAlphaClipPipeline);

        for (let i = 0; i < this.meshDraws.opaque.length; i++) {
            const draw = this.meshDraws.opaque[i];

            rp.setVertexBuffer(0, (draw.mesh.position as WGBuf).buffer);
            rp.setVertexBuffer(1, (draw.mesh.texCoord as WGBuf).buffer);
            rp.setVertexBuffer(2, (draw.mesh.normal as WGBuf).buffer);
            rp.setBindGroup(1, (draw.mat as WGMat).bindGroup);

            const iType = draw.mesh.indexType;
            if (iType !== MeshIndexType.None) {
                rp.setIndexBuffer(
                    (draw.mesh.index as WGBuf).buffer,
                    iType === MeshIndexType.U16 ? "uint16" : "uint32",
                );

                rp.drawIndexed(
                    draw.mesh.drawCount,
                    draw.nInstances,
                    0,
                    0,
                    draw.firstInstance,
                );
            } else {
                rp.draw(
                    draw.mesh.drawCount,
                    draw.nInstances,
                    0,
                    draw.firstInstance,
                );
            }
        }

        rp.popDebugGroup();
        rp.pushDebugGroup("blend");

        rp.setPipeline(this.mainAlphaBlendPipeline);

        for (let i = 0; i < this.meshDraws.blend.length; i++) {
            const draw = this.meshDraws.blend[i];

            rp.setVertexBuffer(0, (draw.mesh.position as WGBuf).buffer);
            rp.setVertexBuffer(1, (draw.mesh.texCoord as WGBuf).buffer);
            rp.setVertexBuffer(2, (draw.mesh.normal as WGBuf).buffer);
            rp.setBindGroup(1, (draw.mat as WGMat).bindGroup);

            const iType = draw.mesh.indexType;
            if (iType !== MeshIndexType.None) {
                rp.setIndexBuffer(
                    (draw.mesh.index as WGBuf).buffer,
                    iType === MeshIndexType.U16 ? "uint16" : "uint32",
                );

                rp.drawIndexed(
                    draw.mesh.drawCount,
                    draw.nInstances,
                    0,
                    0,
                    draw.firstInstance,
                );
            } else {
                rp.draw(
                    draw.mesh.drawCount,
                    draw.nInstances,
                    0,
                    draw.firstInstance,
                );
            }
        }

        rp.popDebugGroup();

        rp.end();
    }
}
