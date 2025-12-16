import { nn } from "../util";
import { Game } from "../state";
import { Limits } from "../limits";
import { createModules } from "./shaders";
import { createPipelines } from "./pipelines";
import {
    ViewportPingPongTexture,
    ViewportTexture,
    ShadowMapTexture,
    type CubemapTexture,
} from "./textures";
import { createBindGroupLayouts } from "./bindGroupLayouts";
import { setError } from "../util/status";

export class WebGpu {
    private ro: ResizeObserver;

    public textures = {
        base: new ViewportTexture("rgba8unorm-srgb", 1, "g-base"),
        normal: new ViewportTexture("rgba8unorm", 1, "g-normal"),
        mtlRgh: new ViewportTexture("rg8unorm", 1, "g-metal-rough"),
        emission: new ViewportTexture("rgba8unorm", 1, "g-emission"),
        depth: new ViewportTexture("depth24plus", 1, "g-depth"),
        ssao: new ViewportPingPongTexture("r8unorm", 1, "ssao"),
        shaded: new ViewportTexture("rgba16float", 1, "shaded"),
        bloom: new ViewportPingPongTexture("rgba16float", 1, "bloom"),
    };

    public sky!: CubemapTexture;
    public env?: CubemapTexture;

    public shadowmaps = new ShadowMapTexture(
        Limits.MAX_SHADOWMAPS,
        Game.flags.has("shadowLow") ? 512 : 2048,
        "shadowmaps",
    );

    public canvasTexture!: GPUTexture;
    public canvasView!: GPUTextureView;

    public pFormat = navigator.gpu.getPreferredCanvasFormat();
    public shaderModules: ReturnType<typeof createModules>;
    public bindGroupLayouts: ReturnType<typeof createBindGroupLayouts>;
    public pipelines: ReturnType<typeof createPipelines>;
    private _queuedResize?: [number, number];
    public wasResized = false;

    public renderScale = 1;

    protected gpuSamplerMap: Record<string, GPUSampler> = {};
    protected _aspectRatio = 0;
    protected querySet: GPUQuerySet;
    protected queryIndex = 0;
    protected queryBuffer: GPUBuffer;
    protected queryMapBuffer: GPUBuffer;
    protected wasQueryReady = false;
    protected timestampLabels: Record<number, string> = {};

    static async obtainForCanvas(canvas: HTMLCanvasElement) {
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

        return new WebGpu(adapter, device, canvas, wg);
    }

    constructor(
        public readonly adapter: GPUAdapter,
        public device: GPUDevice,
        public readonly canvas: HTMLCanvasElement,
        public readonly ctx: GPUCanvasContext,
    ) {
        console.log(
            "%ctinrlike/Honda (WebGPU)",
            "font-family: sans-serif; font-weight: bold; font-size: 2rem; color: white; background-color: magenta; padding: 0.2rem 0.4rem; border-radius: 0.2rem",
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

        this.shaderModules = createModules(this);
        this.bindGroupLayouts = createBindGroupLayouts(this);
        this.pipelines = createPipelines(this);

        this.resizeViewports();
        this.shadowmaps.alloc(this.device);
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

        this.renderScale = Game.flags.has("rsHalf") ? 0.5 : 1;

        this.device.lost.then((x) => {
            setError("Lost device");
            console.error("lost device", x);
            device.destroy();
            // biome-ignore lint/style/noNonNullAssertion: We want to break stuff on purpose
            this.device = null!; // cause device accesses to error out
        });

        const old = this.device.onuncapturederror;
        this.device.onuncapturederror = (err) => {
            old?.call(this.device, err);
            setError(`Lost device ${err.error.message}`);
            console.error("gpu error", err);
            device.destroy();
            // biome-ignore lint/style/noNonNullAssertion: We want to break stuff on purpose
            this.device = null!;
        };

        /*
            FIXME:  Safari (matter reference) doesn't support this.
            TODO:   a lah nekdo figure-a out ta scaling,
                    basically hocmo hittat native res 
                    (think about retina, scaling)
        */
        this.ro.observe(canvas, { box: "device-pixel-content-box" });
    }

    public get aspectRatio() {
        return this._aspectRatio;
    }

    public resizeViewports(override?: [number, number]) {
        const w = override?.[0] ?? this.canvas.width;
        const h = override?.[1] ?? this.canvas.height;
        this._aspectRatio = w / h;

        Object.values(this.textures).forEach((t) => {
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

    public frameStart() {
        this.resize();

        // Chrome seems to pass a "new?" frame every time, firefox reuses the same one
        if (this.canvasTexture !== this.ctx.getCurrentTexture()) {
            this.canvasTexture = this.ctx.getCurrentTexture();
            this.canvasView = this.canvasTexture.createView({
                label: "canvasView",
            });
        }

        this.queryIndex = 0;
        this.wasQueryReady = this.queryMapBuffer.mapState === "unmapped";
    }

    /**
     * This used to be called pushQueue (it does push the queue),
     * it got renamed it to end Frame because:
     *  - we aim for a single queue push per frame
     *  - gpu timing code assumes we do everything in one queue push
     */
    public async endFrame() {
        Game.cmdEncoder.resolveQuerySet(
            this.querySet,
            0,
            this.queryIndex,
            this.queryBuffer,
            0,
        );

        if (this.wasQueryReady) {
            const readBuf = this.queryMapBuffer;
            Game.cmdEncoder.copyBufferToBuffer(
                this.queryBuffer,
                0,
                readBuf,
                0,
                this.queryBuffer.size,
            );

            this.device.queue.submit([Game.cmdEncoder.finish()]);

            await readBuf.mapAsync(GPUMapMode.READ);

            const times = new BigInt64Array(readBuf.getMappedRange());
            Game.perf.sumbitGpuTimestamps(
                this.timestampLabels,
                times,
                this.queryIndex >> 1,
            );
            readBuf.unmap();
        } else {
            this.device.queue.submit([Game.cmdEncoder.finish()]);
        }
        Game.cmdEncoder = this.device.createCommandEncoder();
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

    /**
     * Gets & caches a sampler; forces anisotropy when possible
     */
    public getSampler(d: GPUSamplerDescriptor) {
        const key = Object.entries(d)
            .sort(([a], [b]) => a.localeCompare(b))
            .map((x) => x.join(":"))
            .join(",");

        let h = this.gpuSamplerMap[key];
        if (h) return h;

        this.gpuSamplerMap[key] = h = this.device.createSampler({
            maxAnisotropy:
                d.minFilter === "linear" && d.mipmapFilter === "linear" ? 4 : 1,
            ...d,
        });
        return h;
    }
}
