import {
    Input,
    Game,
    ScriptSystem,
    MeshSystem,
    CameraSystem,
    LightSystem,
    DebugSystem,
} from "@/honda";
import { perfRenderer } from "@/honda/util/perf";
import { setError, setStatus } from "@/honda/util/status";

import { createScene } from "./scene";
import { $ } from "./honda/util";
import { FizSystem } from "./honda/systems/fiz";
import { WGpu } from "./honda/backends/wg/gpu";
import { createGpuPipeline } from "./pipeline";

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

async function mount() {
    const canvas = $<HTMLCanvasElement>("canvas");

    Game.input = new Input(canvas);

    Game.ecs.addSystem(new DebugSystem());
    Game.ecs.addSystem(new ScriptSystem());
    Game.ecs.addSystem(new MeshSystem());
    Game.ecs.addSystem(new CameraSystem());
    Game.ecs.addSystem(new LightSystem());
    Game.ecs.addSystem(new FizSystem());

    /**
     * Initalize GPU backend & create rendering pipeline
     */
    const gpu = await WGpu.obtainForCanvas(
        {
            anisotropy: 4,
            renderScale: 1,
            shadowMapSize: 2048,
            debugRenderers: true,
        },
        canvas,
    );
    createGpuPipeline(gpu, Game.ecs);
    gpu.onError = (err) => setError(err.toString());
    Game.gpu2 = gpu;

    /**
     * Create first scene
     */
    await createScene();
    setStatus(undefined);
    Game.time = performance.now() / 1000; // get inital timestamp so delta isnt broken
    requestAnimationFrame(frame);
}

mount().catch((e) => {
    setError((e as object).toString());
    throw e;
});
