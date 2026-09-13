import type { WGFeature } from "../utils";
import type {
    IWGRenderPipeline,
    IWGRPFactory,
} from "../rp/common/rp.interface";
import { WGTimestamps, type WGPerfData } from "./timestamps";
import { WGCanvasSurface } from "./surface";
import { WGStatus } from "./types";
import { Limits } from "../limits";
import { nn } from "@/honda/util";
import { WGCResources } from "./resources";
import type { IPass } from "../rp/common/passes/pass.interface";
import type { IResizable } from "../texture";
import type {
    IGPUBufDesc,
    IGPUImplementation,
    IGPUTexData,
    IGPUTexDataDesc,
    IGPUTexDesc,
} from "@/honda/gpu2";
import type { WGBuf, WGTex, WGTexData } from "../resources";
import type { AnyMatType, Material } from "@/honda/gpu2/material";

export interface WGCObtain {
    anisotropy?: 1 | 4 | 8 | 16;
    renderScale?: number;
    dpr?: number;

    canvas: HTMLCanvasElement;
    featuresRequired?: WGFeature[];
    featuresOptional?: WGFeature[];
    disableTimestamps?: boolean;
    preferredFormat?: GPUTextureFormat;
}

interface WGCCreate {
    anisotropy: 1 | 4 | 8 | 16;
    dpr: number;
    renderScale: number;

    preferredFormat: GPUTextureFormat;
    timestampsEnabled: boolean;

    adapter: GPUAdapter;
    canvas: HTMLCanvasElement;
    context: GPUCanvasContext;
    device: GPUDevice;
}

function getAdapterString(a: GPUAdapterInfo): string {
    if (a.description) return a.description;
    if (a.vendor && a.architecture) return `${a.vendor} ${a.architecture}`;
    if (a.vendor) return `${a.vendor} unknown`;
    if (a.architecture) return a.architecture;
    if (a.device) return a.device;
    return "Unknown GPU";
}

function passString(p: IPass) {
    return p.describe?.() ?? p.constructor.name;
}

function vpstr(v: IResizable) {
    return `${v.label ?? "???"}:${v.width}x${v.height}:${v.format}`;
}

export class WGpuComposite implements IGPUImplementation {
    public readonly surface: WGCanvasSurface;
    public readonly resources: WGCResources;
    public readonly timestamps: WGTimestamps | undefined;
    public readonly device: GPUDevice;
    public readonly adapterString: string;
    public readonly adapter: GPUAdapter;

    protected _status: WGStatus = WGStatus.Idle;
    protected _frame: number = 0;
    protected _frameEncoder?: GPUCommandEncoder;
    protected _tmpEncoder?: GPUCommandEncoder;
    protected _renderPipeline: IWGRenderPipeline;
    protected _switchRp?: [IWGRPFactory, boolean];

    protected constructor(create: WGCCreate) {
        this.device = create.device;
        this.adapter = create.adapter;
        this.adapterString = getAdapterString(this.adapter.info);
        this.surface = new WGCanvasSurface(create.canvas, create.context, {
            dpr: create.dpr,
            renderScale: create.renderScale,
        });
        this.resources = new WGCResources(this.device, create.anisotropy, this);

        if (create.timestampsEnabled) {
            this.timestamps = new WGTimestamps(
                this.device,
                Limits.MAX_GPU_TIMESTAMPS,
            );
        }

        this.device.addEventListener("uncapturederror", (e) =>
            this.onError?.(e.error),
        );
        this.device.lost.then((x) => {
            this._status = WGStatus.Lost;
            this.onLost?.(x);
        });

        this._renderPipeline = {
            id: "none",
            description: "",
            passes: [],
            viewports: new Set(),
            frame() {},
            destroy() {},
            wg: this,
        };
    }

    public hasFeature(f: WGFeature): boolean {
        return this.device.features.has(f);
    }

    public get status(): WGStatus {
        return this._status;
    }

    public get frameNo(): number {
        return this._frame;
    }

    public get encoder(): GPUCommandEncoder {
        if (this._frameEncoder) return this._frameEncoder;

        if (this._tmpEncoder) return this._tmpEncoder;

        this._tmpEncoder = this.device.createCommandEncoder({});

        return this._tmpEncoder;
    }

    public flushEncoder(): void {
        if (this._tmpEncoder) {
            this.device.queue.submit([this._tmpEncoder.finish()]);
            this._tmpEncoder = undefined;
        }
    }

    public timestamp(label: string): GPURenderPassTimestampWrites | undefined {
        if (this._status !== WGStatus.Frame) return undefined;
        return this.timestamps?.$alloc(label);
    }

    public get rp(): IWGRenderPipeline {
        return this._renderPipeline;
    }

