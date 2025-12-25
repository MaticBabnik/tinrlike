import type { GPUTexFormat, GPUTexShape, GPUTexUsage } from "./enums";
import type { IRefCnt } from "./rc.interface";
import type { Three } from "@/honda";

export interface IGPUTexDataDesc {
    shape: GPUTexShape;
    size: Three<number>;

    format: GPUTexFormat;
    viewFormats?: GPUTexFormat[];
    usage: GPUTexUsage;

    mip?: boolean | number;

    label?: string;
}

export interface IGPUTexData
    extends IRefCnt,
        Readonly<Required<Omit<IGPUTexDataDesc, "mip">>> {
    readonly mip: number;

    uploadExternImage(
        image: ImageBitmap,
        //TODO: add options!
    ): void;

    doMips(): void;
}
