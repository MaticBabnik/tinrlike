import type { IPass } from "../../common/passes/pass.interface";
import { mat4, vec3, vec4, type Mat4, type Vec3, type Vec4 } from "wgpu-matrix";
import type { Buffer, StructArrayBuffer, StructBuffer } from "../../../buffer";
import type {
    CameraSystem,
    ISpotLight,
    LightSystem,
    MeshComponent,
    MeshSystem,
    THondaLight,
} from "@/honda/systems";
import { GPUMatAlpha, type IGPUMat, type MeshV2 } from "@/honda/gpu2";
import type { WGpu } from "../../../gpu";
import type { WGMat } from "../../../resources/mat";
import type { PostCfg, SceneNode, Three, VisualService } from "@/honda";

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
    maxShadowmaps: number;
    shadowmapVPs: Mat4[];
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

export interface PassDraws {
    opaque: ToonDrawCall[];
    blend?: ToonDrawCall[];
}

export interface MeshDraws2 {
    main: PassDraws;
    shadows: PassDraws[];
}

export interface GPUPostCfg extends PostCfg {
    time: number;
    framen: number;
}

export class GatherDataPass implements IPass {
    private matrixAlign: number;
    private maxNShadowmaps: number;

    constructor(
        private g: WGpu,

        private cameraSystem: CameraSystem,
        private meshSystem: MeshSystem,
        private lightSystem: LightSystem,
        private visualService: VisualService,

        private meshDrawCalls: MeshDraws2,
        private meshInstanceBuffer: StructArrayBuffer<ToonMeshInstance>,
        private lightInstanceBuffer: StructArrayBuffer<LightInstance>,
        private lightVPBuffer: Buffer,
        private uniformData: UniformData,
        private postConfigBuffer: StructBuffer<GPUPostCfg>,
    ) {
        const minOffsetAlign =
            this.g.device.limits.minUniformBufferOffsetAlignment;
        // this *should* be good enough
        this.matrixAlign = Math.max(MATRIX_SIZE, minOffsetAlign);
        this.maxNShadowmaps = Math.floor(lightVPBuffer.size / this.matrixAlign);

        this.meshDrawCalls.shadows = new Array(this.maxNShadowmaps)
            .fill(0)
            .map(() => ({ opaque: [] }));
    }

