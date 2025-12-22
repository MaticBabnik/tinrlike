import { GPUTexBase } from "../../../gpu2/base/textureBase";
import {
    GPUTexAddr,
    GPUTexFilter,
    type IGPUTex,
    type IGPUTexData,
    type IGPUTexDesc,
} from "../../../gpu2/interface";
import type { WGpu } from "../gpu";

const ADDRESS_MAP: Record<GPUTexAddr, GPUAddressMode> = {
    [GPUTexAddr.Clamp]: "clamp-to-edge",
    [GPUTexAddr.Repeat]: "repeat",
    [GPUTexAddr.Mirror]: "mirror-repeat",
};

const FILTER_MAP: Record<GPUTexFilter, GPUFilterMode> = {
    [GPUTexFilter.Nearest]: "nearest",
    [GPUTexFilter.Linear]: "linear",
};

export class WGTex extends GPUTexBase implements IGPUTex {
    public sampler: GPUSampler;

    public constructor(
        protected gpu: WGpu,
        d: IGPUTexDesc,
        data: IGPUTexData,
    ) {
        super(d, data);

        const minFilter = FILTER_MAP[this.filterMin],
            magFilter = FILTER_MAP[this.filterMag],
            mipmapFilter = FILTER_MAP[this.filterMip];

        let maxAnisotropy = gpu.settings.anisotropy;

        if (
            minFilter === "nearest" ||
            magFilter === "nearest" ||
            mipmapFilter === "nearest"
        ) {
            maxAnisotropy = 1;
        }

        this.sampler = gpu.device.createSampler({
            addressModeU: ADDRESS_MAP[this.address[0]],
            addressModeV: ADDRESS_MAP[this.address[1]],
            addressModeW: ADDRESS_MAP[this.address[2]],

            minFilter,
            magFilter,
            mipmapFilter,

            maxAnisotropy,
        });
    }
}
