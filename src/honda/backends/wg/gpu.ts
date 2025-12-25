import { nn } from "@/honda/util";

import { Limits } from "./limits";
import { getShaderSources } from "./shaders";
import type { IResizable, ITViewable } from "./texture";
import { createBindGroupLayouts } from "./bindGroupLayouts";
import type { Buffer, StructArrayBuffer, StructBuffer } from "./buffer";
import { DEFAULT_SETTINGS, type WGSettings } from "./gpuSettings";
import {
    GPUTexAddr,
    GPUTexFilter,
    GPUTexFormat,
    GPUTexShape,
    GPUTexUsage,
    type IGPUBuf,
    type IGPUBufDesc,
    type IGPUImplementation,
    type IGPUMat,
    type IGPUMatDesc,
    type IGPUTex,
    type IGPUTexData,
    type IGPUTexDataDesc,
    type IGPUTexDesc,
} from "@/honda/gpu2";
import { WGTexData, WGBuf, WGMat, WGTex } from "./resources";
import type { IPass } from "./passes";

export const enum WGStatus {
    Idle,
    Frame,
    Lost,
}

export class WGpu implements IGPUImplementation {
    private ro: ResizeObserver;

    public status: WGStatus = WGStatus.Idle;
    public destroyQueue: (GPUBuffer | GPUTexture)[] = [];

    public buffers: Record<string, Buffer | StructBuffer | StructArrayBuffer> =
        {};

    public canvasTex!: GPUTexture;
    public canvasTexture = {
        format: null! as GPUTextureFormat,
        view: null! as GPUTextureView,
        resized: true, // sej ni vazn

        width: 0,
        height: 0,
    } satisfies ITViewable;

    public pFormat = navigator.gpu.getPreferredCanvasFormat();

    public onError: ((err: GPUError | string) => void) | null = null;

    private viewPortTextures: IResizable[] = [];

    private _shaders = getShaderSources();
    public bindGroupLayouts: ReturnType<typeof createBindGroupLayouts>;
    private _queuedResize?: [number, number];
    public wasResized = false;
    public settings: WGSettings;
    public renderScale = 1;

    protected _aspectRatio = 0;
    protected querySet: GPUQuerySet;
    protected queryIndex = 0;
    protected queryBuffer: GPUBuffer;
    protected queryMapBuffer: GPUBuffer;
    protected wasQueryReady = false;
    protected timestampLabels: Record<number, string> = {};

    public cmdEncoder: GPUCommandEncoder = null!;

    public get viewportWidth() {
        return this.canvas.width;
    }

    public get viewportHeight() {
        return this.canvas.height;
    }

    public getShaderModule(key: string) {
        const s = nn(this._shaders[key]);

        if (!s.module) {
            s.module = this.device.createShaderModule({
                label: key,
                code: s.code,
            });
        }

        return s.module;
    }

    public getStruct(key: string, name: string) {
        const s = nn(this._shaders[key]);
        return nn(s.defs.structs[name]);
    }

