import type { Three } from "../util/types";
import { AlphaMode, MaterialType, Pass, type TEmpty } from "./material";

export type WireframeMaterialProps = {
    color: Three<number>;
};

/**
 * Unlit wireframe of the mesh's triangles in a flat `color`.
 *
 * Fixed render state: opaque, main pass only (doesn't occlude or cast shadows).
 */
export const WireframeMaterial = new MaterialType<WireframeMaterialProps, TEmpty>(
    "wireframe",
    {},
    {
        alphaMode: AlphaMode.Opaque,
        passes: Pass.Main,
        alphaClip: 0,
    },
);
