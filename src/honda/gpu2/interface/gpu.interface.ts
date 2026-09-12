import type { IGPUBuf, IGPUBufDesc } from "./buffer.interface";
import type { IGPUMat, IGPUMatDesc } from "./material.interface";
import type { IGPUTex, IGPUTexDesc } from "./texture.interface";
import type { IGPUTexData, IGPUTexDataDesc } from "./textureData.interface";

import type { Material as MV2 } from "../material/index";
import type { AnyMatType } from "../material/materialType";

export interface IGPUResourceLayer {
    createTextureData(d: IGPUTexDataDesc): IGPUTexData;

    createTexture(d: IGPUTexDesc, data: IGPUTexData): IGPUTex;

    createTextureWithData(d: IGPUTexDesc & IGPUTexDataDesc): IGPUTex;

    createBuffer(d: IGPUBufDesc): IGPUBuf;

    createMaterial(d: IGPUMatDesc): IGPUMat;

    $allocMaterial<T extends AnyMatType>(mv2: MV2<T>): void;

    $freeMaterial<T extends AnyMatType>(mv2: MV2<T>): void;
}

export interface IGPUViewportLayer {
    /**
     * The width of the viewport in pixels.
     */
    get viewportWidth(): number;

    /**
     * The height of the viewport in pixels.
     */
    get viewportHeight(): number;

    /**
     * The aspect ratio of the viewport (width / height).
     */
    get aspectRatio(): number;
}

export interface IGPULifecycleLayer {
    frame(): void;
}

/**
 * Game's view of the GPU implementation.
 * This is used to abstract away the underlying GPU API (WebGPU, WebGL, etc.)
 * from the rest of the engine.
 *
 * It can be for example implemented as a no-op.
 */
export interface IGPUImplementation
    extends IGPUResourceLayer, IGPUViewportLayer, IGPULifecycleLayer {}
