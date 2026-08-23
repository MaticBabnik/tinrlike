import type { ITViewable } from "./interfaces";

export class SwitchbleTView implements ITViewable {
    public readonly textures: [ITViewable, ITViewable];

    private _switched: boolean = true;
    private _active: 0 | 1 | undefined;

    public constructor(
        public readonly label: string | undefined,
        public readonly v0: ITViewable,
        public readonly v1: ITViewable,
    ) {
        this.textures = [v0, v1];
    }

    public get active() {
        return this._active;
    }

    public get resized(): boolean {
        return this.v0.resized || this.v1.resized || false;
    }

    public get view(): GPUTextureView {
        return this.textures[this._active ?? 0].view;
    }

    public get format(): GPUTextureFormat {
        return this.textures[this._active ?? 0].format;
    }

    public get width(): number {
        return this.textures[this._active ?? 0].width;
    }
    public get height(): number {
        return this.textures[this._active ?? 0].height;
    }

    public get switchedOrResized() {
        return this.resized || this._switched;
    }

    public activate(slot: boolean | number) {
        const newSlot = slot ? 1 : 0;

        if (this._active !== newSlot) {
            this._switched = true;
            this._active = newSlot;
        }
    }

    public resetSwitched() {
        this._switched = false;
    }

}
