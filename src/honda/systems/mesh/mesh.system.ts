import type { SceneNode } from "@/honda/core/node";
import { System } from "../../core/ecs";
import {
    type MeshComponent,
    MeshComponentBase,
    SkinnedMeshComponent,
} from "./mesh.component";
import { Game, type Material, type Mesh } from "@/honda";

interface IDrawCall {
    mat: Material;
    mesh: Mesh;

    firstInstance: number;
    nInstances: number;
}

type SystemComponent = MeshComponent | SkinnedMeshComponent;

export class MeshSystem extends System {
    public componentType = MeshComponentBase;
    protected instances: Float32Array;
    public instanceBuffer: GPUBuffer;
    public calls = [] as IDrawCall[];

    constructor(maxInstances: number = 4096) {
        super();
        this.instances = new Float32Array(maxInstances * 32);
        //FIXME: GPU resource in a System! I am VOMIT!!!
        this.instanceBuffer = Game.gpu.device.createBuffer({
            label: "MeshInstances",
            size: this.instances.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
        });
    }

    protected meshes = new Map<MeshComponent, SceneNode>();
    protected skinnedMeshes = new Map<SkinnedMeshComponent, SceneNode>();

    public componentCreated(node: SceneNode, comp: SystemComponent) {
        if (
            this.meshes.delete(comp as MeshComponent) ||
            this.skinnedMeshes.delete(comp as SkinnedMeshComponent)
        ) {
            console.warn(
                "FIXME: component created twice!?",
                comp.name ?? "???",
                "-",
                node.name ?? "???",
            );
        }

        if (comp instanceof SkinnedMeshComponent) {
            this.skinnedMeshes.set(comp, node);
        } else {
            this.meshes.set(comp, node);
        }
    }

    public componentDestroyed(_: SceneNode, comp: SystemComponent) {
        this.meshes.delete(comp as MeshComponent);
        this.skinnedMeshes.delete(comp as SkinnedMeshComponent);
    }

    public get $skinnedMeshes() {
        return this.skinnedMeshes.entries();
    }

    public lateUpdate(): void {
        for (const [smc, node] of this.skinnedMeshes) {
            smc.updateBoneMatrices(node);
        }

        const sortedEntities = this.meshes
            .entries()
            .toArray()
            .sort(([a], [b]) => {
                const dmt = a.material.type - b.material.type;
                if (dmt !== 0) return dmt;
                const dmid = a.material.id - b.material.id;
                if (dmid !== 0) return dmid;
                return a.primitive.id - b.primitive.id;
            });

        this.calls = [];
        if (sortedEntities.length === 0) return;

        let i = 0,
            previousMesh: Mesh | undefined,
            previousMat: Material | undefined;

        for (const [
            { material: mat, primitive: mesh },
            { transform: tc },
        ] of sortedEntities) {
            this.instances.set(tc.$glbMtx, i * 32);
            this.instances.set(tc.$glbInvMtx, i * 32 + 16);

            if (previousMat !== mat || previousMesh !== mesh) {
                this.calls.push({
                    firstInstance: i,
                    nInstances: 1,
                    mat,
                    mesh,
                });
                previousMat = mat;
                previousMesh = mesh;
            } else {
                this.calls.at(-1)!.nInstances++;
            }
            i++;
        }

        Game.gpu.device.queue.writeBuffer(
            this.instanceBuffer,
            0,
            this.instances.buffer,
            0,
            4 * 32 * i,
        );
    }
}
