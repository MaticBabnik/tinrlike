/**
 * Buffer usage flags.
 */
export const enum GPUBufUsage {
    /**
     * Buffer might be the source of a copy operation.
     */
    CopySource = 1 << 0,

    /**
     * Buffer might be the destination of a copy operation.
     */
    CopyDestination = 1 << 1,

    /**
     * Buffer might be used as a vertex buffer.
     */
    Vertex = 1 << 2,

    /**
     * Buffer might be used as an index buffer.
     */
    Index = 1 << 3,

    /**
     * Buffer might be used as a uniform buffer.
     */
    Uniform = 1 << 4,

    /**
     * Buffer might be used as a storage buffer.
     */
    Storage = 1 << 5,

    /**
     * Buffer might be used for indirect draw/dispatch commands.
     */
    Indirect = 1 << 6,

    /**
     * Buffer might be mapped for reading.
     */
    MapRead = 1 << 7,

    /**
     * Buffer might be mapped for writing.
     */
    MapWrite = 1 << 8,
}

/**
 * Buffer usage hints.
 */
export const enum GPUBufHint {
    /**
     * No hints, glhf to the driver.
     */
    None = 0,

    /**
     * Buffer is not expected to change after creation.
     */
    Static = 1,

    /**
     * Buffer is expected to change frequently.
     */
    Dynamic = 2,

    /**
     * Buffer is expected will be used a few times and then discarded.
     */
    Stream = 3,
}

/**
 * Texture usage flags.
 */
export const enum GPUTexUsage {
    /**
     * Texture might be the source of a copy operation.
     */
    CopySource = 1 << 0,

    /**
     * Texture might be the destination of a copy operation.
     */
    CopyDestination = 1 << 1,

    /**
     * Texture might be sampled in a shader.
     */
    TextureBinding = 1 << 2,

    /**
     * Texture might be used as a render target.
     */
    RenderTarget = 1 << 3,

    /**
     * Texture might be used as storage texture.
     */
    ComputeStorage = 1 << 4,
}

export const enum GPUTexShape {
    T1D = 1,

    T2D = 2,
    T2DArray = 20,

    T3D = 3,

    TCube = 4,
    TCubeArray = 40,
}

export const enum GPUTexFormat {
    R8UNORM,
    R8SNORM,
    R8UINT,
    R8SINT,
    R16UNORM,
    R16SNORM,
    R16UINT,
    R16SINT,
    R16FLOAT,
    RG8UNORM,
    RG8SNORM,
    RG8UINT,
    RG8SINT,
    R32UINT,
    R32SINT,
    R32FLOAT,
    RG16UNORM,
    RG16SNORM,
    RG16UINT,
    RG16SINT,
    RG16FLOAT,
    RGBA8UNORM,
    RGBA8UNORM_SRGB,
    RGBA8SNORM,
    RGBA8UINT,
    RGBA8SINT,
    BGRA8UNORM,
    BGRA8UNORM_SRGB,
    RGB9E5UFLOAT,
    RGB10A2UINT,
    RGB10A2UNORM,
    RG11B10UFLOAT,
    RG32UINT,
    RG32SINT,
    RG32FLOAT,
    RGBA16UNORM,
    RGBA16SNORM,
    RGBA16UINT,
    RGBA16SINT,
    RGBA16FLOAT,
    RGBA32UINT,
    RGBA32SINT,
    RGBA32FLOAT,
    STENCIL8,
    DEPTH16UNORM,
    DEPTH24PLUS,
    DEPTH24PLUS_STENCIL8,
    DEPTH32FLOAT,
    DEPTH32FLOAT_STENCIL8,
    BC1_RGBA_UNORM,
    BC1_RGBA_UNORM_SRGB,
    BC2_RGBA_UNORM,
    BC2_RGBA_UNORM_SRGB,
    BC3_RGBA_UNORM,
    BC3_RGBA_UNORM_SRGB,
    BC4_R_UNORM,
    BC4_R_SNORM,
    BC5_RG_UNORM,
    BC5_RG_SNORM,
    BC6H_RGB_UFLOAT,
    BC6H_RGB_FLOAT,
    BC7_RGBA_UNORM,
    BC7_RGBA_UNORM_SRGB,
    ETC2_RGB8UNORM,
    ETC2_RGB8UNORM_SRGB,
    ETC2_RGB8A1UNORM,
    ETC2_RGB8A1UNORM_SRGB,
    ETC2_RGBA8UNORM,
    ETC2_RGBA8UNORM_SRGB,
    EAC_R11UNORM,
    EAC_R11SNORM,
    EAC_RG11UNORM,
    EAC_RG11SNORM,
    ASTC_4X4_UNORM,
    ASTC_4X4_UNORM_SRGB,
    ASTC_5X4_UNORM,
    ASTC_5X4_UNORM_SRGB,
    ASTC_5X5_UNORM,
    ASTC_5X5_UNORM_SRGB,
    ASTC_6X5_UNORM,
    ASTC_6X5_UNORM_SRGB,
    ASTC_6X6_UNORM,
    ASTC_6X6_UNORM_SRGB,
    ASTC_8X5_UNORM,
    ASTC_8X5_UNORM_SRGB,
    ASTC_8X6_UNORM,
    ASTC_8X6_UNORM_SRGB,
    ASTC_8X8_UNORM,
    ASTC_8X8_UNORM_SRGB,
    ASTC_10X5_UNORM,
    ASTC_10X5_UNORM_SRGB,
    ASTC_10X6_UNORM,
    ASTC_10X6_UNORM_SRGB,
    ASTC_10X8_UNORM,
    ASTC_10X8_UNORM_SRGB,
    ASTC_10X10_UNORM,
    ASTC_10X10_UNORM_SRGB,
    ASTC_12X10_UNORM,
    ASTC_12X10_UNORM_SRGB,
    ASTC_12X12_UNORM,
    ASTC_12X12_UNORM_SRGB,
}

export const enum GPUTexFilter {
    Nearest = 0,
    Linear = 1,
}

export const enum GPUTexAddr {
    Clamp = 0,
    Repeat = 1,
    Mirror = 2,
}

export enum GPUMatAlpha {
    OPAQUE = 0,
    MASK = 1,
    BLEND = 2,
}
