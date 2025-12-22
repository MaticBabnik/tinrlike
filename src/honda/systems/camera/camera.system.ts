import { mat4 } from "wgpu-matrix";
import { CameraComponent } from "./camera.component";
import { System } from "@/honda/core/ecs";
import type { SceneNode } from "@/honda/core/node";
import type { Transform } from "@/honda/core/transform";

export class CameraSystem extends System {
    public componentType = CameraComponent;

    public activeCamera?: CameraComponent;

    public viewProjMtxInv = mat4.identity();
    public viewProjMtx = mat4.identity();
    public viewMtx = mat4.identity();
    public viewMtxInv = mat4.identity();
    public near = 0;
    public far = 0;
    public isOrtho = false;

    protected components = new Map<CameraComponent, SceneNode>();

    public componentCreated(node: SceneNode, comp: CameraComponent) {
        if (this.components.delete(comp)) {
            console.warn("moved component to new node", comp, node);
        }
        this.components.set(comp, node);
    }

    public componentDestroyed(_: SceneNode, comp: CameraComponent) {
        this.components.delete(comp);
    }

    public lateUpdate(): void {
        const activeCamera = this.components.entries().find(([c]) => c.active);
        if (!activeCamera) return;
        this.activeCamera = activeCamera[0];
        const cc = this.activeCamera;
        const tc = activeCamera[1].transform;

        // V = T^-1
        this.viewMtx.set(tc.$glbInvMtx);

        // V^-1 = T
        this.viewMtxInv.set(tc.$glbMtx);

        // VP = P * V
        mat4.multiply(cc.projMtx, this.viewMtx, this.viewProjMtx);

        // (VP)^-1 = V^-1 * P^-1
        mat4.mul(this.viewMtxInv, cc.projMtxInv, this.viewProjMtxInv);

        this.near = cc.near;
        this.far = cc.far;
        this.isOrtho = true; //TODO fix!
    }

    /**
     * Overrides camera until end of frame
     */
    public overrideCamera(cc: CameraComponent, tc: Transform) {
        this.activeCamera = cc;

        // V = T^-1
        this.viewMtx.set(tc.$glbInvMtx);

        // V^-1 = T
        this.viewMtxInv.set(tc.$glbMtx);

        // VP = P * V
        mat4.multiply(cc.projMtx, this.viewMtx, this.viewProjMtx);

        // (VP)^-1 = V^-1 * P^-1
        mat4.mul(this.viewMtxInv, cc.projMtxInv, this.viewProjMtxInv);
    }

    public getActiveCameraNode(): SceneNode | undefined {
        return this.activeCamera && this.components.get(this.activeCamera);
    }
}
