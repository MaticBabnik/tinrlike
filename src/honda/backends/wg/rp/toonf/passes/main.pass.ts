import { MeshIndexType } from "@/honda/gpu2";
import { StructBuffer, type StructArrayBuffer } from "../../../buffer";
import type { WGpu } from "../../../gpu";
import type {
    IMultiSamplable,
    ITViewable,
    ShadowMapTexture,
} from "../../../texture";
import type { UniformData } from "../def1";
import type { IPass } from "../../common/passes/pass.interface";
import type { MeshDraws2 } from "./gather.pass";
import type { WGBuf, WGMat } from "../../../resources";
import { getMainPipeline } from "../pipelines/main.pipeline";
import type { Mat4 } from "wgpu-matrix";

type MainUniforms = {
    vp: Mat4;
    vInv: Mat4;
    nLights: number;
    nShadowmaps: number;
};

export class MainPass implements IPass {
    private mainAlphaClipPipeline: GPURenderPipeline;
    private mainAlphaBlendPipeline: GPURenderPipeline;
    private meshBindGroup: GPUBindGroup;
    private uniformBuf: StructBuffer<MainUniforms>;

    public constructor(
        private g: WGpu,
        private uniforms: UniformData,
        private meshDraws: MeshDraws2,
        meshInstanceBuffer: StructArrayBuffer,
        lightBuffer: StructArrayBuffer,

        private color: ITViewable & IMultiSamplable,
        private depth: ITViewable & IMultiSamplable,
        private shadowmaps: ShadowMapTexture,
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
                {
                    binding: 3,
                    resource: this.shadowmaps.view,
                },
                {
                    binding: 4,
                    resource: this.g.device.createSampler({
                        label: "shadowmapSampler",
                        compare: "greater",
                        minFilter: "linear",
                        magFilter: "linear",
                    }),
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
            nShadowmaps: this.uniforms.nShadowmaps,
        });
        this.uniformBuf.push();

        const rp = this.g.cmdEncoder.beginRenderPass({
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
            timestampWrites: this.g.timestamp("main"),
        });

        rp.pushDebugGroup("opaque");

        rp.setBindGroup(0, this.meshBindGroup);
        rp.setPipeline(this.mainAlphaClipPipeline);

        for (let i = 0; i < this.meshDraws.main.opaque.length; i++) {
            const draw = this.meshDraws.main.opaque[i];
            if (!draw.mat.renderMain) continue;

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

        for (let i = 0; i < this.meshDraws.main.blend!.length; i++) {
            const draw = this.meshDraws.main.blend![i];

            if (!draw.mat.renderMain) continue;

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
