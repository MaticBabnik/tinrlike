import { assert, nn } from "@/honda/util";
import type { Two } from "@/honda/util/types";
import type { ITViewable } from "../texture";

// export interface IWGSurface {
//     readonly canvas: HTMLCanvasElement | OffscreenCanvas;
//     readonly format: GPUTextureFormat;

//     get width(): number;
//     get height(): number;
//     get aspectRatio(): number;

//     get dpr(): number;
//     get renderScale(): number;

//     get target(): ITViewable;

//     setRenderScale(n: number): void;
//     setDpr(n: number): void;

//     $applyQueuedResize(): boolean;
//     $acquire(): void;
//     $endFrame(): void;
//     $destroy(): void;
// }

export interface WGCanvasSurfaceOpts {
    dpr?: number;
    renderScale?: number;
}

class CanvasTarget implements ITViewable {
    public readonly label = "canvas";
    public tex: GPUTexture | null = null;
    public resized = false;
    public valid = false;

    private _view: GPUTextureView | null = null;

    public constructor(public format: GPUTextureFormat) {}

    public get width(): number {
        return this.tex?.width ?? 0;
    }

    public get height(): number {
        return this.tex?.height ?? 0;
    }

    public get view(): GPUTextureView {
        assert(this.valid, "canvas target used outside of a frame");
        return nn(this._view);
    }

    public set(tex: GPUTexture) {
        this.valid = true;
        if (tex === this.tex) return;

        // "resized" here means "view changed": Chrome hands out a new texture every frame
        this.tex = tex;
        this.format = tex.format;
        this._view = tex.createView({ label: "canvas" });
        this.resized = true;
    }

    public end() {
        this.valid = false;
        this.resized = false;
    }

    // we don't actually own any resources here
    public destroy() {}
}

export class WGCanvasSurface /* implements IWGSurface */ {
    public readonly format: GPUTextureFormat;

    private _dpr: number;
    private _renderScale: number;
    private _cssSize: Two<number>;
    private _queued: Two<number> | undefined;
    private _target: CanvasTarget;
    private _ro: ResizeObserver;

    public constructor(
        public readonly canvas: HTMLCanvasElement,
        protected readonly canvasCtx: GPUCanvasContext,
        opts: WGCanvasSurfaceOpts = {},
    ) {
        this.format = nn(
            canvasCtx.getConfiguration(),
            "canvas context is not configured",
        ).format;
        this._dpr = opts.dpr ?? devicePixelRatio;
        this._renderScale = opts.renderScale ?? 1;
        this._target = new CanvasTarget(this.format);

        this._cssSize = [canvas.clientWidth, canvas.clientHeight];
        this.queueResize();
        this.$applyQueuedResize();

        this._ro = new ResizeObserver(([e]) => {
            const box = e.contentBoxSize[0];
            this._cssSize = [box.inlineSize, box.blockSize];
            this.queueResize();
        });
        this._ro.observe(canvas);
    }

    public get width(): number {
        return this.canvas.width;
    }

    public get height(): number {
        return this.canvas.height;
    }

    public get aspectRatio(): number {
        return this.canvas.width / this.canvas.height;
    }

    public get dpr(): number {
        return this._dpr;
    }

    public get renderScale(): number {
        return this._renderScale;
    }

    public get target(): ITViewable {
        return this._target;
    }

    public setRenderScale(n: number): void {
        if (n === this._renderScale) return;
        this._renderScale = n;
        this.queueResize();
    }

    public setDpr(n: number): void {
        if (n === this._dpr) return;
        this._dpr = n;
        this.queueResize();
    }

    public $applyQueuedResize(): boolean {
        if (!this._queued) return false;

        [this.canvas.width, this.canvas.height] = this._queued;
        this._queued = undefined;
        return true;
    }

    public $acquire(): void {
        this._target.set(this.canvasCtx.getCurrentTexture());
    }

    public $endFrame(): void {
        this._target.end();
    }

    public $destroy(): void {
        this._ro.disconnect();
    }

    private queueResize() {
        const w = this.dim(this._cssSize[0]);
        const h = this.dim(this._cssSize[1]);

        const changed = w !== this.canvas.width || h !== this.canvas.height;
        this._queued = changed ? [w, h] : undefined;
    }

    /**
     * Calculates the raw pixel size of a canvas from css pixels.
     * Applies DPR (OS/browser scaling) and renderScale (engine scaling)
     * @param css size in css pixels
     */
    private dim(css: number): number {
        return Math.max(
            2,
            Math.round(css * this._dpr * this._renderScale) & ~1,
        );
    }
}
