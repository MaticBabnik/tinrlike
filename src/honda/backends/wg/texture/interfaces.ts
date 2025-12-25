/**
 * Resizable texture interface
 */
export interface IResizable {
    resize(dev: GPUDevice, viewportW: number, viewportH: number): void;

    resized: boolean;
}

/**
 * Trivially viewable texture interface
 */
export interface ITViewable {
    get width(): number;

    get height(): number;

    get format(): GPUTextureFormat;

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
export interface IPingPongable {
    get width(): number;

    get height(): number;

    get format(): GPUTextureFormat;

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
