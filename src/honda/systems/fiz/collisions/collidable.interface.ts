import type { Vec2 } from "wgpu-matrix";
import type { TShape } from "../shapes";

export interface ICollidable {
    shape: TShape;
    position: Vec2;
    angle: number;
}
