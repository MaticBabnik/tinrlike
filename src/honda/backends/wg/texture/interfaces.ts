export interface ITextureBase {
    label?: string;

    get format(): GPUTextureFormat;

    get width(): number;

    get height(): number;
}

export interface IMultiSamplable {
    multisample: number;
}

/**
 * Resizable texture interface
 */
export interface IResizable extends ITextureBase {
    resize(dev: GPUDevice, viewportW: number, viewportH: number): void;

    resized: boolean;
}

/**
 * Trivially viewable texture interface
 */
export interface ITViewable extends ITextureBase {
    get view(): GPUTextureView;

    get resized(): boolean | undefined;
}

export interface IMipViewable extends ITViewable {
    get mipLevels(): number;

    get views(): GPUTextureView[];
}

/**
 * Ping-pongable texture interface
 */
export interface IPingPongable extends ITextureBase {
    get views(): [GPUTextureView, GPUTextureView];

    get resized(): boolean | undefined;

    /**
     * Get the view that is safe to read from
     */
    get readView(): GPUTextureView;

    /**
     * Get the view that is safe to render to
     */
    get renderView(): GPUTextureView;

    /**
     * Ping-pong the views
     */
    pingPong(): void;
}
