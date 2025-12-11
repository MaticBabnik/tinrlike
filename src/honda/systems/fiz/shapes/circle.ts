import { vec4, type Vec2 } from "wgpu-matrix";
import type { IShape } from "./shape";
import type { AABox } from "../common";

export class CircleShape implements IShape {
    public readonly type = "circle";

    constructor(public radius: number) {}

    getBoundsInto(o: AABox, p: Vec2): AABox {
        o[0] = p[0] - this.radius;
        o[1] = p[1] - this.radius;
        o[2] = p[0] + this.radius;
        o[3] = p[1] + this.radius;
        return o;
    }

    getBounds(position: Vec2): AABox {
        return this.getBoundsInto(vec4.create(), position);
    }
}
