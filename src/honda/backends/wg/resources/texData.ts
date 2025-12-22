import { generateMipmap } from "webgpu-utils";
import { GPUTexDataBase } from "../../../gpu2/base/textureDataBase";
import {
    GPUTexFormat,
    GPUTexShape,
    GPUTexUsage,
    type IGPUTexData,
    type IGPUTexDataDesc,
} from "../../../gpu2/interface";
import type { WGpu } from "../gpu";

const FORMAT_MAP: Record<GPUTexFormat, GPUTextureFormat> = {
    [GPUTexFormat.R8UNORM]: "r8unorm",
    [GPUTexFormat.R8SNORM]: "r8snorm",
    [GPUTexFormat.R8UINT]: "r8uint",
    [GPUTexFormat.R8SINT]: "r8sint",
    [GPUTexFormat.R16UNORM]: "r16unorm",
    [GPUTexFormat.R16SNORM]: "r16snorm",
    [GPUTexFormat.R16UINT]: "r16uint",
    [GPUTexFormat.R16SINT]: "r16sint",
    [GPUTexFormat.R16FLOAT]: "r16float",
    [GPUTexFormat.RG8UNORM]: "rg8unorm",
    [GPUTexFormat.RG8SNORM]: "rg8snorm",
    [GPUTexFormat.RG8UINT]: "rg8uint",
    [GPUTexFormat.RG8SINT]: "rg8sint",
    [GPUTexFormat.R32UINT]: "r32uint",
    [GPUTexFormat.R32SINT]: "r32sint",
    [GPUTexFormat.R32FLOAT]: "r32float",
    [GPUTexFormat.RG16UNORM]: "rg16unorm",
    [GPUTexFormat.RG16SNORM]: "rg16snorm",
    [GPUTexFormat.RG16UINT]: "rg16uint",
    [GPUTexFormat.RG16SINT]: "rg16sint",
    [GPUTexFormat.RG16FLOAT]: "rg16float",
    [GPUTexFormat.RGBA8UNORM]: "rgba8unorm",
    [GPUTexFormat.RGBA8UNORM_SRGB]: "rgba8unorm-srgb",
    [GPUTexFormat.RGBA8SNORM]: "rgba8snorm",
    [GPUTexFormat.RGBA8UINT]: "rgba8uint",
    [GPUTexFormat.RGBA8SINT]: "rgba8sint",
    [GPUTexFormat.BGRA8UNORM]: "bgra8unorm",
    [GPUTexFormat.BGRA8UNORM_SRGB]: "bgra8unorm-srgb",
    [GPUTexFormat.RGB9E5UFLOAT]: "rgb9e5ufloat",
    [GPUTexFormat.RGB10A2UINT]: "rgb10a2uint",
    [GPUTexFormat.RGB10A2UNORM]: "rgb10a2unorm",
    [GPUTexFormat.RG11B10UFLOAT]: "rg11b10ufloat",
    [GPUTexFormat.RG32UINT]: "rg32uint",
    [GPUTexFormat.RG32SINT]: "rg32sint",
    [GPUTexFormat.RG32FLOAT]: "rg32float",
    [GPUTexFormat.RGBA16UNORM]: "rgba16unorm",
    [GPUTexFormat.RGBA16SNORM]: "rgba16snorm",
    [GPUTexFormat.RGBA16UINT]: "rgba16uint",
    [GPUTexFormat.RGBA16SINT]: "rgba16sint",
    [GPUTexFormat.RGBA16FLOAT]: "rgba16float",
    [GPUTexFormat.RGBA32UINT]: "rgba32uint",
    [GPUTexFormat.RGBA32SINT]: "rgba32sint",
    [GPUTexFormat.RGBA32FLOAT]: "rgba32float",
    [GPUTexFormat.STENCIL8]: "stencil8",
    [GPUTexFormat.DEPTH16UNORM]: "depth16unorm",
    [GPUTexFormat.DEPTH24PLUS]: "depth24plus",
    [GPUTexFormat.DEPTH24PLUS_STENCIL8]: "depth24plus-stencil8",
    [GPUTexFormat.DEPTH32FLOAT]: "depth32float",
    [GPUTexFormat.DEPTH32FLOAT_STENCIL8]: "depth32float-stencil8",
    [GPUTexFormat.BC1_RGBA_UNORM]: "bc1-rgba-unorm",
    [GPUTexFormat.BC1_RGBA_UNORM_SRGB]: "bc1-rgba-unorm-srgb",
    [GPUTexFormat.BC2_RGBA_UNORM]: "bc2-rgba-unorm",
    [GPUTexFormat.BC2_RGBA_UNORM_SRGB]: "bc2-rgba-unorm-srgb",
    [GPUTexFormat.BC3_RGBA_UNORM]: "bc3-rgba-unorm",
    [GPUTexFormat.BC3_RGBA_UNORM_SRGB]: "bc3-rgba-unorm-srgb",
    [GPUTexFormat.BC4_R_UNORM]: "bc4-r-unorm",
    [GPUTexFormat.BC4_R_SNORM]: "bc4-r-snorm",
    [GPUTexFormat.BC5_RG_UNORM]: "bc5-rg-unorm",
    [GPUTexFormat.BC5_RG_SNORM]: "bc5-rg-snorm",
    [GPUTexFormat.BC6H_RGB_UFLOAT]: "bc6h-rgb-ufloat",
    [GPUTexFormat.BC6H_RGB_FLOAT]: "bc6h-rgb-float",
    [GPUTexFormat.BC7_RGBA_UNORM]: "bc7-rgba-unorm",
    [GPUTexFormat.BC7_RGBA_UNORM_SRGB]: "bc7-rgba-unorm-srgb",
    [GPUTexFormat.ETC2_RGB8UNORM]: "etc2-rgb8unorm",
    [GPUTexFormat.ETC2_RGB8UNORM_SRGB]: "etc2-rgb8unorm-srgb",
    [GPUTexFormat.ETC2_RGB8A1UNORM]: "etc2-rgb8a1unorm",
    [GPUTexFormat.ETC2_RGB8A1UNORM_SRGB]: "etc2-rgb8a1unorm-srgb",
    [GPUTexFormat.ETC2_RGBA8UNORM]: "etc2-rgba8unorm",
    [GPUTexFormat.ETC2_RGBA8UNORM_SRGB]: "etc2-rgba8unorm-srgb",
    [GPUTexFormat.EAC_R11UNORM]: "eac-r11unorm",
    [GPUTexFormat.EAC_R11SNORM]: "eac-r11snorm",
    [GPUTexFormat.EAC_RG11UNORM]: "eac-rg11unorm",
    [GPUTexFormat.EAC_RG11SNORM]: "eac-rg11snorm",
    [GPUTexFormat.ASTC_4X4_UNORM]: "astc-4x4-unorm",
    [GPUTexFormat.ASTC_4X4_UNORM_SRGB]: "astc-4x4-unorm-srgb",
    [GPUTexFormat.ASTC_5X4_UNORM]: "astc-5x4-unorm",
    [GPUTexFormat.ASTC_5X4_UNORM_SRGB]: "astc-5x4-unorm-srgb",
    [GPUTexFormat.ASTC_5X5_UNORM]: "astc-5x5-unorm",
    [GPUTexFormat.ASTC_5X5_UNORM_SRGB]: "astc-5x5-unorm-srgb",
    [GPUTexFormat.ASTC_6X5_UNORM]: "astc-6x5-unorm",
    [GPUTexFormat.ASTC_6X5_UNORM_SRGB]: "astc-6x5-unorm-srgb",
    [GPUTexFormat.ASTC_6X6_UNORM]: "astc-6x6-unorm",
    [GPUTexFormat.ASTC_6X6_UNORM_SRGB]: "astc-6x6-unorm-srgb",
    [GPUTexFormat.ASTC_8X5_UNORM]: "astc-8x5-unorm",
    [GPUTexFormat.ASTC_8X5_UNORM_SRGB]: "astc-8x5-unorm-srgb",
    [GPUTexFormat.ASTC_8X6_UNORM]: "astc-8x6-unorm",
    [GPUTexFormat.ASTC_8X6_UNORM_SRGB]: "astc-8x6-unorm-srgb",
    [GPUTexFormat.ASTC_8X8_UNORM]: "astc-8x8-unorm",
    [GPUTexFormat.ASTC_8X8_UNORM_SRGB]: "astc-8x8-unorm-srgb",
    [GPUTexFormat.ASTC_10X5_UNORM]: "astc-10x5-unorm",
    [GPUTexFormat.ASTC_10X5_UNORM_SRGB]: "astc-10x5-unorm-srgb",
    [GPUTexFormat.ASTC_10X6_UNORM]: "astc-10x6-unorm",
    [GPUTexFormat.ASTC_10X6_UNORM_SRGB]: "astc-10x6-unorm-srgb",
    [GPUTexFormat.ASTC_10X8_UNORM]: "astc-10x8-unorm",
    [GPUTexFormat.ASTC_10X8_UNORM_SRGB]: "astc-10x8-unorm-srgb",
    [GPUTexFormat.ASTC_10X10_UNORM]: "astc-10x10-unorm",
    [GPUTexFormat.ASTC_10X10_UNORM_SRGB]: "astc-10x10-unorm-srgb",
    [GPUTexFormat.ASTC_12X10_UNORM]: "astc-12x10-unorm",
    [GPUTexFormat.ASTC_12X10_UNORM_SRGB]: "astc-12x10-unorm-srgb",
    [GPUTexFormat.ASTC_12X12_UNORM]: "astc-12x12-unorm",
    [GPUTexFormat.ASTC_12X12_UNORM_SRGB]: "astc-12x12-unorm-srgb",
};

