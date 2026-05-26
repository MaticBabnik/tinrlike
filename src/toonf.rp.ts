import { CameraSys, LightSys, MeshSys, type ECS } from "./honda";
import {
    Buffer,
    ShadowMapTexture,
    StructArrayBuffer,
    ViewportTexture,
    type WGpu,
} from "./honda/backends/wg";
import { DepthPass } from "./honda/backends/wg/passes/toonf/depth.pass";
import {
    GatherDataPass,
    type ToonMeshInstance,
    type MeshDraws,
    type UniformData,
} from "./honda/backends/wg/passes/toonf/gather.pass";
import { MainPass } from "./honda/backends/wg/passes/toonf/main.pass";
import { PostPass } from "./honda/backends/wg/passes/toonf/post.pass";
import { ResolvePass } from "./honda/backends/wg/passes/toonf/resolve.pass";
import { ShadowPass } from "./honda/backends/wg/passes/toonf/shadow.pass";

export async function createToonRP(gpu: WGpu, ecs: ECS) {
    const { multisample, renderScale, shadowMapSize } = gpu.settings;

    console.log(gpu.settings);

    gpu.$rpId = "toonF";

    let shadedRead: ViewportTexture<"rgba16float">;

    const shadedRenderTarget = new ViewportTexture(
        "rgba16float",
        renderScale,
        "shaded",
        multisample,
    );

    if (multisample > 1) {
        shadedRead = new ViewportTexture(
            "rgba16float",
            renderScale,
            "shadedResolve",
            false,
        );
        gpu.addViewport(shadedRead);
    } else {
        shadedRead = shadedRenderTarget;
    }

    const depth = new ViewportTexture(
        "depth24plus",
        renderScale,
        "depth",
        multisample,
    );
    const shadowmaps = new ShadowMapTexture(
        4,
        "depth24plus",
        shadowMapSize * 4,
        "shadowmaps",
    );

    shadowmaps.alloc(gpu.device);

    const meshDraws: MeshDraws = {
        blend: [],
        opaque: [],
    };

    const uniformData = {
        maxShadowmaps: shadowmaps.nLights,
    } as UniformData;

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

    gpu.addViewport(shadedRenderTarget);
    gpu.addViewport(depth);

    // 0. gather data
    gpu.addPass(
        new GatherDataPass(
            gpu,
            ecs.getSystem(CameraSys),
            ecs.getSystem(MeshSys),
            ecs.getSystem(LightSys),
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
    gpu.addPass(
        new ShadowPass(
            gpu,
            uniformData,
            meshDraws,
            meshBuf,
            shadowmaps,
            shadowBuffer.gpuBuf,
        ),
    );

    // 3. render all
    gpu.addPass(
        new MainPass(
            gpu,
            uniformData,
            meshDraws,
            meshBuf,
            lightBuf,
            shadedRenderTarget,
            depth,
            shadowmaps,
        ),
    );

    if (multisample > 1) {
        // 3.a resolve
        gpu.addPass(new ResolvePass(gpu, shadedRenderTarget, shadedRead));
    }

    // 5. postprocess (bloom, tone mapping, HDR??)

    gpu.addPass(new PostPass(gpu, shadedRead, gpu.canvasTexture));
}
