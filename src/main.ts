import {
    Input,
    Game,
    ScriptSystem,
    MeshSystem,
    CameraSystem,
    LightSystem,
    DebugSystem,
    GBufferPass,
    ShadePass,
    ShadowMapPass,
    PostprocessPass,
} from "@/honda";
import { perfRenderer } from "@/honda/util/perf";
import { setError, setStatus } from "@/honda/util/status";

import { createScene } from "./scene";
import { $ } from "./honda/util";
import { FizSystem } from "./honda/systems/fiz";
import { WGpu } from "./honda/backends/wg/gpu";
import { Buffer, StructArrayBuffer } from "./honda/backends/wg/buffer";
import {
    type DrawCall,
    GatherDataPass,
    type Instance,
    type UniformData,
} from "./honda/backends/wg/passes/gatherData.pass";
import {
    ShadowMapTexture,
    ViewportPingPongTexture,
    ViewportTexture,
} from "./honda/backends/wg/textures";

const MAX_STEP = 0.1; // Atleast 10 updates per second

async function frame() {
    Game.perf.startFrame();
    Game.input.frame();

    const now = Math.min(performance.now() / 1000, Game.time + MAX_STEP);
    Game.deltaTime = now - Game.time;
    Game.time = now;

    Game.perf.measure("earlyUpdate");
    Game.ecs.earlyUpdate();
    Game.perf.measure("update");
    Game.ecs.update();
    Game.perf.measure("transforms");
    Game.scene.computeTransforms();
    Game.perf.measure("lateUpdate");
    Game.ecs.lateUpdate();
    Game.perf.measure("gpu");

    Game.gpu2.startFrame();
    Game.gpu2.render();

    Game.input.endFrame();
    await Game.gpu2.frameEnd();

    const perf = (Game.gpu2 as Partial<WGpu>).perf;
    if (perf) {
        Game.perf.sumbitGpuTimestamps(perf.labels, perf.times, perf.n);
    }

    Game.perf.measureEnd();
    Game.perf.stopFrame();
    requestAnimationFrame(frame);
}

setInterval(
    perfRenderer(
        $<HTMLSpanElement>("#fps"),
        $<HTMLSpanElement>("#mspf"),
        $<HTMLSpanElement>("#ents"),
        $<HTMLPreElement>("#measured"),
        $<HTMLPreElement>("#measured-gpu"),
    ),
    500,
);

// TODO(mbabnik): Proper UI layer (vue?)
// TODO(mbabnik): Add ability to pause the game loop (but keep some level of code running)

function createGpuPipeline(gpu: WGpu) {
    const N_SHADOWMAPS = 8;

    const base = new ViewportTexture("rgba8unorm-srgb", 1, "gBase");
    const normal = new ViewportTexture("rgba8unorm", 1, "gNormal");
    const mtlRgh = new ViewportTexture("rg8unorm", 1, "gMetalRough");
    const emission = new ViewportTexture("rgba8unorm", 1, "gEmission");
    const depth = new ViewportTexture("depth24plus", 1, "gDepth");
    const shaded = new ViewportTexture("rgba16float", 1, "shaded");

    const shadowmaps = new ShadowMapTexture(
        N_SHADOWMAPS,
        "depth24plus",
        2048,
        "shadowmaps",
    );
    shadowmaps.alloc(gpu.device);

    // register for resizing
    gpu.addViewport(base);
    gpu.addViewport(normal);
    gpu.addViewport(mtlRgh);
    gpu.addViewport(emission);
    gpu.addViewport(depth);
    gpu.addViewport(shaded);

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

            Game.ecs.getSystem(CameraSystem),
            Game.ecs.getSystem(MeshSystem),
            Game.ecs.getSystem(LightSystem),

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
        new PostprocessPass(
            gpu,

            {
                exposure: 1,
                gamma: 1.5,

                fogColor: [0.5, 0.6, 0.7],
                fogStart: 10,
                fogEnd: 100,
                fogDensity: 0,
            },

            uniformData,
            shaded,
            depth,

            gpu.canvasTexture,
        ),
    );
}

async function mount() {
    const canvas = $<HTMLCanvasElement>("canvas");

    Game.input = new Input(canvas);

    Game.ecs.addSystem(new DebugSystem());
    Game.ecs.addSystem(new ScriptSystem());
    Game.ecs.addSystem(new MeshSystem());
    Game.ecs.addSystem(new CameraSystem());
    Game.ecs.addSystem(new LightSystem());
    Game.ecs.addSystem(new FizSystem());

    const gpu = await WGpu.obtainForCanvas(
        {
            anisotropy: 4,
            renderScale: 1,
            shadowMapSize: 2048,
        },
        canvas,
    );
    Game.gpu2 = gpu;

    createGpuPipeline(gpu);

    await createScene();
    setStatus(undefined);
    Game.time = performance.now() / 1000; // get inital timestamp so delta isnt broken
    requestAnimationFrame(frame);
}

mount().catch((e) => {
    setError((e as object).toString());
    throw e;
});
