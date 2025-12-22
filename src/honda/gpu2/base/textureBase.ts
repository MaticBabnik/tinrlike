import {
    GPUTexFilter,
    GPUTexAddr,
    type IGPUTexData,
    type IGPUTex,
    type IGPUTexDesc,
    type Three,
} from "../interface";
import { RefCntBase } from "./refCountBase";

const DEFAULT_FILTER = GPUTexFilter.Linear;
const DEFAULT_ADDRESS = GPUTexAddr.Clamp;

export abstract class GPUTexBase extends RefCntBase implements IGPUTex {
    public readonly label: string;
    public readonly filterMin: GPUTexFilter;
    public readonly filterMag: GPUTexFilter;
    public readonly filterMip: GPUTexFilter;
    public readonly address: Three<GPUTexAddr>;

    constructor(
        d: IGPUTexDesc,
        public readonly data: IGPUTexData,
    ) {
        super();
        data.rcUse();

        this.label = d.label ?? `tex(${data.label})`;

        // assign filters/addressing
        this.filterMin = d.filterMin ?? DEFAULT_FILTER;
        this.filterMag = d.filterMag ?? DEFAULT_FILTER;
        this.filterMip = d.filterMip ?? DEFAULT_FILTER;
        this.address = d.address ?? [
            DEFAULT_ADDRESS,
            DEFAULT_ADDRESS,
            DEFAULT_ADDRESS,
        ];
    }

    protected _rcDestroy(): void {
        this.data.rcRelease();
    }
}