export function toWgTexUsage(usage: GPUTexUsage): GPUTextureUsageFlags {
    let wgUsage = 0;

    if (usage & GPUTexUsage.CopySource) {
        wgUsage |= GPUTextureUsage.COPY_SRC;
    }

    if (usage & GPUTexUsage.CopyDestination) {
        wgUsage |= GPUTextureUsage.COPY_DST;
    }

    if (usage & GPUTexUsage.TextureBinding) {
        wgUsage |= GPUTextureUsage.TEXTURE_BINDING;
    }

    if (usage & GPUTexUsage.ComputeStorage) {
        wgUsage |= GPUTextureUsage.STORAGE_BINDING;
    }

    if (usage & GPUTexUsage.RenderTarget) {
        wgUsage |= GPUTextureUsage.RENDER_ATTACHMENT;
    }

    return wgUsage;
}

const DIMENSION_MAP: Record<GPUTexShape, GPUTextureDimension> = {
    [GPUTexShape.T1D]: "1d",

    [GPUTexShape.T2D]: "2d",
    [GPUTexShape.T2DArray]: "2d",

    [GPUTexShape.T3D]: "3d",

    [GPUTexShape.TCube]: "2d",
    [GPUTexShape.TCubeArray]: "2d",
};

export class WGTexData extends GPUTexDataBase implements IGPUTexData {
    public texture: GPUTexture;
    public nativeView: GPUTextureView;
    public views: Partial<Record<GPUTextureFormat, GPUTextureView>> = {};

