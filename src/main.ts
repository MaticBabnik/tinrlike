import {
    Input,
    Game,
    ScriptSystem,
    MeshSystem,
    CameraSystem,
    LightSystem,
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
import { WGpuComposite } from "./honda/backends/wg";
import { createScene } from "./scenes/game.scene";
import { UIManager } from "./honda/ui/ui";
import { makeToonForward } from "./honda/backends/wg/rp/toonf.rp";
// import { createMainMenuScene } from "./scenes/mainMenu.scene";
import { importGltf } from "./assets";
import { RefCntBase } from "./honda/util/refCountBase";

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

    Game.perf.measure("gpu");
    Game.gpu.frame();
    Game.perf.measureEnd()
    Game.input.endFrame();

    const perf = (Game.gpu as Partial<WGpuComposite>).perf;
    if (perf) {
        Game.perf.sumbitGpuTimestamps(perf.labels, perf.times, perf.n);
    }
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

function setPlatformInfo(gpu: WGpuComposite) {
    const cpuInfo = navigator.platform;
    const gpuInfo = gpu.adapterString;

    $<HTMLSpanElement>("#cpuinfo").innerText = cpuInfo;
    $<HTMLSpanElement>("#gpuinfo").innerText = gpuInfo;
    $<HTMLSpanElement>("#pipelineinfo").innerText = gpu.rp.id;
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

    const gpu = await WGpuComposite.obtain({
        canvas,
        anisotropy: 4,
        featuresOptional: [],
        featuresRequired: [],
    });

    gpu.$switchRpImmed(
        makeToonForward(Game.ecs, {
            // FIXME: WebGPU devtools blow up when doing multisampling
            multisample: document.location.hash === "#debug" ? 1 : 4,
            shadowMapSize: 2048,
        }),
        true,
    );

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
