import {
    Input,
    Game,
    ScriptSystem,
    MeshSystem,
    CameraSystem,
    LightSystem,
    DebugSystem,
    GltfLoader,
} from "@/honda";
import { perfRenderer } from "@/honda/util/perf";
import { setError, setStatus } from "@/honda/util/status";

import { createScene } from "./scene";
import { $ } from "./honda/util";
import { FizSystem } from "./honda/systems/fiz";
import { WGpu } from "./honda/backends/wg/gpu";
import { createGpuPipeline } from "./pipeline";
import { GltfBinary } from "./honda/util/gltf";
import { AssetSystem } from "./honda/systems/asset/asset.system";

const MAX_STEP = 0.0166; // Aim for 60 tick/frames per second

async function frame() {
    Game.perf.startFrame();
    Game.input.frame();

    const realNow = performance.now() / 1000;
    const delta = Math.min(Math.max(realNow - Game.time, 0), MAX_STEP);
    Game.deltaTime = delta;
    Game.time += delta;

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
        $<HTMLPreElement>("#measured-gpu")
    ),
    500
);

async function gameEntry() {
    const as = Game.ecs.getSystem(AssetSystem);

    const level = new GltfLoader(await GltfBinary.fromUrl("./next.glb"));
    const tc = new GltfLoader(await GltfBinary.fromUrl("./testchr.glb"));
    const sc = new GltfLoader(
        await GltfBinary.fromUrl("./SummoningCircle.glb")
    );
    const eg = new GltfLoader(await GltfBinary.fromUrl("./EnemyGeneric.glb"));

    as.registerAsset("level", level);
    as.registerAsset("testchr", tc);
    as.registerAsset("summoningcircle", sc);
    as.registerAsset("enemyGeneric", eg);
}

// TODO(mbabnik): Proper UI layer (vue?)
// TODO(mbabnik): Add ability to pause the game loop (but keep some level of code running)

async function mount() {
    const canvas = $<HTMLCanvasElement>("canvas");

    Game.input = new Input(canvas);

    Game.ecs.addSystem(new AssetSystem());
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
        canvas
    );
    createGpuPipeline(gpu, Game.ecs);
    gpu.onError = (err) => setError(err.toString());
    Game.gpu2 = gpu;

    setStatus("init");
    await gameEntry();
    createScene();
    setStatus(undefined);
    Game.time = 0;
    requestAnimationFrame(frame);
}

mount().catch((e) => {
    setError((e as object).toString());
    throw e;
});
