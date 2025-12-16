import { vec4 } from "wgpu-matrix";
import type { IShape } from "./shape";
import type { AABox, Vec2Like } from "../common";

export class AABBShape implements IShape {
    public readonly type = "aabb";

    constructor(
        public halfExtentX: number,
        public halfExtentY: number,
    ) {}

    getBoundsInto(out: AABox, position: Vec2Like): AABox {
        out[0] = position[0] - this.halfExtentX;
        out[1] = position[1] - this.halfExtentY;
        out[2] = position[0] + this.halfExtentX;
        out[3] = position[1] + this.halfExtentY;
        return out;
    }

    getBounds(position: Vec2Like): AABox {
        return this.getBoundsInto(vec4.create(), position);
    }
}
