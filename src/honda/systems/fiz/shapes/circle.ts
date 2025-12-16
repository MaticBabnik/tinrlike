import { vec4 } from "wgpu-matrix";
import type { IShape } from "./shape";
import type { AABox, Vec2Like } from "../common";

export class CircleShape implements IShape {
    public readonly type = "circle";

    constructor(public radius: number) {}

    getBoundsInto(o: AABox, p: Vec2Like): AABox {
        o[0] = p[0] - this.radius;
        o[1] = p[1] - this.radius;
        o[2] = p[0] + this.radius;
        o[3] = p[1] + this.radius;
        return o;
    }

    getBounds(position: Vec2Like): AABox {
        return this.getBoundsInto(vec4.create(), position);
    }
}
