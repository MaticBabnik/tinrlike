import { MeshIndexType } from "@/honda/gpu2";
import type { StructArrayBuffer } from "../../../buffer";
import type { WGpu } from "../../../gpu";
import { getDepthPipeline } from "../pipelines/depth.pipeline";
import type { ShadowMapTexture } from "../../../texture";
import type { UniformData } from "../def1";
import type { IPass } from "../../common/passes/pass.interface";
import type { MeshDraws2 } from "./gather.pass";
import type { WGBuf, WGMat } from "../../../resources";
import { align } from "../../../utils";

// const MATRIX_ARRAY = { matrix: { offset: 0, type: { size: 64 } } };

export class ShadowPass implements IPass {
    private depthAlphaClipPipeline: GPURenderPipeline;
    private meshBindGroup: GPUBindGroup;
    private matrixAlign: number;

    public constructor(
        private g: WGpu,

        private uniforms: UniformData,
        private meshDraws: MeshDraws2,
        private meshInstanceBuffer: StructArrayBuffer,

        private shadowMaps: ShadowMapTexture,
        private lightVPBuffer: GPUBuffer,
    ) {
        this.matrixAlign = align(
            4 * 4 * 4,
            this.g.device.limits.minUniformBufferOffsetAlignment,
        );

        this.depthAlphaClipPipeline = getDepthPipeline(
            g,
            "depthAlphaClip",
            shadowMaps.format,
            1,
            true,
        );

        this.meshBindGroup = g.device.createBindGroup({
            label: "depthMeshBG",
            layout: g.bindGroupLayouts["toonf/depth"],
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.lightVPBuffer,
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
        //FIXME: ???
        void this.meshInstanceBuffer;

        for (let i = 0; i < this.uniforms.nShadowmaps; i++) {
            const rp = this.g.cmdEncoder.beginRenderPass({
                label: `shadowmap:${i}`,
                colorAttachments: [],
                depthStencilAttachment: {
                    view: this.shadowMaps.views[i],
                    depthClearValue: 0,
                    depthLoadOp: "clear",
                    depthStoreOp: "store",
                },
                timestampWrites: this.g.timestamp(`shadowmaps`),
            });

            rp.setPipeline(this.depthAlphaClipPipeline);
            rp.setBindGroup(0, this.meshBindGroup, [i * this.matrixAlign]);

            for (const c of this.meshDraws.shadows[i].opaque) {
                if (!c.shadow || !c.mat.renderShadow) continue;
                rp.setVertexBuffer(0, (c.mesh.position as WGBuf).buffer);
                rp.setVertexBuffer(1, (c.mesh.texCoord as WGBuf).buffer);

                rp.setBindGroup(1, (c.mat as unknown as WGMat).alphaClipGroup);

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

            // TODO: skinned meshes
            rp.end();
        }
        if (this.uniforms.nShadowmaps > this.shadowMaps.nLights) {
            console.warn("Not all shadowmaps could be rendered");
        }
    }
}
