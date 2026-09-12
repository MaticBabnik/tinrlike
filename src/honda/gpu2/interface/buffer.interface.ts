import type { GPUBufHint, GPUBufUsage } from "./enums";
import type { IRefCnt } from "../../util/managedResource";

export interface IGPUBufDesc {
    label?: string;

    size: number;
    usage: GPUBufUsage;
    hint?: GPUBufHint;
}

export interface IGPUBuf extends IRefCnt, Readonly<Required<IGPUBufDesc>> {
    upload(src: BufferSource, offset: number, n: number): void;
    download(dst: BufferSource, offset: number, n: number): void;
    copyFrom(
        src: IGPUBuf,
        srcOffset: number,
        dstOffset: number,
        n: number,
    ): void;
}
