import {
    GPUBufHint,
    type GPUBufUsage,
    type IGPUBuf,
    type IGPUBufDesc,
} from "../interface";
import { RefCntBase } from "./refCountBase";

function validateSize(size: number): number | never {
    if (size <= 0 || size !== ~~size) {
        throw new Error(`Buffer size must be a positive integer, got ${size}`);
    }

    return size;
}

export abstract class GPUBufBase extends RefCntBase implements IGPUBuf {
    public readonly label: string;
    public readonly hint: GPUBufHint;
    public readonly size: number;
    public readonly usage: GPUBufUsage;

    constructor(d: IGPUBufDesc) {
        super();
        this.size = validateSize(d.size);
        this.usage = d.usage;
        this.hint = d.hint ?? GPUBufHint.None;
        this.label = d.label ?? `buf(${this.size}B)`;
    }

    public abstract copyFrom(
        src: IGPUBuf,
        srcOffset: number,
        dstOffset: number,
        n: number,
    ): void;

    public abstract download(
        dst: BufferSource,
        offset: number,
        n: number,
    ): void;

    public abstract upload(src: BufferSource, offset: number, n: number): void;
}
