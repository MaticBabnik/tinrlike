import {
    type IGPUBufDesc,
    type IGPUTexDesc,
    type IGPUTexData,
    type IGPUTexDataDesc,
    GPUTexFormat,
    GPUTexShape,
    GPUTexUsage,
    GPUTexAddr,
    GPUTexFilter,
} from "@/honda/gpu2";
import { WGBuf, type WGSampler, WGTex, WGTexData } from "../resources";
import { WGSamplerCache } from "./samplerCache";

export interface IWGResourceContainer {
    device: GPUDevice;
    get cmdEncoder(): GPUCommandEncoder;
    safeDestroy(d: GPUBuffer | GPUTexture): void;
    getSampler(d: IGPUTexDesc): WGSampler;
    get defaultTexture(): WGTex;
}

type Destroyable = GPUBuffer | GPUTexture;

export interface IWGEncoderSource {
    get encoder(): GPUCommandEncoder;
}

export class WGCResources implements IWGResourceContainer {
    protected _destroySafe = true;
    protected _destroyQueue: Destroyable[] = [];
    protected _dtex: WGTex;
    public readonly samplerCache: WGSamplerCache;

    public constructor(
        public device: GPUDevice,
        anisotropy: number,
        protected readonly encoderSource: IWGEncoderSource,
    ) {
        this.samplerCache = new WGSamplerCache(device, anisotropy);

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
        
        this._dtex = new WGTex(
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

        // maku sure they don't get freed
        td.rcUse();
        this._dtex.rcUse();
    }

    public $frameStart() {
        this._destroySafe = false;
    }

    public $frameEnd() {
        this._destroySafe = true;

        if (this._destroyQueue.length) {
            for (const td of this._destroyQueue) {
                td.destroy();
            }
            this._destroyQueue.length = 0;
        }
    }

    public get cmdEncoder(): GPUCommandEncoder {
        return this.encoderSource.encoder;
    }

    public createBuffer(d: IGPUBufDesc): WGBuf {
        return new WGBuf(this, d);
    }

    public createTexture(d: IGPUTexDesc, data: IGPUTexData): WGTex {
        return new WGTex(this, d, data);
    }

    public createTextureData(d: IGPUTexDataDesc): WGTexData {
        return new WGTexData(this, d);
    }

    public getSampler(d: IGPUTexDesc): WGSampler {
        return this.samplerCache.get(d);
    }

    public get defaultTexture(): WGTex {
        return this._dtex;
    }

    public safeDestroy(d: GPUBuffer | GPUTexture) {
        if (this._destroySafe) {
            d.destroy();
        } else {
            this._destroyQueue.push(d);
        }
    }
}
