import type { IResizable, ITViewable } from "./interfaces";

export class ViewportTexture<
    Tformat extends GPUTextureFormat = GPUTextureFormat,
>
    implements IResizable, ITViewable
{
    public tex!: GPUTexture;
    public view!: GPUTextureView;
    public resized: boolean = false;
    public multisample: number = 1;

    constructor(
        public format: Tformat,
        public renderScale: number = 1,
        public label: string | undefined = undefined,
        multisample?: boolean | number,
    ) {
        if (multisample === false || multisample === 1) this.multisample = 1;
        if (multisample === true) this.multisample = 4;
        if (typeof multisample === "number") this.multisample = multisample;
        if (this.multisample !== 1 && this.multisample !== 4) {
            throw new Error(
                `Invalid multisample value: ${multisample}. Must be 1, 4, true, or false.`,
            );
        }
    }

    public get width(): number {
        return this.tex.width;
    }

    public get height(): number {
        return this.tex.height;
    }

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
            sampleCount: this.multisample,
            label: this.label,
        });

        this.view = this.tex.createView({
            label: `${this.label ?? "<unk>"}:default`,
        }); // fries in bag

        this.resized = true;
    }
}
