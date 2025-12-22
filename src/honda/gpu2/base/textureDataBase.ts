import { nMips } from "../common/utils";
import { type GPUTexFormat, GPUTexShape, type GPUTexUsage, type Three } from "../interface";
import type {
    IGPUTexData,
    IGPUTexDataDesc,
} from "../interface/textureData.interface";
import { RefCntBase } from "./refCountBase";

function validateShapeAndSize(shape: GPUTexShape, size: Three<number>): void {
    if (
        size[0] !== Math.max(1, ~~size[0]) ||
        size[1] !== Math.max(1, ~~size[1]) ||
        size[2] !== Math.max(1, ~~size[2])
    ) {
        throw new Error(
            "Texture size components must be non-zero positive integers",
        );
    }

    if (
        (shape === GPUTexShape.T1D && size[1] !== 1 && size[2] !== 1) ||
        (shape === GPUTexShape.T2D && size[2] !== 1)
    ) {
        throw new Error("Texture size components do not match shape");
    }
}

function resolveMips(
    mip: boolean | number | undefined,
    size: Three<number>,
): number {
    const autoMips = nMips(size[0], size[1], size[2]);

    if (mip === undefined || mip === false) {
        return 1;
    }

    if (mip === true || mip <= 0) {
        return autoMips;
    }

    if (mip !== ~~mip) {
        throw new Error("Mip levels must be an integer");
    }

    if (mip > autoMips) {
        throw new Error(
            `Requested mip levels (${mip}) exceed maximum possible (${autoMips})`,
        );
    }

    return mip;
}

export abstract class GPUTexDataBase extends RefCntBase implements IGPUTexData {
    public readonly label: string;
    public readonly shape: GPUTexShape;
    public readonly size: Three<number>;
    public readonly format: GPUTexFormat;
    public readonly viewFormats: GPUTexFormat[];
    public readonly usage: GPUTexUsage;
    public readonly mip: number;

    constructor(d: IGPUTexDataDesc) {
        super();
        // first validate shape and size
        validateShapeAndSize(d.shape, d.size);

        // set trivial props
        this.shape = d.shape;
        this.size = d.size;
        this.format = d.format;

        // compute/assing mips
        this.mip = resolveMips(d.mip, d.size);

        this.usage = d.usage;

        // assign view formats
        this.viewFormats = d.viewFormats ?? [this.format];

        this.label =
            d.label ??
            `texData(${this.shape} ${this.size[0]}x${this.size[1]}x${this.size[2]} ${this.format})`;
    }

    public abstract uploadExternImage(image: ImageBitmap): void;

    public abstract doMips(): void;
}
