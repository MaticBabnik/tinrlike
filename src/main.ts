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
    Scene,
} from "@/honda";
import { perfRenderer } from "@/honda/util/perf";
import { setError, setStatus } from "@/honda/util/status";
import { $ } from "./honda/util";
import { FizSys, FizSystem } from "./honda/systems/fiz";
import { WGpu } from "./honda/backends/wg/gpu";
import { createScene } from "./scenes/game.scene";
import { UIManager } from "./honda/ui/ui";
import { GameStorage } from "./storage";
import { DEFAULT_SETTINGS } from "./honda/backends/wg";
import { createToonRP } from "./toonf.rp";
import { createMainMenuScene } from "./scenes/mainMenu.scene";
import { importGltf } from "./assets";
import { RefCntBase } from "./honda/gpu2/base/refCountBase";

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
    await importGltf(Game.ecs.getService(AssetSrv));

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

// TODO(mbabnik): Add ability to pause the game loop (but keep some level of code running)

async function mount() {
    const canvas = $<HTMLCanvasElement>("canvas");

    // Debug-ish feature.
    RefCntBase.trackLeaks();

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

    const wgSettings = GameStorage.getKeyOrDefault("settings", {
        version: 2,
        ...DEFAULT_SETTINGS,
    });
    const gpu = await WGpu.obtainForCanvas(wgSettings, canvas);

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
