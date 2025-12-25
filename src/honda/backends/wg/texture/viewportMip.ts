import { nMips } from "@/honda/gpu2/common/utils";
import type { IResizable, IMipViewable } from "./interfaces";

export class ViewportMipTexture<
    Tformat extends GPUTextureFormat = GPUTextureFormat,
> implements IResizable, IMipViewable
{
    public tex!: GPUTexture;
    public view!: GPUTextureView;
    public resized: boolean = false;
    public mipLevels: number = 1;
    public views!: GPUTextureView[];

    constructor(
        public format: Tformat,
        public maxMips: number = 100,
        public renderScale: number = 1,
        public label: string | undefined = undefined,
    ) {
        this.views = [];
    }

    public get width(): number {
        return this.tex.width;
    }

    public get height(): number {
        return this.tex.height;
    }

    public resize(dev: GPUDevice, viewportW: number, viewportH: number) {
        this.mipLevels = Math.min(this.maxMips, nMips(viewportW, viewportH));

        console.log(this.mipLevels);

        this.tex?.destroy();
        this.tex = dev.createTexture({
            format: this.format,
            size: [
                ~~(viewportW * this.renderScale),
                ~~(viewportH * this.renderScale),
            ],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_SRC,
            dimension: "2d",
            mipLevelCount: this.mipLevels,
            label: this.label,
        });

        this.view = this.tex.createView({
            label: `${this.label ?? "<unk>"}:default`,
        }); // fries in bag

        this.views = [];
        this.views.length = this.mipLevels;

        for (let i = 0; i < this.mipLevels; i++) {
            this.views[i] = this.tex.createView({
                baseMipLevel: i,
                mipLevelCount: 1,
                label: `${this.label ?? "<unk>"}:mip${i}`,
            });
        }

        this.resized = true;
    }
}
