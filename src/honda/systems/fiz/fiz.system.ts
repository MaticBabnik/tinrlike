import { System } from "@/honda/core/ecs";
import { CopyTransformMode, FizComponent } from "./fiz.component";
import { PhysicsWorld } from "./world";
import { DebugSystem, Game, type SceneNode, ScriptComponent } from "@/honda";
import type { TPhysicsObject } from "./object";
import type { CollisionManifold } from "./collisions";
import type { IFizNotify, TCollisionCallback } from "./fiznotify.interface";
import { quat } from "wgpu-matrix";
import type { Vec2Like } from "./common";
import type { TShape } from "./shapes";

const COLOR_STATIC = [0.8, 0.8, 0.8];
const COLOR_DYNAMIC = [1.0, 0.2, 0.2];
const COLOR_QUERY = [0.2, 0.8, 1.0];

export class FizSystem extends System {
    public componentType = FizComponent;

    public debug = true;
    public world: PhysicsWorld;
    protected compToNode = new Map<FizComponent, SceneNode>();
    protected objToNode = new Map<TPhysicsObject, SceneNode>();

    constructor(hashSize = 10, layersPhysics = 0xffffffff) {
        super();

        this.world = new PhysicsWorld(
            this.notifyCollision.bind(this),
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
                    quat.fromEuler(
                        0,
                        obj.angle,
                        0,
                        "xyz",
                        node.transform.rotation,
                    );
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

        if (this.debug) this.debugRenderObjects();
    }

    private debugRenderObjects(): void {
        const d = Game.ecs.maybeGetSystem(DebugSystem);
        if (!d) return;

        for (const obj of this.objToNode.keys()) {
            const color = obj.dynamic ? COLOR_DYNAMIC : COLOR_STATIC;

            switch (obj.shape.type) {
                case "aabb":
                    d.rectangle2d(
                        obj.position,
                        obj.shape.halfExtentX,
                        obj.shape.halfExtentY,
                        color,
                    );
                    break;

                case "circle":
                    d.circle2d(obj.position, obj.shape.radius, color);
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

    private notifyCollision(
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

    public collisionQuery(
        shape: TShape,
        position: Vec2Like,
        rotation: number,
        layersMask: number,

        callback: TCollisionCallback,
    ): void {
        if (this.debug) {
            const d = Game.ecs.maybeGetSystem(DebugSystem);
            if (!d) return;
            switch (shape.type) {
                case "aabb":
                    d.rectangle2d(
                        position,
                        shape.halfExtentX,
                        shape.halfExtentY,
                        COLOR_QUERY,
                    );
                    break;

                case "circle":
                    d.circle2d(position, shape.radius, COLOR_QUERY);
                    break;
            }
        }

        this.world.query(shape, position, rotation, layersMask, (fobj, mf) => {
            const fnode = this.objToNode.get(fobj);
            if (!fnode) {
                console.warn("No node for physics object", fobj);
                return;
            }

            callback(fnode, fobj, mf);
        });
    }

    public collisionQueryImmediate(
        shape: TShape,
        position: Vec2Like,
        rotation: number,
        layersMask: number,
        callback: TCollisionCallback,
    ): void {
        if (this.debug) {
            const d = Game.ecs.maybeGetSystem(DebugSystem);
            if (!d) return;

            switch (shape.type) {
                case "aabb":
                    d.rectangle2d(
                        position,
                        shape.halfExtentX,
                        shape.halfExtentY,
                        COLOR_QUERY,
                    );
                    break;

                case "circle":
                    d.circle2d(position, shape.radius, COLOR_QUERY);
                    break;
            }
        }

        this.world.queryImmediate(
            shape,
            position,
            rotation,
            layersMask,
            (fobj, mf) => {
                const fnode = this.objToNode.get(fobj);
                if (!fnode) {
                    console.warn("No node for physics object", fobj);
                    return;
                }

                callback(fnode, fobj, mf);
            },
        );
    }
}
