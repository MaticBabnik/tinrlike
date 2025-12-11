import { vec2, type Vec2 } from "wgpu-matrix";
import type { CollisionManifold } from "./manifold";
import type { AABBShape, CircleShape } from "../shapes";

export function aabbVsCircle(
    posA: Vec2,
    shapeA: AABBShape,
    posB: Vec2,
    shapeB: CircleShape,
    flip: boolean = false,
): CollisionManifold | null {
    const hx = shapeA.halfExtentX;
    const hy = shapeA.halfExtentY;

    // Circle center in AABB-local space
    const local = vec2.sub(posB, posA);

    // Closest point on the AABB to the circle center (clamped to extents)
    const closest = vec2.fromValues(
        Math.min(Math.max(local[0], -hx), hx),
        Math.min(Math.max(local[1], -hy), hy),
    );

    // Vector from closest point to circle center
    const diff = vec2.sub(local, closest);
    const distSq = vec2.dot(diff, diff);
    const r = shapeB.radius;

    // If the circle center is outside the AABB and farther than the radius, no collision
    if (distSq > r * r) {
        return null;
    }

    const normal = vec2.create();
    let penetrationPoint: Vec2;
    let overlap: number;

    if (distSq > 0) {
        // Standard case: circle center outside (or on edge) of AABB
        const dist = Math.sqrt(distSq);
        const invDist = 1 / dist;
        vec2.scale(diff, invDist, normal);

        overlap = r - dist;

        // Contact points on box face and circle rim projected along the normal
        const contactA = vec2.add(posA, closest);
        const contactB = vec2.addScaled(posB, normal, -r);
        penetrationPoint = vec2.scale(vec2.add(contactA, contactB), 0.5);
    } else {
        // Containment: circle center is inside the AABB (diff == 0)
        const dx = hx - Math.abs(local[0]);
        const dy = hy - Math.abs(local[1]);

        if (dx < dy) {
            normal[0] = local[0] >= 0 ? 1 : -1;
            overlap = dx + r;
            const contactA = vec2.fromValues(posA[0] + normal[0] * hx, posB[1]);
            const contactB = vec2.addScaled(posB, normal, -r);
            penetrationPoint = vec2.scale(vec2.add(contactA, contactB), 0.5);
        } else {
            normal[1] = local[1] >= 0 ? 1 : -1;
            overlap = dy + r;
            const contactA = vec2.fromValues(posB[0], posA[1] + normal[1] * hy);
            const contactB = vec2.addScaled(posB, normal, -r);
            penetrationPoint = vec2.scale(vec2.add(contactA, contactB), 0.5);
        }
    }

    if (flip) {
        vec2.negate(normal, normal);
    }

    const depth = overlap / 2;

    return {
        normal,
        depth,
        penetrationPoint,
    };
}
