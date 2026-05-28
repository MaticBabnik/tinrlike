import {
    Input,
    Game,
    ScriptSystem,
    MeshSystem,
    CameraSystem,
    LightSystem,
    GltfLoader,
    createSoundSystem,
    ScriptSys,
    MeshSys,
    CameraSys,
    LightSys,
    SoundSys,
    DebugSrv,
    DebugService,
    VisualService,
    VisualSrv,
    AssetSrv,
    AssetService,
} from "@/honda";
import { perfRenderer } from "@/honda/util/perf";
import { setError, setStatus } from "@/honda/util/status";
import { $ } from "./honda/util";
import { FizSys, FizSystem } from "./honda/systems/fiz";
import { WGpu } from "./honda/backends/wg/gpu";
import { GltfBinary } from "./honda/util/gltf";
import { createScene } from "./scenes/game.scene";
import { UIManager } from "./honda/ui/ui";
import { GameStorage } from "./storage";
import { DEFAULT_SETTINGS } from "./honda/backends/wg";
import { createToonRP } from "./toonf.rp";
import { createMainMenuScene } from "./scenes/mainMenu.scene";

const MAX_STEP = 0.0166; // Aim for 60 tick/frames per second

async function frame() {
    performance.mark("frame-start");
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

    performance.mark("cpu-done");

    Game.perf.measure("frame");
    Game.gpu.startFrame();
    Game.gpu.render();
    Game.perf.measureEnd();
    Game.input.endFrame();

    performance.mark("render-done");

    Game.perf.measure("frameEnd");

    Game.gpu.frameEnd();

    const perf = (Game.gpu as Partial<WGpu>).perf;
    if (perf) {
        Game.perf.sumbitGpuTimestamps(perf.labels, perf.times, perf.n);
    }

    Game.perf.stopFrame();
    Game.perf.measureEnd();
    performance.mark("frame-done");

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

function setPlatformInfo(gpu: WGpu) {
    const cpuInfo = navigator.platform;
    const gpuInfo = gpu.adapterString;

    $<HTMLSpanElement>("#cpuinfo").innerText = cpuInfo;
    $<HTMLSpanElement>("#gpuinfo").innerText = gpuInfo;
    $<HTMLSpanElement>("#pipelineinfo").innerText =
        `${gpu.$rpId} ${gpu.settings.multisample ? "4xMSAA" : "no MSAA"}`;
}

async function gameEntry() {
    const as = Game.ecs.getService(AssetSrv);

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

    as.registerAsset(
        "alphatest",
        new GltfLoader(await GltfBinary.fromUrl("./smile.glb")),
    );

    as.registerAsset(
        "spheres",
        new GltfLoader(await GltfBinary.fromUrl("./spheres2.glb")),
    );

    as.registerAsset(
        "hatsunefuckingmiku",
        new GltfLoader(await GltfBinary.fromUrl("./hatsunefuckingmiku.glb")),
    );

    await Game.ecs.getSystem(SoundSys).loadAudioFiles({
        step1: "/sound/step1.opus",
        step2: "/sound/step2.opus",
        step3: "/sound/step3.opus",
        step4: "/sound/step4.opus",
        turret_active: "/sound/turret_active.opus",
        turret_search: "/sound/turret_search.opus",
    });

    // Game.sceneManager.queueScene(createMainMenuScene.bind(null, createScene));
    Game.sceneManager.queueScene(createScene);
}

// TODO(mbabnik): Proper UI layer (vue?)
// TODO(mbabnik): Add ability to pause the game loop (but keep some level of code running)

async function mount() {
    const canvas = $<HTMLCanvasElement>("canvas");

    Game.ui = new UIManager($("#vue-app"));
    Game.input = new Input(canvas);

    Game.ecs.registerSystem(ScriptSys, new ScriptSystem());
    Game.ecs.registerSystem(MeshSys, new MeshSystem());
    Game.ecs.registerSystem(CameraSys, new CameraSystem());
    Game.ecs.registerSystem(LightSys, new LightSystem());
    Game.ecs.registerSystem(FizSys, new FizSystem());
    Game.ecs.registerSystem(SoundSys, createSoundSystem());

    Game.ecs.registerService(AssetSrv, new AssetService());
    Game.ecs.registerService(DebugSrv, new DebugService());
    Game.ecs.registerService(VisualSrv, new VisualService());

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

    createToonRP(gpu, Game.ecs);
    gpu.printRenderPath();
    gpu.onError = (err) => setError(err.toString());
    Game.gpu = gpu;
    setPlatformInfo(gpu);
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
