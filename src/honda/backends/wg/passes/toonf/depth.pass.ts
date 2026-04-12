import { GPUMatAlpha, MeshIndexType } from "@/honda/gpu2";
import type { StructArrayBuffer } from "../../buffer";
import type { WGpu } from "../../gpu";
import { getDepthPipeline } from "../../pipelines/toonf/depth.pipeline";
import type { IMultiSamplable, ITViewable } from "../../texture";
import type { UniformData } from "../def1";
import type { IPass } from "../pass.interface";
import type { MeshDraws } from "./gather.pass";
import type { WGBuf, WGMat } from "../../resources";

export class DepthPass implements IPass {
    private depthOpaquePipeline: GPURenderPipeline;
    private depthAlphaClipPipeline: GPURenderPipeline;
    private meshBindGroup: GPUBindGroup;
    private vpBuffer: GPUBuffer;

    public constructor(
        private g: WGpu,
        private uniforms: UniformData,
        private meshDraws: MeshDraws,
        private meshInstanceBuffer: StructArrayBuffer,

        private depth: ITViewable & IMultiSamplable,
    ) {
        this.depthOpaquePipeline = getDepthPipeline(
            g,
            "depthOpaque",
            depth.format,
            depth.multisample,
        );

        this.depthAlphaClipPipeline = getDepthPipeline(
            g,
            "depthAlphaClip",
            depth.format,
            depth.multisample,
        );

        this.vpBuffer = g.device.createBuffer({
            label: "depthViewProjection",
            size: 4 * 4 * 4, // 4x4 matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.meshBindGroup = g.device.createBindGroup({
            label: "depthMeshBG",
            layout: g.bindGroupLayouts["toonf/depth"],
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
        this.g.device.queue.writeBuffer(
            this.vpBuffer,
            0,
            this.uniforms.vp.buffer,
            0,
            64,
        );

        const rp = this.g.cmdEncoder.beginRenderPass({
            label: "depthPrepass",
            colorAttachments: [],
            depthStencilAttachment: {
                view: this.depth.view,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 0,
            },
            timestampWrites: this.g.timestamp("depthPrepass"),
        });

        rp.setBindGroup(0, this.meshBindGroup);
        rp.setPipeline(this.depthOpaquePipeline);

        let i: number;

        for (i = 0; i < this.meshDraws.opaque.length; i++) {
            const draw = this.meshDraws.opaque[i];

            if (draw.mat.alphaMode !== GPUMatAlpha.OPAQUE) {
                break;
            }

            rp.setVertexBuffer(0, (draw.mesh.position as WGBuf).buffer);
            rp.setVertexBuffer(1, (draw.mesh.texCoord as WGBuf).buffer);

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

        for (; i < this.meshDraws.opaque.length; i++) {
            const draw = this.meshDraws.opaque[i];

            rp.setVertexBuffer(0, (draw.mesh.position as WGBuf).buffer);
            rp.setVertexBuffer(1, (draw.mesh.texCoord as WGBuf).buffer);
            rp.setBindGroup(1, (draw.mat as WGMat).alphaClipGroup);

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

        rp.end();
    }
}
