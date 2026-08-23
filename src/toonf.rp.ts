import type { Mat4 } from "wgpu-matrix";
import {
    CameraSys,
    LightSys,
    MeshSys,
    VisualSrv,
    type ECS,
} from "./honda";
import {
    Buffer,
    ShadowMapTexture,
    StructArrayBuffer,
    StructBuffer,
    ViewportMipTexture,
    ViewportTexture,
    type WGpu,
} from "./honda/backends/wg";
import { FunctionPass } from "./honda/backends/wg/passes/function.pass";
import { SwitchPass } from "./honda/backends/wg/passes/switch.pass";
import { BloomPass } from "./honda/backends/wg/passes/toonf/bloom.pass";
import { DepthPass } from "./honda/backends/wg/passes/toonf/depth.pass";
import {
    GatherDataPass,
    type ToonMeshInstance,
    type MeshDraws2,
    type UniformData,
    type GPUPostCfg,
} from "./honda/backends/wg/passes/toonf/gather.pass";
import { GlitchPass } from "./honda/backends/wg/passes/toonf/glitch.pass";
import { MainPass } from "./honda/backends/wg/passes/toonf/main.pass";
import { PostPass } from "./honda/backends/wg/passes/toonf/post.pass";
import { ResolvePass } from "./honda/backends/wg/passes/toonf/resolve.pass";
import { ShadowPass } from "./honda/backends/wg/passes/toonf/shadow.pass";
import { SwitchbleTView } from "./honda/backends/wg/texture/switch";

export async function createToonRP(gpu: WGpu, ecs: ECS) {
    if (document.location.hash === "#debug") {
        // FIXME: WebGPU devtools blow up when doing multisampling
        gpu.settings.multisample = 1;
    }

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

    const bloom = new ViewportMipTexture(
        "rgba16float",
        undefined, // dont limit mips
        renderScale,
        "bloom",
    );

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

    const postTmp = new ViewportTexture(
        gpu.pFormat,
        renderScale,
        "postTmp",
        false,
    );

    shadowmaps.alloc(gpu.device);

    const meshDraws: MeshDraws2 = {
        main: {
            blend: [],
            opaque: [],
        },
        shadows: [],
    };

    const uniformData = {
        maxShadowmaps: shadowmaps.nLights,
        shadowmapVPs: [] as Mat4[],
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

    const postBuf = new StructBuffer<GPUPostCfg>(
        gpu,
        gpu.getStruct("toonf/toon", "PostCfg"),
        GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        "postConfigBuffer",
    );

    gpu.addViewport(shadedRenderTarget);
    gpu.addViewport(depth);
    gpu.addViewport(bloom);
    gpu.addViewport(postTmp);

    const post2target = new SwitchbleTView(
        "post2target",
        gpu.canvasTexture,
        postTmp,
    );

    const visualService = ecs.getService(VisualSrv);

    gpu.addPass(
        new FunctionPass(() => {
            post2target.resetSwitched();

            // when enabled it activates the 2nd post2target,
            // which allows for glitching the final image before it gets drawn to the canvas
            post2target.activate(visualService.glitchConfig.enabled);
        }),
    );

    // 0. gather data
    // TODO(mbabnik): fetch skeleton data
    gpu.addPass(
        new GatherDataPass(
            gpu,
            ecs.getSystem(CameraSys),
            ecs.getSystem(MeshSys),
            ecs.getSystem(LightSys),
            visualService,
            meshDraws,
            meshBuf,
            lightBuf,
            shadowBuffer,
            uniformData,
            postBuf,
        ),
    );

    // 1. depth opaque
    // TODO(mbabnik): maybe draw skinned meshes? (they are bad occluders so maybe don't)
    gpu.addPass(new DepthPass(gpu, uniformData, meshDraws, meshBuf, depth));

    // 2. shadowmaps
    // TODO(mbabnik): draw skinned meshes. (they need shadows lol)
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
    // TODO(mbabnik): draw skinned meshes!
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

    // 4. bloom
    gpu.addPass(
        new SwitchPass(
            new BloomPass(gpu, visualService.bloomConfig, shadedRead, bloom),
            () => visualService.postConfig.bloomPower > 0,
        ),
    );

    // 5. postprocess; render either as final or to a temp texture
    gpu.addPass(
        new PostPass(gpu, postBuf.gpuBuf, shadedRead, bloom, post2target),
    );

    // 6. glitch pass; only runs if enabled, and renders to the canvas
    gpu.addPass(
        new SwitchPass(
            new GlitchPass(
                gpu,
                visualService.glitchConfig,
                post2target,
                gpu.canvasTexture,
            ),
            () => visualService.glitchConfig.enabled,
        ),
    );
}