    public constructor(
        protected gpu: WGpu,
        d: IGPUTexDataDesc,
    ) {
        super(d);

        this.texture = this.gpu.device.createTexture({
            label: this.label,
            size: this.size,
            format: FORMAT_MAP[this.format],
            viewFormats: this.viewFormats?.map((f) => FORMAT_MAP[f]),
            usage: toWgTexUsage(this.usage),
            mipLevelCount: this.mip,
            dimension: DIMENSION_MAP[this.shape],
        });

        this.nativeView = this.texture.createView();
        this.views[FORMAT_MAP[this.format]] = this.nativeView;

        for (const vf of this.viewFormats) {
            if (vf === this.format) continue;

            this.views[FORMAT_MAP[vf]] = this.texture.createView({
                format: FORMAT_MAP[vf],
            });
        }
    }

    public uploadExternImage(image: ImageBitmap): void {
        this.gpu.device.queue.copyExternalImageToTexture(
            { source: image },
            { texture: this.texture },
            {
                width: this.size[0],
                height: this.size[1],
                depthOrArrayLayers: this.size[2],
            },
        );
    }

    public doMips(): void {
        generateMipmap(this.gpu.device, this.texture);
    }

    protected _rcDestroy(): void {
        this.views = null!;
        this.nativeView = null!;
        this.gpu.safeDestroy(this.texture);
    }
}
