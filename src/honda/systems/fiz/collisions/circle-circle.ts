import { vec2, type Vec2 } from "wgpu-matrix";
import type { CollisionManifold } from "./manifold";
import type { CircleShape } from "../shapes";

export function circleVsCircle(
    posA: Vec2,
    shapeA: CircleShape,
    posB: Vec2,
    shapeB: CircleShape,
    flip: boolean = false,
): CollisionManifold | null {
    const delta = vec2.sub(posB, posA);
    const radiusSum = shapeA.radius + shapeB.radius;
    const distSq = vec2.dot(delta, delta);

    if (distSq >= radiusSum * radiusSum) {
        return null;
    }

    const dist = Math.sqrt(distSq);
    const normal = vec2.create();

    if (dist > 0) {
        const invDist = (flip ? -1 : 1) / dist;
        vec2.scale(delta, invDist, normal);
    } else {
        // Identical centers; pick a stable normal
        normal[0] = flip ? -1 : 1;
        normal[1] = 0;
    }

    const depth = (radiusSum - dist) / 2;

    const contactA = vec2.addScaled(posA, normal, shapeA.radius);
    const contactB = vec2.addScaled(posB, normal, -shapeB.radius);
    const penetrationPoint = vec2.scale(vec2.add(contactA, contactB), 0.5);

    return {
        normal,
        depth,
        penetrationPoint,
    };
}
