import type { Three } from "../util/types";
import { AlphaMode, MaterialType, Pass, type TEmpty } from "./material";

export type FresnelMaterialProps = {
    color: Three<number>;
    power: number;
};

/**
 * Invisible surface that emits `color` on the fresnel term,
 * `power` sharpens the falloff towards the silhouette.
 *
 * Fixed render state: alpha blended, main pass only.
 */
export const FresnelMaterial = new MaterialType<FresnelMaterialProps, TEmpty>(
    "fresnel",
    {},
    {
        alphaMode: AlphaMode.AlphaBlend,
        passes: Pass.Main,
        alphaClip: 0,
    },
);
