import type { WebGpu } from "..";
import { createBloom } from "./bloom.pipeline";
import { createBlur } from "./blur.pipeline";
import { createIblIrradiance, createIblSpecular } from "./compute_ibl.pipeline";
import { createDebugline } from "./debugline.pipeline";
import { creatFlipx } from "./flipx.pipeline";
import { createG, createGNorm, createGSkin } from "./g.pipeline";
import { createPostProcess } from "./postprocess.pipeline";
import { createRgbmload } from "./rgbmload.pipeline";
import { createShade } from "./shade.pipeline";
import { createShadow } from "./shadow.pipeline";
import { createSky } from "./sky.pipeline";
import { createSprite } from "./sprite.pipeline";
import { createSSAO } from "./ssao.pipeline";

export function createPipelines(g: WebGpu) {
    return {
        g: createG(g),
        gSkin: createGSkin(g),
        gNorm: createGNorm(g),
        shadow: createShadow(g),
        post: createPostProcess(g),
        ssao: createSSAO(g),
        shade: createShade(g),
        sky: createSky(g),
        bloom: createBloom(g),
        blurRgbaF16: createBlur(g, "rgba16float"),
        blurR8u: createBlur(g, "r8unorm"),
        rgbmload: createRgbmload(g),
        cIblSpecular: createIblSpecular(g),
        bIblIrradiance: createIblIrradiance(g),
        flipx: creatFlipx(g),
        sprite: createSprite(g),
        debugline: createDebugline(g),
    };
}
