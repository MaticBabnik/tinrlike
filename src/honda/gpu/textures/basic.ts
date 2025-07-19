export class BasicTexture {
    public readonly view: GPUTextureView;

    constructor(public readonly texture: GPUTexture) {
        this.view = texture.createView();
    }
}
