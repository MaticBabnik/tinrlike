import { vec2, type Vec2 } from "wgpu-matrix";
import type { CollisionManifold } from "./manifold";
import type { AABBShape } from "../shapes/aabb";

export function aabbVsAabb(
    posA: Vec2,
    shapeA: AABBShape,
    posB: Vec2,
    shapeB: AABBShape,
    flip: boolean = false,
): CollisionManifold | null {
    // min/max coords
    const aMinX = posA[0] - shapeA.halfExtentX;
    const aMinY = posA[1] - shapeA.halfExtentY;
    const aMaxX = posA[0] + shapeA.halfExtentX;
    const aMaxY = posA[1] + shapeA.halfExtentY;
    const bMinX = posB[0] - shapeB.halfExtentX;
    const bMinY = posB[1] - shapeB.halfExtentY;
    const bMaxX = posB[0] + shapeB.halfExtentX;
    const bMaxY = posB[1] + shapeB.halfExtentY;

    // overlaps
    const ol = aMaxX - bMinX,
        or = bMaxX - aMinX,
        ob = aMaxY - bMinY,
        ot = bMaxY - aMinY;

    // separating axis found?
    if (ol <= 0 || or <= 0 || ob <= 0 || ot <= 0) {
        return null;
    }

    // find minimum overlap
    const minOverlapX = Math.min(ol, or);
    const minOverlapY = Math.min(ob, ot);

    // manifold data
    const normal = vec2.create();
    const penetrationPoint = posA; // TODO: wrong! (correct is cancer)
    let depth: number;

    // pick minimum axis as collision normal
    if (minOverlapX < minOverlapY) {
        depth = minOverlapX;
        normal[0] = ol < or !== flip ? -1 : 1;
    } else {
        depth = minOverlapY;
        normal[1] = ob < ot !== flip ? -1 : 1;
    }

    depth /= 2;

    return {
        normal,
        depth,
        penetrationPoint,
    };
}
