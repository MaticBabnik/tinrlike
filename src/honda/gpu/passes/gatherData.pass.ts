import { Game } from "@/honda/state";
import type { IPass } from "./pass.interface";
import type { Mat4 } from "wgpu-matrix";
import type { StructArrayBuffer } from "../buffer";
import { MeshSystem } from "@/honda/systems";

type SkinGPUType = {
    transform: Mat4;
    invTransform: Mat4;
    joints: Float32Array;
};

export class GatherDataPass implements IPass {
    constructor(private skinMeshBuffer: StructArrayBuffer<SkinGPUType>) {}

    apply(): void {
        const meshSystem = Game.ecs.getSystem(MeshSystem);

        this.gatherSkinData(meshSystem);
    }

    gatherSkinData(meshSystem: MeshSystem): void {
        let idx = 0;

        for (const [c, n] of meshSystem.$skinnedMeshes) {
            if (idx >= this.skinMeshBuffer.count) {
                console.warn("Skin buffer overflow");
                break;
            }

            this.skinMeshBuffer.set(idx++, {
                transform: n.transform.$glbMtx,
                invTransform: n.transform.$glbInvMtx,

                joints: c.boneMatrices,
            });
        }
        
        this.skinMeshBuffer.push(0, this.skinMeshBuffer.elementSize * idx);
    }
}
