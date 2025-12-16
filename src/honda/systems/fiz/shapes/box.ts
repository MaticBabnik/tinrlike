import { vec4 } from "wgpu-matrix";
import type { IShape } from "./shape";
import type { AABox, Vec2Like } from "../common";

const { sin, cos, abs } = Math;

export class BoxShape implements IShape {
    public readonly type = "box";

    constructor(
        public halfExtentX: number,
        public halfExtentY: number,
    ) {}

    getBoundsInto(o: AABox, p: Vec2Like, a?: number): AABox {
        a ??= 0;

        // rotate half extents
        const rheX =
            abs(this.halfExtentX * cos(a)) + abs(this.halfExtentY * sin(a));
        const rheY =
            abs(this.halfExtentX * sin(a)) + abs(this.halfExtentY * cos(a));

        o[0] = p[0] - rheX;
        o[1] = p[1] - rheY;
        o[2] = p[0] + rheX;
        o[3] = p[1] + rheY;
        return o;
    }

    getBounds(position: Vec2Like, rotation?: number): AABox {
        return this.getBoundsInto(vec4.create(), position, rotation);
    }
}
