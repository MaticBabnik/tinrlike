import {
    Input,
    WebGpu,
    Game,
    ScriptSystem,
    PostprocessPass,
    SkyPass,
    GBufferPass,
    ShadowMapPass,
    ShadePass,
    MeshSystem,
    CameraSystem,
    LightSystem,
} from "@/honda";
import { perfRenderer } from "@/honda/util/perf";
import { setError, setStatus } from "@/honda/util/status";

import { createScene } from "./scene";
import type { Flags } from "./honda/util/flags";
import { $ } from "./honda/util";
import { FizSystem } from "./honda/systems/fiz";

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
    Game.gpu.frameStart();
    Game.passes.forEach((x) => {
        x.apply();
    });

    Game.input.endFrame();
    await Game.gpu.endFrame();
    Game.perf.measureEnd();
    Game.perf.stopFrame();
    Game.gpu.wasResized = false;
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

const play = async (preset: "low" | "medium" | "high") => {
    Game.flags = new Set<Flags>(
        (
            {
                low: ["rsHalf", "noSSAO", "shadowLow"],
                medium: ["shadowLow"],
                high: [],
            } satisfies Record<string, Flags[]>
        )[preset],
    );

    const canvas = $<HTMLCanvasElement>("canvas");

    try {
        Game.gpu = await WebGpu.obtainForCanvas(canvas);
    } catch (e) {
        setError((e as object).toString());
        throw e;
    }

    Game.input = new Input(canvas);
    Game.ecs.addSystem(new ScriptSystem());
    Game.ecs.addSystem(new MeshSystem());
    Game.ecs.addSystem(new CameraSystem());
    Game.ecs.addSystem(new LightSystem());
    Game.ecs.addSystem(new FizSystem());

    await createScene();

    Game.passes = [
        new GBufferPass(),
        new ShadowMapPass(),
        new SkyPass(),
        new ShadePass(),
        new PostprocessPass(),
    ];

    setStatus(undefined);
    Game.cmdEncoder = Game.gpu.device.createCommandEncoder();

    Game.time = performance.now() / 1000; //get inital timestamp so delta isnt broken
    requestAnimationFrame(frame);
};

const h = window.location.hash.replace(/^#/, "");
play(h === "low" || h === "medium" || h === "high" ? h : "high");
