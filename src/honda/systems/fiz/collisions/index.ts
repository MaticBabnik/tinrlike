import type { TPhysicsObject } from "../object";

import { aabbVsAabb } from "./aabb-aabb";
import { aabbVsCircle } from "./aabb-circle";
import { circleVsCircle } from "./circle-circle";

// Import/Export (https://www.youtube.com/watch?v=wdd4NBUmVUQ)
import type { CollisionManifold } from "./manifold";
export type { CollisionManifold } from "./manifold";

export function objectVsObject(
    a: TPhysicsObject,
    b: TPhysicsObject,
): CollisionManifold | null {
    const flip = a.shape.type > b.shape.type;
    // sort so that the "lower" type is always first (halves the number of cases)
    if (flip) {
        const tmp = a;
        a = b;
        b = tmp;
    }

    if (a.shape.type === "aabb") {
        if (b.shape.type === "aabb") {
            return aabbVsAabb(a.position, a.shape, b.position, b.shape, flip);
        } else if (b.shape.type === "box") {
            throw new Error("Not implemented: aabb vs box collision");
            // return aabbVsBox(
            //     a.position, a.shape,
            //     b.position, b.angle, b.shape,
            //     flip
            // );
        } else if (b.shape.type === "circle") {
            return aabbVsCircle(a.position, a.shape, b.position, b.shape, flip);
        }
    } else if (a.shape.type === "box") {
        if (b.shape.type === "box") {
            throw new Error("Not implemented: box vs box collision");
            // return boxVsBox(
            //     a.position, a.angle, a.shape,
            //     b.position, b.angle, b.shape,
            //     flip
            // );
        } else if (b.shape.type === "circle") {
            throw new Error("Not implemented: box vs circle collision");
            // return boxVsCircle(
            //     a.position, a.angle, a.shape,
            //     b.position, b.shape,
            //     flip
            // );
        }
    } else if (a.shape.type === "circle") {
        if (b.shape.type === "circle") {
            return circleVsCircle(
                a.position,
                a.shape,
                b.position,
                b.shape,
                flip,
            );
        }
    }

    throw new Error(
        `Unhandled shape types: ${a.shape.type} vs ${b.shape.type}`,
    );
}
