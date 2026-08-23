export const enum AlphaMode {
    Opaque = 0,
    AlphaClip = 1,
    AlphaBlend = 2,
    Overlay = 3,
}

export const enum Pass {
    None = 0,
    Main = 1 << 0,
    Depth = 1 << 1,
    Shadow = 1 << 2,
    All = 0xffff,
}

export type RenderState = {
    alphaMode: AlphaMode;
    passes: Pass;
};

export type RenderStateView<O extends keyof RenderState> = {
    [K in O]: RenderState[K];
} & {
    readonly [K in Exclude<keyof RenderState, O>]: RenderState[K];
};
