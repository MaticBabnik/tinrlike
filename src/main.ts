import {
    Input,
    Game,
    ScriptSystem,
    MeshSystem,
    CameraSystem,
    LightSystem,
    DebugSystem,
    GltfLoader,
    SoundSystem,
} from "@/honda";
import { perfRenderer } from "@/honda/util/perf";
import { setError, setStatus } from "@/honda/util/status";
import { $ } from "./honda/util";
import { FizSystem } from "./honda/systems/fiz";
import { WGpu } from "./honda/backends/wg/gpu";
import { createGpuPipeline } from "./pipeline";
import { GltfBinary } from "./honda/util/gltf";
import { AssetSystem } from "./honda/systems/asset/asset.system";
import { createMainMenuScene } from "./scenes/mainMenu.scene";
import { createScene } from "./scenes/game.scene";
import { UIManager } from "./honda/ui/ui";
import { GameStorage } from "./storage";
import { DEFAULT_SETTINGS } from "./honda/backends/wg";

const MAX_STEP = 0.0166; // Aim for 60 tick/frames per second

async function frame() {
    Game.perf.startFrame();
    Game.input.frame();

    Game.sceneManager.switchPoint();

    const realNow = performance.now() / 1000;
    const delta = Math.min(Math.max(realNow - Game.time, 0), MAX_STEP);
    Game.deltaTime = delta;
    Game.time += delta;

    Game.ui.frame();

    Game.perf.measure("earlyUpdate");
    Game.ecs.earlyUpdate();
    Game.perf.measure("update");
    Game.ecs.update();
    Game.perf.measure("transforms");
    Game.sceneManager.scene.computeTransforms();
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

async function gameEntry() {
    const as = Game.ecs.getSystem(AssetSystem);

    const level = new GltfLoader(await GltfBinary.fromUrl("./next.glb"));
    const tc = new GltfLoader(await GltfBinary.fromUrl("./testchr.glb"));
    const sc = new GltfLoader(
        await GltfBinary.fromUrl("./SummoningCircle.glb"),
    );
    const eg = new GltfLoader(await GltfBinary.fromUrl("./EnemyGeneric.glb"));

    as.registerAsset("level", level);
    as.registerAsset("testchr", tc);
    as.registerAsset("summoningcircle", sc);
    as.registerAsset("enemyGeneric", eg);

    await Game.ecs.getSystem(SoundSystem).loadAudioFiles({
        step1: "/sound/step1.opus",
        step2: "/sound/step2.opus",
        step3: "/sound/step3.opus",
        step4: "/sound/step4.opus",
        turret_active: "/sound/turret_active.opus",
        turret_search: "/sound/turret_search.opus",
    });

    Game.sceneManager.queueScene(createMainMenuScene.bind(null, createScene));
}

// TODO(mbabnik): Proper UI layer (vue?)
// TODO(mbabnik): Add ability to pause the game loop (but keep some level of code running)

async function mount() {
    const canvas = $<HTMLCanvasElement>("canvas");

    Game.ui = new UIManager($("#vue-app"));
    Game.input = new Input(canvas);

    Game.ecs.addSystem(new AssetSystem());
    Game.ecs.addSystem(new DebugSystem());
    Game.ecs.addSystem(new ScriptSystem());
    Game.ecs.addSystem(new MeshSystem());
    Game.ecs.addSystem(new CameraSystem());
    Game.ecs.addSystem(new LightSystem());
    Game.ecs.addSystem(new FizSystem());
    Game.ecs.addSystem(new SoundSystem());

    /**
     * Initalize GPU backend & create rendering pipeline
     */
    const gpu = await WGpu.obtainForCanvas(
        GameStorage.getKeyOrDefault("settings", {
            version: 2,
            ...DEFAULT_SETTINGS,
        }),
        canvas,
    );

    createGpuPipeline(gpu, Game.ecs);
    gpu.onError = (err) => setError(err.toString());
    Game.gpu2 = gpu;

    setStatus("init");
    await gameEntry();
    setStatus(undefined);
    Game.time = 0;
    requestAnimationFrame(frame);
}

mount().catch((e) => {
    setError((e as object).toString());
    throw e;
});
