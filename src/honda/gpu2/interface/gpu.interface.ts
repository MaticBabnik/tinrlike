import type { IGPUBuf, IGPUBufDesc } from "./buffer.interface";
import type { IGPUMat, IGPUMatDesc } from "./material.interface";
import type { IGPUTex, IGPUTexDesc } from "./texture.interface";
import type { IGPUTexData, IGPUTexDataDesc } from "./textureData.interface";

/**
 * Game's view of the GPU implementation.
 * This is used to abstract away the underlying GPU API (WebGPU, WebGL, etc.)
 * from the rest of the engine.
 *
 * It can be for example implemented as a no-op.
 */
export interface IGPUImplementation {
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

    createTextureData(d: IGPUTexDataDesc): IGPUTexData;

    createTexture(d: IGPUTexDesc, data: IGPUTexData): IGPUTex;

    createTextureWithData(d: IGPUTexDesc & IGPUTexDataDesc): IGPUTex;

    createBuffer(d: IGPUBufDesc): IGPUBuf;

    createMaterial(d: IGPUMatDesc): IGPUMat;

    /**
     * Call at the start of each frame.
     *
     * Should set up everything required for GPU operations to be valid.
     */
    startFrame(): void;

    /**
     * Perform all rendering operations.
     */
    render(): void;

    /**
     * ends the current frame,
     * submits commands,
     * then cleans up deleted resources.
     */
    frameEnd(): Promise<void>;
}
