import type { IGPUBuf, IGPUBufDesc } from "./buffer.interface";
import type { IGPUTex, IGPUTexDesc } from "./texture.interface";
import type { IGPUTexData, IGPUTexDataDesc } from "./textureData.interface";

import type { Material } from "../material/index";
import type { AnyMatType } from "../material/materialType";

export interface IGPUResourceLayer {
    createTextureData(d: IGPUTexDataDesc): IGPUTexData;

    createTexture(d: IGPUTexDesc, data: IGPUTexData): IGPUTex;

    createTextureWithData(d: IGPUTexDesc & IGPUTexDataDesc): IGPUTex;

    createBuffer(d: IGPUBufDesc): IGPUBuf;

    $allocMaterial<T extends AnyMatType>(m: Material<T>): void;

    $freeMaterial<T extends AnyMatType>(m: Material<T>): void;
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
export interface IGPUImplementation extends IGPUResourceLayer, IGPUViewportLayer, IGPULifecycleLayer {}
