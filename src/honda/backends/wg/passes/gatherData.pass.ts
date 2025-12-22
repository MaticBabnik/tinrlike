import { Game } from "@/honda/state";
import type { IPass } from "./pass.interface";
import { mat4, vec4, type Mat4, type Vec3 } from "wgpu-matrix";
import type { Buffer, StructArrayBuffer } from "../buffer";
import {
    CameraSystem,
    IDirectionalLight,
    ISpotLight,
    LightSystem,
    MeshSystem,
    THondaLight,
} from "@/honda/systems";
import { IGPUMat, MeshV2, Three } from "@/honda/gpu2";
import { WGpu } from "../gpu";
import { WGMat } from "../resources/mat";

type MeshInstance = {
    transform: Mat4;
    invTransform: Mat4;
};

type SkinMeshInstance = {
    joints: Float32Array;
} & MeshInstance;

type LightInstance = {
    position: Vec3 | Three<number>;
    direction: Vec3 | Three<number>;
    color: Vec3 | Three<number>;

    ltype: number;
    intensity: number;
    maxRange: number;
    innerCone: number;
    outerCone: number;

    shadowMap: number;
    VP: Mat4;
};

export type DrawCall = {
    mat: IGPUMat;
    mesh: MeshV2;
    firstInstance: number;
    nInstances: number;
};

export type Instance = {
    mat: IGPUMat;
    mesh: MeshV2;
};

export type UniformData = {
    v: Mat4;
    vInv: Mat4;
    vp: Mat4;
    vpInv: Mat4;
    pInv: Mat4;
    nLights: number;
    nShadowmaps: number;
};

const TYPE_MAP: Record<THondaLight["type"], number> = {
    point: 0,
    directional: 1,
    spot: 2,
};

const MATRIX_SIZE = 4 * 4 * 4;

export class GatherDataPass implements IPass {
    private matrixAlign: number;
    private maxNShadowmaps: number;

    constructor(
        private g: WGpu,

        private cameraSystem: CameraSystem,
        private meshSystem: MeshSystem,
        private lightSystem: LightSystem,

        private meshDrawCalls: DrawCall[],
        private meshInstanceBuffer: StructArrayBuffer<MeshInstance>,
        private skinMeshInstances: Instance[],
        private skinMeshInstanceBuffer: StructArrayBuffer<SkinMeshInstance>,
        private lightInstanceBuffer: StructArrayBuffer<LightInstance>,
        private lightVPBuffer: Buffer,
        private uniformData: UniformData,
    ) {
        const minOffsetAlign =
            this.g.device.limits.minUniformBufferOffsetAlignment;
        // this *should* be good enough
        this.matrixAlign = Math.max(MATRIX_SIZE, minOffsetAlign);
        this.maxNShadowmaps = Math.floor(lightVPBuffer.size / this.matrixAlign);
    }

    apply(): void {
        this.gatherCameraData();
        this.gatherMeshData();
        this.gatherSkinData();
        this.gatherLightData();
    }

    gatherCameraData(): void {
        const cam = this.cameraSystem.activeCamera;
        if (!cam) return;

        this.uniformData.v = this.cameraSystem.viewMtx;
        this.uniformData.vInv = this.cameraSystem.viewMtxInv;
        this.uniformData.vp = this.cameraSystem.viewProjMtx;
        this.uniformData.vpInv = this.cameraSystem.viewProjMtxInv;
        this.uniformData.pInv = cam.projMtxInv;
    }

