import type { SceneNode } from "@/honda/core/node";
import type { TPhysicsObject } from "./object";
import type { CollisionManifold } from "./collisions";

export interface IFizNotify {
    onCollision(
        otherNode: SceneNode,
        otherObj: TPhysicsObject,
        manifold: CollisionManifold,
    ): void;
}
