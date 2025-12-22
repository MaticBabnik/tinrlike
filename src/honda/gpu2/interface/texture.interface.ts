import type {
    GPUTexAddr,
    GPUTexFilter,
} from "./enums";
import type { IRefCnt } from "./rc.interface";
import type { IGPUTexData } from "./textureData.interface";
import type { Three } from "./types";

export interface IGPUTexDesc {
    label?: string;
    address?: Three<GPUTexAddr>;

    filterMin?: GPUTexFilter;
    filterMag?: GPUTexFilter;
    filterMip?: GPUTexFilter;
}

export interface IGPUTex extends IRefCnt, Readonly<Required<IGPUTexDesc>> {
    get data(): IGPUTexData;

    // TODO: load and copy?
    // TODO: generateMips()
}
