export interface AtlasSpec {
    name: string;
    texture: GPUTexture;
    spriteSize: number;

    columns: number;
    rows: number;
}
