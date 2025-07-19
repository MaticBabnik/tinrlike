import {
    Input,
    WebGpu,
    Game,
    ScriptSystem,
    PostprocessPass,
    SSAOPass,
    SkyPass,
    GBufferPass,
    ShadowMapPass,
    BloomPass,
    ShadePass,
    MeshSystem,
    CameraSystem,
    LightSystem,
    SoundSystem,
    PhysicsSystem,
    NavSystem,
    CameraComponent,
} from "@/honda";
import { perfRenderer } from "@/honda/util/perf";
import { setError, setStatus } from "@/honda/util/status";

import { createScene } from "./scene";
import { Flags } from "./honda/util/flags";
import { CubemapTexture } from "./honda/gpu/textures";
import { Transform } from "./honda/core/transform";
import { quat, vec3 } from "wgpu-matrix";
import { PI_2 } from "./honda/util";

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
    Game.passes.forEach((x) => x.apply());

    Game.input.endFrame();
    await Game.gpu.endFrame();
    Game.perf.measureEnd();
    Game.perf.stopFrame();
    Game.gpu.wasResized = false;
    requestAnimationFrame(frame);
}

const $ = document.querySelector.bind(document);
setInterval(
    perfRenderer(
        $<HTMLSpanElement>("#fps")!,
        $<HTMLSpanElement>("#mspf")!,
        $<HTMLSpanElement>("#ents")!,
        $<HTMLPreElement>("#measured")!,
        $<HTMLPreElement>("#measured-gpu")!
    ),
    500
);

const PROBE_ROTATIONS = [
    quat.fromEuler(0, -PI_2, 0, "xyz"),
    quat.fromEuler(0, PI_2, 0, "xyz"),
    quat.fromEuler(PI_2, 0, Math.PI, "xyz"),
    quat.fromEuler(-PI_2, 0, Math.PI, "xyz"),
    quat.fromEuler(0, Math.PI, 0, "xyz"),
    quat.fromEuler(0, 0, 0, "xyz"),
];

/**
 * Take control of the engine in order to capture the scene
 */
function captureProbe(size = 1024) {
    // setup
    const probe = new CubemapTexture(size, "probe");
    const probeCamera = new CameraComponent(90, 0.1, 32, "probe");
    const probeTransform = new Transform(vec3.create(0, 2, 0));
    const cameraSys = Game.ecs.getSystem(CameraSystem);
    const capturePasses = Game.passes.filter(
        (x) =>
            !(x instanceof SSAOPass) &&
            !(x instanceof PostprocessPass) &&
            !(x instanceof BloomPass)
    ); // remove all passes after shade

    // Manually init engine & scene
    Game.gpu.resizeViewports([size, size]);
    Game.scene.computeTransforms();
    Game.ecs.getSystem(MeshSystem).lateUpdate();
    Game.ecs.getSystem(LightSystem).lateUpdate();

    // captures
    for (let i = 0; i < PROBE_ROTATIONS.length; i++) {
        setStatus(`capturing probes: ${i}/6`);
        // setup camera
        probeTransform.rotation.set(PROBE_ROTATIONS[i]);
        probeTransform.update();
        probeTransform.$updateGlobal(Game.scene.transform);
        cameraSys.overrideCamera(probeCamera, probeTransform);

        // render each view and flip & copy it into probe's cubemap
        Game.cmdEncoder = Game.gpu.device.createCommandEncoder();
        capturePasses.forEach((x) => x.apply());
        {
            const f = Game.cmdEncoder.beginRenderPass({
                label: "flipx",
                colorAttachments: [
                    {
                        loadOp: "clear",
                        storeOp: "store",
                        view: probe.tex.createView({
                            baseArrayLayer: i,
                            baseMipLevel: 0,
                            arrayLayerCount: 1,
                            mipLevelCount: 1,
                        }),
                    },
                ],
            });
            f.setPipeline(Game.gpu.pipelines.flipx);
            f.setBindGroup(
                0,
                Game.gpu.device.createBindGroup({
                    layout: Game.gpu.bindGroupLayouts.flipx,
                    entries: [
                        {
                            binding: 0,
                            resource: Game.gpu.textures.shaded.view,
                        },
                    ],
                })
            );
            f.draw(3);
            f.end();
        }
        Game.gpu.device.queue.submit([Game.cmdEncoder.finish()]);
    }

    // Get probe ready & use it
    probe.computeIrradiance();
    probe.computeSpecular();
    Game.gpu.env = probe;

    // reset viewports to correct resolution
    Game.gpu.resizeViewports();
}

const play = async (preset: "low" | "medium" | "high") => {
    Game.flags = new Set<Flags>(
        (
            {
                low: ["rsHalf", "noSSAO", "shadowLow"],
                medium: ["shadowLow"],
                high: [],
            } satisfies Record<string, Flags[]>
        )[preset]
    );

    const canvas = document.querySelector("canvas")!;

    try {
        Game.gpu = await WebGpu.obtainForCanvas(canvas);
    } catch (e) {
        setError((e as object).toString());
        throw e;
    }

    Game.input = new Input(canvas);
    Game.ecs.addSystem(new NavSystem());
    Game.ecs.addSystem(new ScriptSystem());
    Game.ecs.addSystem(new MeshSystem());
    Game.ecs.addSystem(new CameraSystem());
    Game.ecs.addSystem(new LightSystem());
    Game.ecs.addSystem(new PhysicsSystem());
    Game.ecs.addSystem(new SoundSystem());

    await createScene();

    Game.passes = [
        new GBufferPass(),
        new SSAOPass(),
        new ShadowMapPass(),
        new SkyPass(Game.gpu.sky),
        new ShadePass(),
        new BloomPass(),
        new PostprocessPass(),
    ];

    captureProbe();

    setStatus(undefined);
    Game.cmdEncoder = Game.gpu.device.createCommandEncoder();

    Game.time = performance.now() / 1000; //get inital timestamp so delta isnt broken
    requestAnimationFrame(frame);
};

const h = window.location.hash.replace(/^#/, "");
play(h == "low" || h == "medium" || h == "high" ? h : "high");
