import type { IPass } from "../pass.interface";
import { mat4, vec4, type Mat4, type Vec3 } from "wgpu-matrix";
import type { Buffer, StructArrayBuffer } from "../../buffer";
import type {
    CameraSystem,
    ISpotLight,
    LightSystem,
    MeshSystem,
    THondaLight,
} from "@/honda/systems";
import { GPUMatAlpha, type IGPUMat, type MeshV2 } from "@/honda/gpu2";
import type { WGpu } from "../../gpu";
import type { WGMat } from "../../resources/mat";
import type { Three } from "@/honda";

export type ToonMeshInstance = {
    transform: Mat4;
    invTransform: Mat4;
};

// type SkinMeshInstance = {
//     joints: Float32Array;
// } & ToonMeshInstance;

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
    shadow: boolean;
    mat: IGPUMat;
    mesh: MeshV2;
    firstInstance: number;
    nInstances: number;
};

export type Instance = {
    shadow: boolean;
    mat: IGPUMat;
    mesh: MeshV2;
};

export type UniformData = {
    v: Mat4;
    vInv: Mat4;
    vp: Mat4;
    vpInv: Mat4;
    pInv: Mat4;

    near: number;
    far: number;
    isOrtho: number;

    nLights: number;
    nShadowmaps: number;
};

const TYPE_MAP: Record<THondaLight["type"], number> = {
    point: 0,
    directional: 1,
    spot: 2,
};

const MATRIX_SIZE = 4 * 4 * 4;

const M4ID = mat4.identity();

export interface ToonDrawCall {
    shadow: boolean;
    mat: IGPUMat;
    mesh: MeshV2;
    firstInstance: number;
    nInstances: number;
    distance: number;
}

export interface MeshDraws {
    opaque: ToonDrawCall[];
    blend: ToonDrawCall[];
}

export class GatherDataPass implements IPass {
    private matrixAlign: number;
    private maxNShadowmaps: number;

    constructor(
        private g: WGpu,

        private cameraSystem: CameraSystem,
        private meshSystem: MeshSystem,
        private lightSystem: LightSystem,

        private meshDrawCalls: MeshDraws,
        private meshInstanceBuffer: StructArrayBuffer<ToonMeshInstance>,
        // private skinMeshInstances: Instance[],
        // private skinMeshInstanceBuffer: StructArrayBuffer<SkinMeshInstance>,
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

    private gatherCameraData(): void {
        const cam = this.cameraSystem.activeCamera;
        if (!cam) {
            this.uniformData.v = M4ID;
            this.uniformData.vInv = M4ID;
            this.uniformData.vp = M4ID;
            this.uniformData.vpInv = M4ID;
            this.uniformData.pInv = M4ID;
            this.uniformData.near = 0;
            this.uniformData.far = 1;
            this.uniformData.isOrtho = 1;
            return;
        }

        this.uniformData.v = this.cameraSystem.viewMtx;
        this.uniformData.vInv = this.cameraSystem.viewMtxInv;
        this.uniformData.vp = this.cameraSystem.viewProjMtx;
        this.uniformData.vpInv = this.cameraSystem.viewProjMtxInv;
        this.uniformData.pInv = cam.projMtxInv;
        this.uniformData.near = this.cameraSystem.near;
        this.uniformData.far = this.cameraSystem.far;
        this.uniformData.isOrtho = this.cameraSystem.isOrtho ? 1 : 0;
    }

    private $cdv1 = vec4.create(0, 0, 0, 1);
    private $cdv2 = vec4.create(0, 0, 0, 1);

    private toCameraDistance(transform: Mat4): number {
        this.$cdv1[0] = transform[12];
        this.$cdv1[1] = transform[13];
        this.$cdv1[2] = transform[14];

        vec4.transformMat4(this.$cdv1, this.uniformData.vp, this.$cdv2);

        if (this.uniformData.isOrtho) {
            return this.$cdv2[2];
        } else {
            return this.$cdv2[2] / this.$cdv2[3];
        }
    }

    private gatherMeshData(): void {
        const sortedMeshes = this.meshSystem.$meshes
            .toArray()
            .sort(([a], [b]) => {
                // sort by alpha mode (opaque, clip, blend)
                const alphaModeA = a.material.alphaMode - b.material.alphaMode;
                if (alphaModeA !== 0) return alphaModeA;

                // sort by material (to reduce bind group changes)
                const dmt = (a.material as WGMat).id - (a.material as WGMat).id;
                if (dmt !== 0) return dmt;

                // sort by mesh (instancing)
                return a.primitive.id - b.primitive.id;
            });

        this.meshDrawCalls.opaque.length = 0;
        this.meshDrawCalls.blend.length = 0;

        if (sortedMeshes.length === 0) return;

        let i = 0;
        let previousDrawCall: ToonDrawCall | undefined;

        for (const [m, n] of sortedMeshes) {
            if (m.material.alphaMode === GPUMatAlpha.BLEND) {
                break;
            }

            this.meshInstanceBuffer.set(i, {
                transform: n.transform.$glbMtx,
                invTransform: n.transform.$glbInvMtx,
            });

            if (
                !previousDrawCall ||
                previousDrawCall.mat !== m.material ||
                previousDrawCall.mesh !== m.primitive
            ) {
                const drawCall: ToonDrawCall = {
                    firstInstance: i,
                    nInstances: 1,
                    mat: m.material,
                    mesh: m.primitive,
                    shadow: m.castShadow,
                    distance: 0,
                };
                this.meshDrawCalls.opaque.push(drawCall);
                previousDrawCall = drawCall;
            } else {
                previousDrawCall.nInstances++;
            }

            i++;
        }

        for (; i < sortedMeshes.length; i++) {
            const [m, n] = sortedMeshes[i];

            this.meshInstanceBuffer.set(i, {
                transform: n.transform.$glbMtx,
                invTransform: n.transform.$glbInvMtx,
            });

            const drawCall: ToonDrawCall = {
                firstInstance: i,
                nInstances: 1,
                mat: m.material,
                mesh: m.primitive,
                shadow: false,
                distance: this.toCameraDistance(n.transform.$glbMtx),
            };

            this.meshDrawCalls.blend.push(drawCall);
        }

        // sort translucent meshes back to front
        this.meshDrawCalls.blend.sort((a, b) => b.distance - a.distance);


        // send instance data to GPU
        this.meshInstanceBuffer.push();
    }

    private gatherSkinData(): void {
        // let idx = 0;
        // this.skinMeshInstances.length = 0;
        // for (const [c, n] of this.meshSystem.$skinnedMeshes) {
        //     if (idx >= this.skinMeshInstanceBuffer.count) {
        //         console.warn("Skin buffer overflow");
        //         break;
        //     }
        //     this.skinMeshInstances.push({
        //         mat: c.material,
        //         mesh: c.primitive,
        //         shadow: c.castShadow,
        //     });
        //     this.skinMeshInstanceBuffer.set(idx++, {
        //         transform: n.transform.$glbMtx,
        //         invTransform: n.transform.$glbInvMtx,
        //         joints: c.boneMatrices,
        //     });
        // }
        // this.skinMeshInstanceBuffer.push();
    }

    private gatherLightData(): void {
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
