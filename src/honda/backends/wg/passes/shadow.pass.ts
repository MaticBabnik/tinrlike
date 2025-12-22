import type { IPass } from "./pass.interface";
import type { Buffer, StructArrayBuffer } from "../buffer";
import type { DrawCall, Instance, UniformData } from "./gatherData.pass";
import type { ShadowMapTexture } from "../textures";
import type { WGpu } from "../gpu";
import { getShadowPipeline } from "../pipelines";
import type { WGBuf } from "../resources/buf";
import { MeshIndexType } from "@/honda/gpu2";

const MATRIX_SIZE = 4 * 4 * 4;

export class ShadowMapPass implements IPass {
    private meshBindGroup: GPUBindGroup;
    private skinBindGroup: GPUBindGroup;

    private matrixAlign: number;
    private maxNShadowmaps: number;

    private shadowSkinPipeline: GPURenderPipeline;
    private shadowMeshPipeline: GPURenderPipeline;

    constructor(
        private g: WGpu,

        private uniformData: UniformData,

        private meshDrawCalls: DrawCall[],
        private meshInstanceBuffer: StructArrayBuffer,

        private skinMeshInstances: Instance[],
        private skinMeshInstanceBuffer: StructArrayBuffer,

        private lightVPBuffer: Buffer,

        private shadowmaps: ShadowMapTexture,
    ) {
        const minOffsetAlign =
            this.g.device.limits.minUniformBufferOffsetAlignment;
        // this *should* be good enough
        this.matrixAlign = Math.max(MATRIX_SIZE, minOffsetAlign);
        this.maxNShadowmaps = Math.min(
            shadowmaps.nLights,
            Math.floor(lightVPBuffer.size / this.matrixAlign),
        );

        this.shadowMeshPipeline = getShadowPipeline(
            g,
            "shadow",
            shadowmaps.format,
        );

        this.shadowSkinPipeline = getShadowPipeline(
            g,
            "shadowSkin",
            shadowmaps.format,
        );

        this.meshBindGroup = g.device.createBindGroup({
            label: "shadowmapMesh",
            layout: g.bindGroupLayouts.shadow,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.lightVPBuffer.gpuBuf },
                },
                {
                    binding: 1,
                    resource: { buffer: this.meshInstanceBuffer.gpuBuf },
                },
            ],
        });

        this.skinBindGroup = g.device.createBindGroup({
            label: "shadowmapSkin",
            layout: g.bindGroupLayouts.shadow,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.lightVPBuffer.gpuBuf },
                },
                {
                    binding: 1,
                    resource: { buffer: this.skinMeshInstanceBuffer.gpuBuf },
                },
            ],
        });
    }

    apply(): void {
        for (let i = 0; i < this.uniformData.nShadowmaps; i++) {
            const rp = this.g.cmdEncoder.beginRenderPass({
                label: `shadowmap:${i}`,
                colorAttachments: [],
                depthStencilAttachment: {
                    view: this.shadowmaps.views[i],
                    depthClearValue: 0,
                    depthLoadOp: "clear",
                    depthStoreOp: "store",
                },
                timestampWrites: this.g.timestamp(`shadowmaps`),
            });

            rp.setPipeline(this.shadowMeshPipeline);
            rp.setBindGroup(0, this.meshBindGroup, [i * this.matrixAlign]);

            for (const c of this.meshDrawCalls) {
                rp.setVertexBuffer(0, (c.mesh.position as WGBuf).buffer);
                rp.setVertexBuffer(1, (c.mesh.texCoord as WGBuf).buffer);

                //TODO(mbabnik): alpha clipping in shadows?
                // fries you know where
                const iType = c.mesh.indexType;
                if (iType !== MeshIndexType.None) {
                    rp.setIndexBuffer(
                        (c.mesh.index as WGBuf).buffer,
                        iType === MeshIndexType.U16 ? "uint16" : "uint32",
                    );

                    rp.drawIndexed(
                        c.mesh.drawCount,
                        c.nInstances,
                        0,
                        0,
                        c.firstInstance,
                    );
                } else {
                    rp.draw(c.mesh.drawCount, c.nInstances, 0, c.firstInstance);
                }
            }

            let j = 0;
            rp.setPipeline(this.shadowSkinPipeline);
            rp.setBindGroup(0, this.skinBindGroup, [i * this.matrixAlign]);
            for (const c of this.skinMeshInstances) {
                rp.setVertexBuffer(0, (c.mesh.position as WGBuf).buffer);
                rp.setVertexBuffer(1, (c.mesh.joints as WGBuf).buffer);
                rp.setVertexBuffer(2, (c.mesh.weights as WGBuf).buffer);
                rp.setIndexBuffer((c.mesh.index as WGBuf).buffer, "uint16");
                rp.drawIndexed(c.mesh.drawCount as number, 1, 0, 0, j++);

                const iType = c.mesh.indexType;
                if (iType !== MeshIndexType.None) {
                    rp.setIndexBuffer(
                        (c.mesh.index as WGBuf).buffer,
                        iType === MeshIndexType.U16 ? "uint16" : "uint32",
                    );

                    rp.drawIndexed(c.mesh.drawCount, 1, 0, 0, j++);
                } else {
                    rp.draw(c.mesh.drawCount, 1, 0, j++);
                }
            }
            rp.end();
        }
        if (this.uniformData.nShadowmaps > this.maxNShadowmaps) {
            console.warn("Not all shadowmaps could be rendered");
        }
    }
}
