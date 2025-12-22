import type { IResizable, ITViewable } from "./interfaces";

export class ViewportTexture<
    Tformat extends GPUTextureFormat = GPUTextureFormat,
> implements IResizable, ITViewable
{
    public tex!: GPUTexture;
    public view!: GPUTextureView;
    public resized: boolean = false; 

    constructor(
        public format: Tformat,
        public renderScale: number = 1,
        public label: string | undefined = undefined,
    ) {}

    public resize(dev: GPUDevice, viewportW: number, viewportH: number) {
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
            label: this.label,
        });

        this.view = this.tex.createView({
            label: `${this.label ?? "<unk>"}:default`,
        }); // fries in bag

        this.resized = true;
    }
}
