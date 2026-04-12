import {
    CameraSystem,
    LightSystem,
    MeshSystem,
    type ECS,
    type UniformData,
} from "./honda";
import {
    Buffer,
    StructArrayBuffer,
    ViewportTexture,
    type WGpu,
} from "./honda/backends/wg";
import { DepthPass } from "./honda/backends/wg/passes/toonf/depth.pass";
import {
    GatherDataPass,
    type ToonMeshInstance,
    type MeshDraws,
} from "./honda/backends/wg/passes/toonf/gather.pass";
import { MainPass } from "./honda/backends/wg/passes/toonf/main.pass";
import { PostPass } from "./honda/backends/wg/passes/toonf/post.pass";

export async function createToonForwardPipeline(gpu: WGpu, ecs: ECS) {
    const { multisample, renderScale, shadowMapSize } = gpu.settings;

    void shadowMapSize;

    gpu.$pipelineIdentifier = "toonF";

    const shaded = new ViewportTexture(
        "rgba16float",
        renderScale,
        "shaded",
        multisample,
    );
    const depth = new ViewportTexture(
        "depth24plus",
        renderScale,
        "depth",
        multisample,
    );

    const meshDraws: MeshDraws = {
        blend: [],
        opaque: [],
    };

    const uniformData = {} as UniformData;

    const shadowBuffer = new Buffer(
        gpu,
        Math.max(gpu.device.limits.minUniformBufferOffsetAlignment, 64) * 8,
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        "shadowmapUniforms",
    );

    const meshBuf = new StructArrayBuffer<ToonMeshInstance>(
        gpu,
        gpu.getStruct("toonf/toon", "Instance"),
        8192,
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        "meshInstanceBuffer",
    );

    // TODO: get own structs
    const lightBuf = new StructArrayBuffer(
        gpu,
        gpu.getStruct("toonf/toon", "Light"),
        128,
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        "lightInstanceBuffer",
    );

    gpu.addViewport(shaded);
    gpu.addViewport(depth);

    // 0. gather data
    gpu.addPass(
        new GatherDataPass(
            gpu,
            ecs.getSystem(CameraSystem),
            ecs.getSystem(MeshSystem),
            ecs.getSystem(LightSystem),
            meshDraws,
            meshBuf,
            lightBuf,
            shadowBuffer,
            uniformData,
        ),
    );

    // 1. depth opaque
    gpu.addPass(new DepthPass(gpu, uniformData, meshDraws, meshBuf, depth));

    // 2. shadowmaps
    // TODO: impl shadows

    // 3. render opaque & alpha clip
    gpu.addPass(
        new MainPass(
            gpu,
            uniformData,
            meshDraws,
            meshBuf,
            lightBuf,
            shaded,
            depth,
        ),
    );
    // + inverse hull outlines ?

    // 4. transparent
    // + inverse hull outlines ?

    // 5. postprocess (bloom, tone mapping, HDR??)

    gpu.addPass(new PostPass(gpu, shaded, gpu.canvasTexture));
}
