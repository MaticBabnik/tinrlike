import { GPUTexAddr, GPUTexFilter, type IGPUTexDesc } from "@/honda/gpu2";
import { WGSampler } from "../resources";

import { DEFAULT_ADDRESS, DEFAULT_FILTER } from "@/honda/gpu2/base/textureBase";

const ADDRESS_MAP: Record<GPUTexAddr, GPUAddressMode> = {
    [GPUTexAddr.Clamp]: "clamp-to-edge",
    [GPUTexAddr.Repeat]: "repeat",
    [GPUTexAddr.Mirror]: "mirror-repeat",
};

const FILTER_MAP: Record<GPUTexFilter, GPUFilterMode> = {
    [GPUTexFilter.Nearest]: "nearest",
    [GPUTexFilter.Linear]: "linear",
};

export class WGSamplerCache {
    protected _version = 0;
    protected samplers = new Map<number, WGSampler>();

    protected static samplerKey(d: IGPUTexDesc): number {
        return (
            ((d.address?.[0] ?? DEFAULT_ADDRESS) << 0) |
            ((d.address?.[1] ?? DEFAULT_ADDRESS) << 2) |
            ((d.address?.[2] ?? DEFAULT_ADDRESS) << 4) |
            ((d.filterMag ?? DEFAULT_FILTER) << 6) |
            ((d.filterMin ?? DEFAULT_FILTER) << 7) |
            ((d.filterMip ?? DEFAULT_FILTER) << 8)
        );
    }

    public constructor(
        protected readonly device: GPUDevice,
        protected _anisotropy: number,
    ) {}

    public get anisotropy(): number {
        return this._anisotropy;
    }

    public get version(): number {
        return this._version;
    }

    public setAnisotropy(n: 1 | 4 | 8 | 16): void {
        if (n === this._anisotropy) return;
        this._anisotropy = n;
        this._version++;
        this.updateSamplers();
    }

    protected updateSamplers() {
        for (const v of this.samplers.values()) {
            v.$descriptor.maxAnisotropy = v.supportsAnisotropy
                ? this._anisotropy
                : 1;
            v.sampler = this.device.createSampler(v.$descriptor);
            v.version = this._version;
        }
    }

    public get(d: IGPUTexDesc): WGSampler {
        const key = WGSamplerCache.samplerKey(d);

        return this.samplers.getOrInsertComputed(key, () => {
            const wd: GPUSamplerDescriptor = {
                label: `${key}`,
                addressModeU: ADDRESS_MAP[d.address?.[0] ?? DEFAULT_ADDRESS],
                addressModeV: ADDRESS_MAP[d.address?.[1] ?? DEFAULT_ADDRESS],
                addressModeW: ADDRESS_MAP[d.address?.[2] ?? DEFAULT_ADDRESS],

                minFilter: FILTER_MAP[d.filterMin ?? DEFAULT_FILTER],
                magFilter: FILTER_MAP[d.filterMag ?? DEFAULT_FILTER],
                mipmapFilter: FILTER_MAP[d.filterMip ?? DEFAULT_FILTER],

            };

            const linear =
                wd.minFilter === "linear" &&
                wd.magFilter === "linear" &&
                wd.mipmapFilter === "linear";
            wd.maxAnisotropy = linear ? this._anisotropy : 1;

            return new WGSampler(
                this.device.createSampler(wd),
                wd,
                this._version,
            );
        });
    }
}
