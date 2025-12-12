import { System } from "@/honda/core/ecs";
import { CopyTransformMode, FizComponent } from "./fiz.component";
import { PhysicsWorld } from "./world";
import { Game, type SceneNode, ScriptComponent } from "@/honda";
import type { TPhysicsObject } from "./object";
import type { CollisionManifold } from "./collisions";
import type { IFizNotify } from "./fiznotify.interface";
import { quat } from "wgpu-matrix";

export class FizSystem extends System {
    public componentType = FizComponent;

    public world: PhysicsWorld;
    protected compToNode = new Map<FizComponent, SceneNode>();
    protected objToNode = new Map<TPhysicsObject, SceneNode>();

    constructor(hashSize = 10, layersPhysics = 0xffffffff) {
        super();

        this.world = new PhysicsWorld(
            this.notifyCollission.bind(this),
            hashSize,
            layersPhysics,
        );
    }

    private _inFiz = false;

    public update() {
        for (const [component, node] of this.compToNode) {
            const obj = component.object;

            switch (component.copyTransformMode) {
                case CopyTransformMode.All:
                    //TODO: copy Y rotation back eventually...
                    obj.position[0] = node.transform.translation[0];
                    obj.position[1] = node.transform.translation[2];
                    break;

                case CopyTransformMode.PositionXZ:
                    obj.position[0] = node.transform.translation[0];
                    obj.position[1] = node.transform.translation[2];
                    break;
            }
        }

        this._inFiz = true;
        this.world.step(Game.deltaTime);
        this._inFiz = false;

        for (const [component, node] of this.compToNode) {
            const obj = component.object;
            if (!obj.dynamic) continue;

            switch (component.copyTransformMode) {
                case CopyTransformMode.All:
                    quat.fromEuler(0, obj.angle, 0, 'xyz', node.transform.rotation);
                    node.transform.translation[0] = obj.position[0];
                    node.transform.translation[2] = obj.position[1];
                    node.transform.update();
                    break;

                case CopyTransformMode.PositionXZ:
                    node.transform.translation[0] = obj.position[0];
                    node.transform.translation[2] = obj.position[1];
                    node.transform.update();
                    break;
            }
        }
    }

    public componentCreated(node: SceneNode, component: FizComponent): void {
        if (this.compToNode.has(component)) {
            console.warn("FizComponent moved to new node", component, node);
        }

        this.compToNode.set(component, node);
        this.objToNode.set(component.object, node);
        this.world.addObject(component.object);
    }

    public componentDestroyed(node: SceneNode, component: FizComponent): void {
        if (this._inFiz) {
            console.warn(
                "Removing FizComponent during physics step",
                component,
                node,
            );
        }

        this.compToNode.delete(component);
        this.objToNode.delete(component.object);
        this.world.removeObject(component.object.id);
    }

    private notifyCollission(
        object: TPhysicsObject,
        other: TPhysicsObject,
        collision: CollisionManifold,
    ) {
        const node = this.objToNode.get(object);
        const otherNode = this.objToNode.get(other);
        if (!node || !otherNode) return;

        for (const c of node.components) {
            if (c instanceof ScriptComponent) {
                (c.script as Partial<IFizNotify>).onCollision?.(
                    otherNode,
                    other,
                    collision,
                );
            }
        }
    }
}
