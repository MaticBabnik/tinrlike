import type { IPingPongable, IResizable } from "./interfaces";

export class ViewportPingPongTexture<Tformat extends GPUTextureFormat = GPUTextureFormat>
    implements IResizable, IPingPongable
{
    public tex!: GPUTexture;
    public views!: [GPUTextureView, GPUTextureView];
    public resized = false;

    constructor(
        public format: Tformat,
        public renderScale: number = 1,
        public label = "<unk>",
    ) {}

    public pingPong(): void {
        this.views.reverse();
    }

    public get readView(): GPUTextureView {
        return this.views[0];
    }

    public get renderView(): GPUTextureView {
        return this.views[1];
    }

    public resize(dev: GPUDevice, viewportW: number, viewportH: number) {
        this.tex?.destroy();
        this.tex = dev.createTexture({
            format: this.format,
            size: [
                ~~(viewportW * this.renderScale),
                ~~(viewportH * this.renderScale),
                2,
            ],
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
            dimension: "2d",
            label: `${this.label}:A`,
        });

        this.views = [
            this.tex.createView({
                baseArrayLayer: 0,
                arrayLayerCount: 1,
                dimension: "2d",
                label: `${this.label}:A`,
            }),
            this.tex.createView({
                baseArrayLayer: 1,
                arrayLayerCount: 1,
                dimension: "2d",
                label: `${this.label}:B`,
            }),
        ];

        this.resized = true;
    }
}
