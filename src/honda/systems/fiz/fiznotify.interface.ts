import type { SceneNode } from "@/honda/core/node";
import type { TPhysicsObject } from "./object";
import type { CollisionManifold } from "./collisions";

export type TCollisionCallback = (
    otherNode: SceneNode,
    otherObj: TPhysicsObject,
    manifold: CollisionManifold,
) => void;

export interface IFizNotify {
    onCollision: TCollisionCallback;
}
