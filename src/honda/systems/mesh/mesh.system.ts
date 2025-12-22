import type { SceneNode } from "@/honda/core/node";
import { System } from "../../core/ecs";
import {
    type MeshComponent,
    MeshComponentBase,
    SkinnedMeshComponent,
} from "./mesh.component";

type SystemComponent = MeshComponent | SkinnedMeshComponent;

export class MeshSystem extends System {
    public componentType = MeshComponentBase;
    
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

    public get $meshes() {
        return this.meshes.entries();
    }

    public get $skinnedMeshes() {
        return this.skinnedMeshes.entries();
    }

    public lateUpdate(): void {
        for (const [smc, node] of this.skinnedMeshes) {
            smc.updateBoneMatrices(node);
        }
    }
}
