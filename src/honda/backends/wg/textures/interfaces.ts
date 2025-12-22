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
    get format(): GPUTextureFormat;

    get view(): GPUTextureView;

    get resized(): boolean | undefined;
}

/**
 * Ping-pongable texture interface
 */
export interface IPingPongable {
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
