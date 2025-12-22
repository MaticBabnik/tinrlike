export type WGSettings = {
    anisotropy: 1 | 4;

    renderScale: number;

    shadowMapSize: number;
};

export const DEFAULT_SETTINGS: WGSettings = {
    anisotropy: 4,
    renderScale: 1,
    shadowMapSize: 1024,
};