    public $switchRpImmed(factory: IWGRPFactory, printSwitch = false) {
        this._renderPipeline.destroy();

        if (typeof factory === "object") {
            this._renderPipeline = factory.create(this);
        } else {
            this._renderPipeline = factory(this);
        }

        this.resizeViewports();

        if (printSwitch) {
            const rp = this._renderPipeline;

            console.log(
                `Pipeline switched to: ${rp.id}\n${rp.description}`
            );
        }
    }

    public switchRp(factory: IWGRPFactory, printSwitch: boolean = false): void {
        this._switchRp = [factory, printSwitch];
    }

    public onLost?: (info: GPUDeviceLostInfo) => void;
    public onError?: (err: GPUError) => void;

    public get perf(): WGPerfData | undefined {
        return this.timestamps?.perf;
    }

    protected resizeViewports() {
        for (const vp of this._renderPipeline.viewports) {
            vp.resize(this.device, this.surface.width, this.surface.height);
        }
    }

    protected frameStart() {
        this.flushEncoder();

        const resized = this.surface.$applyQueuedResize();

        if (this._switchRp) {
            this.$switchRpImmed(...this._switchRp);
            this._switchRp = undefined;
        } else if (resized) {
            this.resizeViewports();
        }

        this.surface.$acquire();
        this.timestamps?.$begin();
        this._frameEncoder = this.device.createCommandEncoder({});
        this.resources.$frameStart();

        this._status = WGStatus.Frame;
    }

    protected frameEnd() {
        const enc = this._frameEncoder!;
        this.timestamps?.$resolve(enc);
        this.device.queue.submit([enc.finish()]);
        this._frameEncoder = undefined;
        this.timestamps?.$readback();

        this.resources.$frameEnd();
        this.surface.$endFrame();
        this.rp.viewports.forEach((x) => {
            x.resized = false;
        });

        this._status = WGStatus.Idle;
        this._frame++;
    }

    public frame() {
        if (this._status !== WGStatus.Idle) return;

        this.frameStart();
        this.rp.frame();
        this.frameEnd();
    }

    public get viewportWidth(): number {
        return this.surface.width;
    }
    public get viewportHeight(): number {
        return this.surface.height;
    }
    public get aspectRatio(): number {
        return this.surface.aspectRatio;
    }
    public createTextureData(d: IGPUTexDataDesc): WGTexData {
        return this.resources.createTextureData(d);
    }

    public createTexture(d: IGPUTexDesc, data: IGPUTexData): WGTex {
        return this.resources.createTexture(d, data);
    }

    public createTextureWithData(d: IGPUTexDesc & IGPUTexDataDesc): WGTex {
        const data = this.resources.createTextureData(d);
        return this.resources.createTexture(d, data);
    }

    public createBuffer(d: IGPUBufDesc): WGBuf {
        return this.resources.createBuffer(d);
    }

    // material backend data belongs to the render pipeline
    public $allocMaterial<T extends AnyMatType>(m: Material<T>): void {
        this._renderPipeline.$allocMaterial?.(m);
    }

    public $freeMaterial<T extends AnyMatType>(m: Material<T>): void {
        this._renderPipeline.$freeMaterial?.(m);
    }

    public static async obtain(opt: WGCObtain) {
        const adapter = nn(
            await navigator.gpu.requestAdapter({
                powerPreference: "high-performance",
            }),
            "Your browser doesn't support WebGPU",
        );

        const featuresOptional = opt.featuresOptional ?? [];

        if (!opt.disableTimestamps) {
            featuresOptional.push("timestamp-query");
        }

        const availableOptionals = featuresOptional.filter((f) =>
            adapter.features.has(f),
        ) as GPUFeatureName[];

        const required = (opt.featuresRequired ?? []) as GPUFeatureName[];

        const device = nn(
            await adapter.requestDevice({
                requiredFeatures: [...required, ...availableOptionals],
            }),
            "Couldn't obtain WebGPU device",
        );

        const context = nn(
            opt.canvas.getContext("webgpu"),
            "Couldn't obtain WebGPU context",
        );

        const preferredFormat =
            opt.preferredFormat ?? navigator.gpu.getPreferredCanvasFormat();

        context.configure({
            device,
            format: preferredFormat,
            alphaMode: "opaque",
        });

        return new WGpuComposite({
            anisotropy: opt.anisotropy ?? 4,
            dpr: opt.dpr ?? window.devicePixelRatio,
            renderScale: opt.renderScale ?? 1,

            preferredFormat,
            timestampsEnabled:
                device.features.has("timestamp-query") &&
                !opt.disableTimestamps,

            adapter,
            canvas: opt.canvas,
            context,
            device,
        });
    }
}
