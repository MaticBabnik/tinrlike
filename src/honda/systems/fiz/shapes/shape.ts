import type { AABox, Vec2Like } from "../common";
import type { AABBShape } from "./aabb";
import type { CircleShape } from "./circle";
import type { BoxShape } from "./box";

export type ShapeType = "aabb" | "circle" | "box";

export interface IShape {
    type: ShapeType;

    getBounds(position: Vec2Like, angle?: number): AABox;
    getBoundsInto(out: AABox, position: Vec2Like, angle?: number): AABox;
}

export type TShape = AABBShape | CircleShape | BoxShape;
