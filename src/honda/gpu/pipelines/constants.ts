export const TRI_LIST_CULLED = {
    cullMode: "back",
    topology: "triangle-list",
} satisfies GPUPrimitiveState;

export const TRI_STRIP_CULLED = {
    cullMode: "back",
    topology: "triangle-strip",
} satisfies GPUPrimitiveState;

export const VERTEX_POS = [
    {
        arrayStride: 12,
        attributes: [{ offset: 0, format: "float32x3", shaderLocation: 0 }],
    },
] satisfies GPUVertexBufferLayout[];

export const VERTEX_POS_UV = [
    ...VERTEX_POS,
    {
        arrayStride: 8,
        attributes: [{ offset: 0, format: "float32x2", shaderLocation: 1 }],
    },
] satisfies GPUVertexBufferLayout[];

export const VERTEX_POS_UV_NORM = [
    ...VERTEX_POS_UV,
    {
        arrayStride: 12,
        attributes: [{ offset: 0, format: "float32x3", shaderLocation: 2 }],
    },
] satisfies GPUVertexBufferLayout[];

export const VERTEX_POS_UV_NORM_SKIN = [
    ...VERTEX_POS_UV_NORM,

    {
        arrayStride: 4,
        attributes: [{ offset: 0, format: "uint8x4", shaderLocation: 3 }],
    },

    {
        arrayStride: 16,
        attributes: [{ offset: 0, format: "float32x4", shaderLocation: 4 }],
    },
] satisfies GPUVertexBufferLayout[];

export const VERTEX_POS_UV_NORM_TAN = [
    ...VERTEX_POS_UV_NORM,
    {
        arrayStride: 16,
        attributes: [{ offset: 0, format: "float32x4", shaderLocation: 3 }],
    },
] satisfies GPUVertexBufferLayout[];

export const DEPTHTEST_GREATER_WRITE = {
    depthWriteEnabled: true,
    depthCompare: "greater",
    format: "depth24plus",
} satisfies GPUDepthStencilState;