    apply(): void {
        this.gatherCameraData();
        this.gatherLightData();

        this.gatherMeshData();
        // this.gatherSkinData(); //TODO: reimplement skinning

        this.gatherPostConfig();
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

    private _sortedMeshes: [MeshComponent, SceneNode][] = [];

    private gatherMeshes() {
        this._sortedMeshes = this.meshSystem.$meshes
            .toArray()
            .sort(([a], [b]) => {
                // sort by alpha mode (opaque, clip, blend)
                const alphaModeA = a.material.alphaMode - b.material.alphaMode;
                if (alphaModeA !== 0) return alphaModeA;

                // sort by material (to reduce bind group changes)
                const dmt = (a.material as WGMat).id - (b.material as WGMat).id;
                if (dmt !== 0) return dmt;

                // sort by mesh (instancing)
                return a.primitive.id - b.primitive.id;
            });
    }

    private $frustumPlanes = new Array(6).fill(0).map(() => vec4.create());

    private static frustumPlane(
        m: Mat4,
        s0: number,
        r0: number,
        s1: number,
        r1: number,
        dst: Vec4,
    ) {
        dst[0] = s0 * m[r0] + s1 * m[r1];
        dst[1] = s0 * m[4 + r0] + s1 * m[4 + r1];
        dst[2] = s0 * m[8 + r0] + s1 * m[8 + r1];
        dst[3] = s0 * m[12 + r0] + s1 * m[12 + r1];

        const len = 1 / Math.hypot(dst[0], dst[1], dst[2]);

        dst[0] *= len;
        dst[1] *= len;
        dst[2] *= len;
        dst[3] *= len;
    }

    private putFrustumPlanes(vp: Mat4) {
        GatherDataPass.frustumPlane(vp, 1, 3, 1, 0, this.$frustumPlanes[0]); // Left
        GatherDataPass.frustumPlane(vp, 1, 3, -1, 0, this.$frustumPlanes[1]); // Right
        GatherDataPass.frustumPlane(vp, 1, 3, 1, 1, this.$frustumPlanes[2]); // Bottom
        GatherDataPass.frustumPlane(vp, 1, 3, -1, 1, this.$frustumPlanes[3]); // Top
        GatherDataPass.frustumPlane(vp, 1, 3, 1, 2, this.$frustumPlanes[4]); // Near
        GatherDataPass.frustumPlane(vp, 1, 3, -1, 2, this.$frustumPlanes[5]); // Far
    }

    private $ccenter = vec3.create();
    private $cx = vec3.create();
    private $cy = vec3.create();
    private $cz = vec3.create();

    private cullMesh(wrld: Mat4, he: Three<number>): boolean {
        mat4.getTranslation(wrld, this.$ccenter);
        mat4.getAxis(wrld, 0, this.$cx);
        mat4.getAxis(wrld, 1, this.$cy);
        mat4.getAxis(wrld, 2, this.$cz);

        for (let i = 0; i < 6; i++) {
            const p = this.$frustumPlanes[i];
            const d = p[3];

            const r =
                Math.abs(vec3.dot(p, this.$cx)) * he[0] +
                Math.abs(vec3.dot(p, this.$cy)) * he[1] +
                Math.abs(vec3.dot(p, this.$cz)) * he[2];

            const dist = vec3.dot(p, this.$ccenter) + d;

            if (dist < -r) return false;
        }
        return true;
    }

    private gatherDrawsCulled(
        vp: Mat4,
        isShadowPass: boolean,
        dst: PassDraws,
        instance: number,
    ): number {
        dst.opaque.length = 0;

        if (this._sortedMeshes.length === 0) return instance;

        // activate the frustum planes for culling
        this.putFrustumPlanes(vp);

        let meshIdx = 0;
        let previousDrawCall: ToonDrawCall | undefined;

        for (; meshIdx < this._sortedMeshes.length; meshIdx++) {
            const md = this._sortedMeshes[meshIdx];

            // only process non-blended meshes in the common case
            if (md[0].material.alphaMode === GPUMatAlpha.BLEND) break;

            // if shadow skip non-casters
            if (isShadowPass && md[0].castShadow === false) continue;
            // if main skip non-rendered
            if (
                !isShadowPass &&
                !md[0].material.renderMain &&
                !md[0].material.renderPrepass
            )
                continue;

            if (
                !this.cullMesh(
                    md[1].transform.$glbMtx,
                    md[0].primitive.halfExtents,
                )
            )
                continue;

            // at this point we know the mesh is visible and should be rendered
            // give it a transform slot
            this.meshInstanceBuffer.set(instance, {
                transform: md[1].transform.$glbMtx,
                invTransform: md[1].transform.$glbInvMtx,
            });

            if (
                !previousDrawCall ||
                previousDrawCall.mat !== md[0].material ||
                previousDrawCall.mesh !== md[0].primitive
            ) {
                previousDrawCall = {
                    firstInstance: instance,
                    nInstances: 1,
                    mat: md[0].material,
                    mesh: md[0].primitive,
                    shadow: md[0].castShadow,
                    distance: 0,
                };
                dst.opaque.push(previousDrawCall);
            } else {
                previousDrawCall.nInstances++;
            }
            instance++;
        }

        if (!isShadowPass && dst.blend) {
            dst.blend.length = 0;
            for (; meshIdx < this._sortedMeshes.length; meshIdx++) {
                const md = this._sortedMeshes[meshIdx];

                if (!md[0].material.renderMain) continue;

                if (
                    !this.cullMesh(
                        md[1].transform.$glbMtx,
                        md[0].primitive.halfExtents,
                    )
                )
                    continue;

                this.meshInstanceBuffer.set(instance, {
                    transform: md[1].transform.$glbMtx,
                    invTransform: md[1].transform.$glbInvMtx,
                });

                // we don't merge blended draws, since they are Z-sorted
                const drawCall: ToonDrawCall = {
                    firstInstance: instance,
                    nInstances: 1,
                    mat: md[0].material,
                    mesh: md[0].primitive,
                    shadow: false,
                    distance: this.toCameraDistance(md[1].transform.$glbMtx),
                };
                dst.blend.push(drawCall);
                instance++;
            }

            dst.blend.sort((a, b) => b.distance - a.distance);
        }

        return instance;
    }

    private gatherMeshData(): void {
        this.gatherMeshes();

        let i = 0;

        i = this.gatherDrawsCulled(
            this.cameraSystem.viewProjMtx,
            false,
            this.meshDrawCalls.main,
            i,
        );

        for (let j = 0; j < this.uniformData.nShadowmaps; j++) {
            i = this.gatherDrawsCulled(
                this.uniformData.shadowmapVPs[j],
                true,
                this.meshDrawCalls.shadows[j],
                i,
            );
        }

        // send instance data to GPU
        this.meshInstanceBuffer.push(
            0,
            i * this.meshInstanceBuffer.elementSize,
        );

        // this.$debugPrintDraws();
    }

    public $debugPrintDraws() {
        const totalMeshes = this._sortedMeshes.length;

        const mainDrawCalls =
            this.meshDrawCalls.main.opaque.length +
            (this.meshDrawCalls.main.blend?.length ?? 0);

        const instancingEfficiency = totalMeshes / mainDrawCalls;

        const drawnInstances =
            this.meshDrawCalls.main.opaque.reduce(
                (acc, dc) => acc + dc.nInstances,
                0,
            ) +
            (this.meshDrawCalls.main.blend?.reduce(
                (acc, dc) => acc + dc.nInstances,
                0,
            ) ?? 0);

        const culled = (1 - drawnInstances / totalMeshes) * 100;

        console.log(
            `Main pass - Total meshes: ${totalMeshes}, Draw calls: ${mainDrawCalls}, Instancing efficiency: ${instancingEfficiency.toFixed(2)}, Culled: ${culled.toFixed(0)}%`,
        );
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
                    this.uniformData.shadowmapVPs[shadowIdx] = vp;
                    mat4.mul(proj, t.$glbInvMtx, vp);
                    shadowIdx++;
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

    private gatherPostConfig(): void {
        const c = this.visualService.postConfig;
        this.postConfigBuffer.set(c);
        this.postConfigBuffer.set({
            time: performance.now() / 1000,
            framen: this.g.frameNo % (1 << 30),
        });
        this.postConfigBuffer.push();
    }
}
