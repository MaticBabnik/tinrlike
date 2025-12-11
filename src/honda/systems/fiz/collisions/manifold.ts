import type { Vec2 } from "wgpu-matrix";

export interface CollisionManifold {
    /**
     * Penetration normal vector
     */
    normal: Vec2;

    /**
     * Penetration depth
     */
    depth: number;

    /**
     * World space penetration point
     */
    penetrationPoint: Vec2;
}
