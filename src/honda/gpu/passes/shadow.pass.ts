import { Game } from "@/honda/state";
import type { IPass } from "./pass.interface";
import { LightSystem } from "@/honda/systems/light";
import { MeshSystem } from "@/honda/systems/mesh";
import type { StructArrayBuffer } from "../buffer";

export class ShadowMapPass implements IPass {
    private mtxBindGroup: GPUBindGroup;
    private skinBindGroup: GPUBindGroup;

    constructor(skinMeshBuffer: StructArrayBuffer) {
        const mBuf = Game.ecs.getSystem(LightSystem).shadowmapMatrices;
        const iBuf = Game.ecs.getSystem(MeshSystem).instanceBuffer;

        this.mtxBindGroup = Game.gpu.device.createBindGroup({
            label: "shadowmapBG",
            layout: Game.gpu.bindGroupLayouts.shadow,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: mBuf,
                        size: 64,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: iBuf,
                    },
                },
            ],
        });

        this.skinBindGroup = Game.gpu.device.createBindGroup({
            label: "shadowmapSkinBG",
            layout: Game.gpu.bindGroupLayouts.shadow,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: mBuf,
                        size: 64,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: skinMeshBuffer.gpuBuf,
                    },
                },
            ],
        });
    }

    apply(): void {
        const lsys = Game.ecs.getSystem(LightSystem);
        const msys = Game.ecs.getSystem(MeshSystem);

        for (let i = 0; i < lsys.nShadowmaps; i++) {
            const rp = Game.cmdEncoder.beginRenderPass({
                label: `shadowmap:${i}`,
                colorAttachments: [],
                depthStencilAttachment: {
                    view: Game.gpu.shadowmaps.views[i],
                    depthClearValue: 0,
                    depthLoadOp: "clear",
                    depthStoreOp: "store",
                },
                timestampWrites: Game.gpu.timestamp(`shadowmaps`),
            });

            rp.setPipeline(Game.gpu.pipelines.shadow);
            rp.setBindGroup(0, this.mtxBindGroup, [i * lsys.matrixAlignedSize]);

            for (const c of msys.calls) {
                rp.setVertexBuffer(0, c.mesh.position);
                rp.setVertexBuffer(1, c.mesh.texCoord);
                rp.setIndexBuffer(c.mesh.index, "uint16");

                //TODO(mbabnik): alpha clipping in shadows?
                // fries you know where
                rp.drawIndexed(
                    c.mesh.drawCount,
                    c.nInstances,
                    0,
                    0,
                    c.firstInstance,
                );
            }

            let j = 0;
            rp.setPipeline(Game.gpu.pipelines.shadowSkin);
            rp.setBindGroup(0, this.skinBindGroup, [
                i * lsys.matrixAlignedSize,
            ]);

            for (const [{ primitive }] of msys.$skinnedMeshes) {
                rp.setVertexBuffer(0, primitive.position);
                rp.setVertexBuffer(1, primitive.joints);
                rp.setVertexBuffer(2, primitive.weights);
                rp.setIndexBuffer(primitive.index, "uint16");

                rp.drawIndexed(primitive.drawCount, 1, 0, 0, j++);
            }

            rp.end();
        }
    }
}
