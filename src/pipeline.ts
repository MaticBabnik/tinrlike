import {
    CameraSystem,
    DebugSystem,
    type ECS,
    LightSystem,
    MeshSystem,
} from "./honda";
import {
    Buffer,
    ShadowMapTexture,
    StructArrayBuffer,
    ViewportMipTexture,
    ViewportTexture,
    type WGpu,
} from "./honda/backends/wg";
import {
    BloomPass,
    DebugLinePass,
    type DrawCall,
    EdgePass,
    GatherDataPass,
    GBufferPass,
    type Instance,
    PostprocessPass,
    ShadePass,
    ShadowMapPass,
    type UniformData,
} from "./honda/backends/wg/passes";

export function createGpuPipeline(gpu: WGpu, ecs: ECS) {
    const N_SHADOWMAPS = 8;
    const BLUR_PASSES = 10;

    const base = new ViewportTexture("rgba8unorm-srgb", 1, "gBase");
    const normal = new ViewportTexture("rgba8unorm", 1, "gNormal");
    const mtlRgh = new ViewportTexture("rg8unorm", 1, "gMetalRough");
    const emission = new ViewportTexture("rgba16float", 1, "gEmission");
    const depth = new ViewportTexture("depth24plus", 1, "gDepth");
    const edge = new ViewportTexture("r8unorm", 1, "edge");
    const shaded = new ViewportTexture("rgba16float", 1, "shaded");
    const bloom = new ViewportMipTexture(
        "rgba16float",
        BLUR_PASSES,
        1,
        "bloom",
    );

    const shadowmaps = new ShadowMapTexture(
        N_SHADOWMAPS,
        "depth24plus",
        2048,
        "shadowmaps",
    );
    shadowmaps.alloc(gpu.device);

    gpu.getShaderModule("bloom");

    // register for resizing
    gpu.addViewport(base);
    gpu.addViewport(normal);
    gpu.addViewport(mtlRgh);
    gpu.addViewport(emission);
    gpu.addViewport(depth);
    gpu.addViewport(edge);
    gpu.addViewport(shaded);
    gpu.addViewport(bloom);

    const drawCalls = [] as DrawCall[];
    const skinInstances = [] as Instance[];
    const uniformData = {} as UniformData;

    const shadowBuffer = new Buffer(
        gpu,
        Math.max(gpu.device.limits.minUniformBufferOffsetAlignment, 64) *
            N_SHADOWMAPS,
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        "shadowmapUniforms",
    );

    const meshBuf = new StructArrayBuffer(
        gpu,
        gpu.getStruct("g", "Instance"),
        8192,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        "meshInstanceBuffer",
    );

    const skinBuf = new StructArrayBuffer(
        gpu,
        gpu.getStruct("gskin", "Instance"),
        100,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        "skinInstanceBuffer",
    );

    const lightBuf = new StructArrayBuffer(
        gpu,
        gpu.getStruct("shade", "Light"),
        128,
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        "lightInstanceBuffer",
    );

    gpu.addPass(
        new GatherDataPass(
            gpu,

            ecs.getSystem(CameraSystem),
            ecs.getSystem(MeshSystem),
            ecs.getSystem(LightSystem),

            drawCalls,
            meshBuf,
            skinInstances,
            skinBuf,

            lightBuf,
            shadowBuffer,

            uniformData,
        ),
    );

    gpu.addPass(
        new GBufferPass(
            gpu,

            uniformData,
            drawCalls,
            meshBuf,
            skinInstances,
            skinBuf,

            base,
            normal,
            mtlRgh,
            emission,
            depth,
        ),
    );

    gpu.addPass(
        new ShadowMapPass(
            gpu,

            uniformData,
            drawCalls,
            meshBuf,
            skinInstances,
            skinBuf,

            shadowBuffer,

            shadowmaps,
        ),
    );

    gpu.addPass(
        new EdgePass(
            gpu,
            {
                normalBoost: 1.0,
                depthBoost: 1.0,
            },

            uniformData,

            normal,
            depth,

            edge,
        ),
    );

    gpu.addPass(
        new ShadePass(
            gpu,

            uniformData,
            lightBuf,

            base,
            normal,
            mtlRgh,
            emission,
            depth,

            shadowmaps,

            shaded,
        ),
    );

    gpu.addPass(
        new BloomPass(
            gpu,

            {
                threshold: 4.0,
                knee: 0.5,
                maxPasses: BLUR_PASSES,
            },

            shaded,

            bloom,
        ),
    );

    if (gpu.settings.debugRenderers) {
        gpu.addPass(
            new DebugLinePass(
                gpu,

                ecs.getSystem(DebugSystem),

                uniformData,

                shaded,
            ),
        );
    }

    gpu.addPass(
        new PostprocessPass(
            gpu,

            {
                exposure: 1,
                gamma: 1.5,

                fogColor: [0.5, 0.6, 0.7],
                fogStart: 10,
                fogEnd: 100,
                fogDensity: 0,

                bloom: 0.03,
            },

            uniformData,
            shaded,
            depth,
            edge,
            bloom,

            gpu.canvasTexture,
        ),
    );
}