    gatherMeshData(): void {
        const sortedEntities = this.meshSystem.$meshes
            .toArray()
            .sort(([a], [b]) => {
                const dmt = (a.material as WGMat).id - (a.material as WGMat).id;
                if (dmt !== 0) return dmt;
                return a.primitive.id - b.primitive.id;
            });

        this.meshDrawCalls.length = 0;
        if (sortedEntities.length === 0) return;

        let i = 0,
            previousMesh: MeshV2 | undefined,
            previousMat: IGPUMat | undefined;

        for (const [
            { material: mat, primitive: mesh },
            { transform: tc },
        ] of sortedEntities) {
            this.meshInstanceBuffer.set(i, {
                transform: tc.$glbMtx,
                invTransform: tc.$glbInvMtx,
            });

            if (previousMat !== mat || previousMesh !== mesh) {
                this.meshDrawCalls.push({
                    firstInstance: i,
                    nInstances: 1,
                    mat,
                    mesh,
                });
                previousMat = mat;
                previousMesh = mesh;
            } else {
                this.meshDrawCalls.at(-1)!.nInstances++;
            }
            i++;
        }

        this.meshInstanceBuffer.push();
    }

    gatherSkinData(): void {
        let idx = 0;
        this.skinMeshInstances.length = 0;

        for (const [c, n] of this.meshSystem.$skinnedMeshes) {
            if (idx >= this.skinMeshInstanceBuffer.count) {
                console.warn("Skin buffer overflow");
                break;
            }

            this.skinMeshInstances.push({ mat: c.material, mesh: c.primitive });

            this.skinMeshInstanceBuffer.set(idx++, {
                transform: n.transform.$glbMtx,
                invTransform: n.transform.$glbInvMtx,

                joints: c.boneMatrices,
            });
        }

        this.skinMeshInstanceBuffer.push();
    }

    gatherLightData(): void {
        let lightIdx = 0;
        let shadowIdx = 0;

        const proj = mat4.create();
        const tmp = vec4.create();

        for (const [{ lightInfo }, n] of this.lightSystem.$components) {
            if (lightInfo.intensity < 1e-3) continue;

            const t = n.transform;

            vec4.transformMat4([0, 0, -1, 0], t.$glbMtx, tmp);

            let vp: Mat4 | undefined;

            if (lightInfo.castShadows && shadowIdx >= this.maxNShadowmaps) {
                console.warn("Max shadowmaps reached");
            } else if (
                lightInfo.castShadows &&
                shadowIdx < this.maxNShadowmaps
            ) {
                vp = new Float32Array(
                    this.lightVPBuffer.cpuBuf,
                    shadowIdx * this.matrixAlign,
                    4 * 4,
                ) as Mat4;

                switch (lightInfo.type) {
                    case "point":
                        console.warn("Point light shadows not implemented");
                        vp = undefined;
                        break;

                    case "directional":
                        mat4.ortho(
                            -lightInfo.maxRange,
                            lightInfo.maxRange,
                            -lightInfo.maxRange,
                            lightInfo.maxRange,
                            lightInfo.maxRange,
                            -lightInfo.maxRange,
                            proj,
                        );
                        break;

                    case "spot":
                        mat4.perspectiveReverseZ(
                            lightInfo.outerCone * 2,
                            1,
                            0.01,
                            lightInfo.maxRange,
                            proj,
                        );
                        break;
                }

                if (vp) {
                    shadowIdx++;
                    mat4.mul(proj, t.$glbInvMtx, vp);
                }
            }

            this.lightInstanceBuffer.set(lightIdx++, {
                position: n.transform.$glbMtx.slice(12, 15) as Vec3,
                direction: tmp,
                color: lightInfo.color,

                ltype: TYPE_MAP[lightInfo.type],
                intensity: lightInfo.intensity,
                maxRange: lightInfo.maxRange,
                innerCone: (lightInfo as ISpotLight).innerCone ?? 0,
                outerCone: (lightInfo as ISpotLight).outerCone ?? 0,

                shadowMap: vp ? shadowIdx - 1 : -1,
                VP: vp ?? mat4.identity(proj), // avoid undefined
            });

            if (lightIdx >= this.lightInstanceBuffer.count) {
                console.warn("Light buffer overflow");
                break;
            }
        }

        this.uniformData.nLights = lightIdx;
        this.uniformData.nShadowmaps = shadowIdx;
        this.lightInstanceBuffer.push();
        this.lightVPBuffer.push();
    }
}
