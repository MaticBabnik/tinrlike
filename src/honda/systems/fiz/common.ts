import type { Vec2, Vec4 } from "wgpu-matrix";

/**
 * Axis-Aligned Bounding Box
 * [minX, minY, maxX, maxY]
 */
export type AABox = Vec4;

export type Vec2Like = [number, number] | Vec2;
