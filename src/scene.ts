import {
    Game,
    SceneNode,
    CameraComponent,
    GltfBinary,
    ScriptComponent,
    Script,
    LightComponent,
    DebugSystem,
    AABBShape,
    CircleShape,
    CopyTransformMode,
    DynamicPhysicsObject,
    FizComponent,
    FizMaterial,
    StaticPhysicsObject,
    FIZ_LAYER_PHYS,
    nn
} from "@/honda";
import { quat } from "wgpu-matrix";
import { setStatus } from "./honda/util/status";
import { AnimationPlayerScript } from "@/scripts/animplayer.script";
import { TL_LAYER_PLAYER } from "./constants";
import { PlayerScript } from "./scripts/player.script";
import { LerpCameraScript } from "./scripts/lerpCamera.script";
import { SpikeScript } from "./scripts/spike.script";

export async function createScene() {
    setStatus("loading assets");
    const level = await GltfBinary.fromUrl("./next.glb");
    const tc = await GltfBinary.fromUrl("./testchr.glb");

    setStatus("building scene");

    level.json.extensions?.KHR_lights_punctual?.lights.forEach((light) => {
        if (light.intensity) light.intensity /= 50;
    });

    Game.scene.addChild(level.sceneAsNode());

    // create coliders
    {
        const a = new SceneNode();
        a.name = "StaticColliders";

        a.addComponent(
            new FizComponent(
                new StaticPhysicsObject(new AABBShape(7, 7), [-12, 12]),
                "FrontWall",
                CopyTransformMode.None,
            ),
        );

        a.addComponent(
            new FizComponent(
                new StaticPhysicsObject(new AABBShape(7, 7), [12, -12]),
                "BackWall",
                CopyTransformMode.None,
            ),
        );

        a.addComponent(
            new FizComponent(
                new StaticPhysicsObject(new AABBShape(2, 2), [-8, -8]),
                "BoxesLeft",
                CopyTransformMode.None,
            ),
        );

        a.addComponent(
            new FizComponent(
                new StaticPhysicsObject(new AABBShape(2, 2), [8, 8]),
                "BoxesRight",
                CopyTransformMode.None,
            ),
        );

        a.addComponent(
            new FizComponent(
                new StaticPhysicsObject(new AABBShape(22, 2), [0, -19]),
                "WallLeftBack",
                CopyTransformMode.None,
            ),
        );

        a.addComponent(
            new FizComponent(
                new StaticPhysicsObject(new AABBShape(22, 2), [0, 19]),
                "WallRightFront",
                CopyTransformMode.None,
            ),
        );

        a.addComponent(
            new FizComponent(
                new StaticPhysicsObject(new AABBShape(2, 18), [-19, 0]),
                "WallLeftFront",
                CopyTransformMode.None,
            ),
        );

        a.addComponent(
            new FizComponent(
                new StaticPhysicsObject(new AABBShape(2, 18), [19, 0]),
                "WallRightBack",
                CopyTransformMode.None,
            ),
        );

        Game.scene.addChild(a);
    }

    // hurt thingy
    {
        const spikeNode = nn(
            Game.scene.findChild((x) => x.name === "floor_tile_big_spikes"),
        );

        spikeNode.addComponent(
            new FizComponent(
                new StaticPhysicsObject(
                    new AABBShape(1.4, 1.4),
                    [0, 0],
                    0,
                    0,
                    TL_LAYER_PLAYER,
                ),
                "HurtZone",
                CopyTransformMode.PositionXZ,
            ),
        );

        spikeNode.addComponent(new ScriptComponent(new SpikeScript()));
    }

    const DEG = Math.PI / 180;
    {
        const player = new SceneNode();
        player.name = "Player";
        player.transform.translation.set([3, 0, -3]);
        player.transform.update();
        player.addComponent(
            new FizComponent(
                new DynamicPhysicsObject(
                    new CircleShape(0.5),
                    [0, 0],
                    0,
                    0.05,
                    FIZ_LAYER_PHYS | TL_LAYER_PLAYER,
                    0,
                    new FizMaterial(0.1, 0.6),
                ),
                "Player",
                CopyTransformMode.PositionXZ,
            ),
        );
        player.addComponent(new ScriptComponent(new PlayerScript()));

        {
            const tcn = tc.sceneAsNode();
            const anim = tc.getAnimation(0);
            const anim2 = tc.getAnimation(1);

            anim.attach(tcn);
            anim2.attach(tcn);

            tcn.addComponent(
                new ScriptComponent(new AnimationPlayerScript(anim)),
            );
            tcn.addComponent(
                new ScriptComponent(new AnimationPlayerScript(anim2)),
            );
            player.addChild(tcn);
        }

        Game.scene.addChild(player);

        const cameraHolder = new SceneNode();

        const camera = new SceneNode();
        camera.name = "Camera";
        camera.transform.translation.set([0, 0, 50]);
        camera.transform.update();
        camera.addComponent(new CameraComponent(NaN, NaN, NaN, "MainCamera"));

        quat.fromEuler(
            -30 * DEG,
            -45 * DEG,
            0,
            "zyx",
            cameraHolder.transform.rotation,
        );
        cameraHolder.transform.update();

        cameraHolder.addChild(camera);
        cameraHolder.addComponent(new ScriptComponent(new LerpCameraScript()));
        Game.scene.addChild(cameraHolder);
    }

    {
        const sun = new SceneNode();

        sun.name = "sun";
        sun.addComponent(
            new LightComponent({
                castShadows: true,
                color: [1, 0.953, 0.871],
                intensity: 10,
                type: "directional",
                maxRange: 20,
            }),
        );

        sun.transform.rotation = quat.fromEuler(-45, -45, 0, "xyz");
        sun.transform.update();

        Game.scene.addChild(sun);
    }

    Game.scene.addComponent(
        new ScriptComponent(
            new (class extends Script {
                private d: DebugSystem = null!;

                override onAttach(): void {
                    this.d = Game.ecs.getSystem(DebugSystem);
                }

                public override update(): void {
                    // XYZ axes
                    this.d.line([0, 0, 0], [1, 0, 0], [1, 0, 0]);
                    this.d.line([0, 0, 0], [0, 1, 0], [0, 1, 0]);
                    this.d.line([0, 0, 0], [0, 0, 1], [0, 0, 1]);
                }
            })(),
        ),
    );

    console.groupCollapsed("scene");
    console.log(Game.scene.tree());
    console.groupEnd();

    // Game.gpu.sky = sky2;
}