    static async obtainForCanvas(
        settings: WGSettings,
        canvas: HTMLCanvasElement,
    ) {
        const adapter = nn(
            await navigator.gpu.requestAdapter({
                powerPreference: "high-performance",
            }),
            "Your browser doesn't support WebGPU",
        );
        const device = nn(
            await adapter.requestDevice({
                requiredFeatures: ["timestamp-query"],
            }),
            "Couldn't obtain WebGPU device",
        );
        const wg = nn(
            canvas.getContext("webgpu"),
            "Couldn't obtain WebGPU context",
        );

        canvas.width = document.body.clientWidth;
        canvas.height = document.body.clientHeight;

        wg.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
        });

        return new WGpu(settings, adapter, device, canvas, wg);
    }

    constructor(
        settings: Partial<WGSettings>,

        public readonly adapter: GPUAdapter,
        public device: GPUDevice,
        public readonly canvas: HTMLCanvasElement,
        public readonly ctx: GPUCanvasContext,
    ) {
        console.log(
            "%ctinrlike/Honda (WG)",
            "font-family: sans-serif; font-weight: bold; font-size: 2rem; color: #ffd6ffff; text-shadow: 0 0 10px #ff00ff; background-color: #3f003f; padding: 0.4rem 0.8rem; border-radius: 0.4rem",
        );
        console.log(
            `%cGPU: %c${adapter.info.description}`,
            "font-family: sans-serif; font-weight: bold; font-size: 1rem",
            "font-family: sans-serif; font-size: 1rem",
        );
        console.groupCollapsed("GPU Info");
        console.log("Prefered texture format:", this.pFormat);
        console.log(adapter.info);
        console.table(device.limits);
        console.groupEnd();

        this.settings = {
            ...DEFAULT_SETTINGS,
            ...settings,
        };
        this.bindGroupLayouts = createBindGroupLayouts(this);

        this.resizeViewports();
        this.ro = new ResizeObserver((e) => this.resizeCallback(e));

        this.querySet = device.createQuerySet({
            type: "timestamp",
            count: 2 * Limits.MAX_GPU_TIMESTAMPS,
        });
        this.queryBuffer = device.createBuffer({
            size: 8 * 2 * Limits.MAX_GPU_TIMESTAMPS,
            usage:
                GPUBufferUsage.QUERY_RESOLVE |
                GPUBufferUsage.STORAGE |
                GPUBufferUsage.COPY_SRC,
        });
        this.queryMapBuffer = device.createBuffer({
            label: "MapBuffer",
            size: 8 * 2 * Limits.MAX_GPU_TIMESTAMPS,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        this.renderScale = this.settings.renderScale;

        this.device.lost.then((x) => {
            this.onError?.("Lost device");
            console.error("lost device", x);
            device.destroy();
            this.device = null!; // cause device accesses to error out
        });

        const old = this.device.onuncapturederror;
        this.device.onuncapturederror = (err) => {
            old?.call(this.device, err);
            this.onError?.(`Lost device ${err.error.message}`);
            console.error("gpu error", err);
            device.destroy();
            this.device = null!;
        };

        // TODO: is this finally supported everywhere?
        this.ro.observe(canvas, { box: "device-pixel-content-box" });
        this.canvasTexture.format = this.ctx.getCurrentTexture().format;
    }

    public get aspectRatio() {
        return this._aspectRatio;
    }

    public addViewport(t: IResizable) {
        this.viewPortTextures.push(t);
    }

    public resizeViewports(override?: [number, number]) {
        const w = override?.[0] ?? this.canvas.width;
        const h = override?.[1] ?? this.canvas.height;
        this._aspectRatio = w / h;

        Object.values(this.viewPortTextures).forEach((t) => {
            t.resize(this.device, w, h);
        });
        this.wasResized = true;
    }

    private resize() {
        if (this._queuedResize) {
            this.canvas.width = this._queuedResize[0];
            this.canvas.height = this._queuedResize[1];
            this.resizeViewports();
            this._queuedResize = undefined;
        }
    }

    private resizeCallback([e]: ResizeObserverEntry[]) {
        this._queuedResize = [
            Math.round(
                nn(e.devicePixelContentBoxSize?.[0].inlineSize) *
                    this.renderScale,
            ) & ~1,
            Math.round(
                nn(e.devicePixelContentBoxSize?.[0].blockSize) *
                    this.renderScale,
            ) & ~1,
        ];
    }

    public startFrame() {
        this.status = WGStatus.Frame;
        this.resize();

        // Chrome seems to pass a "new?" frame every time, firefox reuses the same one
        const ntx = this.ctx.getCurrentTexture();
        if (this.canvasTex !== ntx) {
            this.canvasTex = ntx;
            this.canvasTexture.format = this.canvasTex.format;
            this.canvasTexture.view = this.canvasTex.createView({
                label: "canvasView",
            });
            this.canvasTexture.width = this.canvasTex.width;
            this.canvasTexture.height = this.canvasTex.height;
            this.canvasTexture.resized = true;
        }

        this.queryIndex = 0;
        this.wasQueryReady = this.queryMapBuffer.mapState === "unmapped";

        this.cmdEncoder = this.device.createCommandEncoder({
            label: "frame",
        });
    }

    private times = new BigInt64Array(2 * Limits.MAX_GPU_TIMESTAMPS);

    public async frameEnd() {
        this.cmdEncoder.resolveQuerySet(
            this.querySet,
            0,
            this.queryIndex,
            this.queryBuffer,
            0,
        );

        if (this.wasQueryReady) {
            const readBuf = this.queryMapBuffer;
            this.cmdEncoder.copyBufferToBuffer(
                this.queryBuffer,
                0,
                readBuf,
                0,
                this.queryBuffer.size,
            );

            this.device.queue.submit([this.cmdEncoder.finish()]);

            await readBuf.mapAsync(GPUMapMode.READ);

            const times = new BigInt64Array(readBuf.getMappedRange());
            this.times.set(times);
            readBuf.unmap();
        } else {
            this.device.queue.submit([this.cmdEncoder.finish()]);
        }

        this.viewPortTextures.forEach((t) => {
            t.resized = false;
        });

        if (this.destroyQueue.length > 0) {
            const q = this.destroyQueue;
            this.destroyQueue = [];
            this.device.queue.onSubmittedWorkDone().then(() => {
                q.forEach((r) => {
                    r.destroy();
                });
            });
        }
    }

    public get perf() {
        if (!this.wasQueryReady) return undefined;

        return {
            labels: this.timestampLabels,
            times: this.times,
            n: this.queryIndex >> 1,
        };
    }

    public safeDestroy(d: GPUBuffer | GPUTexture) {
        if (this.status === WGStatus.Frame) {
            this.destroyQueue.push(d);
        } else {
            d.destroy();
        }
    }

    public timestamp(label: string): GPURenderPassTimestampWrites | undefined {
        if (!this.wasQueryReady) return;
        if (this.queryIndex + 2 > Limits.MAX_GPU_TIMESTAMPS) {
            console.warn("Not enough space for timestamps");
            return;
        }

        this.timestampLabels[this.queryIndex >> 1] = label;

        return {
            querySet: this.querySet,
            beginningOfPassWriteIndex: this.queryIndex++,
            endOfPassWriteIndex: this.queryIndex++,
        } satisfies GPURenderPassTimestampWrites;
    }

    public createBuffer(d: IGPUBufDesc): IGPUBuf {
        return new WGBuf(this, d);
    }

    public createMaterial(d: IGPUMatDesc): IGPUMat {
        return new WGMat(this, d);
    }

    public createTexture(d: IGPUTexDesc, data: IGPUTexData): IGPUTex {
        return new WGTex(this, d, data);
    }

    public createTextureData(d: IGPUTexDataDesc): IGPUTexData {
        return new WGTexData(this, d);
    }

    public createTextureWithData(d: IGPUTexDesc & IGPUTexDataDesc): IGPUTex {
        const data = this.createTextureData(d);
        return this.createTexture(d, data);
    }

    private _defaultTexture: WGTex | null = null;

    public getDefaultTexture(): WGTex {
        if (this._defaultTexture) return this._defaultTexture;
        const td = new WGTexData(this, {
            label: "WgDefaultTextureData",
            format: GPUTexFormat.RGBA8UNORM,
            shape: GPUTexShape.T2D,
            size: [1, 1, 1],
            usage: GPUTexUsage.CopyDestination | GPUTexUsage.TextureBinding,
            mip: 1,
            viewFormats: [
                GPUTexFormat.RGBA8UNORM,
                GPUTexFormat.RGBA8UNORM_SRGB,
            ],
        });

        this.device.queue.writeTexture(
            { texture: td.texture },
            new Uint8Array([255, 255, 255, 255]),
            {
                bytesPerRow: 4,
                rowsPerImage: 1,
            },
            { width: 1, height: 1, depthOrArrayLayers: 1 },
        );

        this._defaultTexture = new WGTex(
            this,
            {
                label: "WgDefaultTexture",
                address: [
                    GPUTexAddr.Repeat,
                    GPUTexAddr.Repeat,
                    GPUTexAddr.Repeat,
                ],
                filterMag: GPUTexFilter.Nearest,
                filterMin: GPUTexFilter.Nearest,
                filterMip: GPUTexFilter.Nearest,
            },
            td,
        );

        // never .destroy()
        this._defaultTexture.rcUse();

        return this._defaultTexture;
    }

    protected _passes: IPass[] = [];

    public addPass(p: IPass) {
        this._passes.push(p);
    }

    public render() {
        for (const p of this._passes) {
            p.apply();
        }
    }
}
