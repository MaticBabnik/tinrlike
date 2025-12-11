import type { IShape } from "./shape";

export { AABBShape } from "./aabb";
export { CircleShape } from "./circle";
export { BoxShape } from "./box";
export type { TShape, ShapeType } from "./shape";

/**
 * Util to test shape compatibility
 */
export type ShapeCast<TFrom extends IShape, TTo extends IShape> = Omit<
    TFrom,
    "type"
> & { type: TTo["type"] };
