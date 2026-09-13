import {
    Game,
    SceneNode,
    CameraComponent,
    ScriptComponent,
    Script,
    LightComponent,
    type DebugService,
    CircleShape,
    CopyTransformMode,
    DynamicPhysicsObject,
    FizComponent,
    FizMaterial,
    FIZ_LAYER_PHYS,
    Scene,
    DebugSrv,
    AssetSrv,
    VisualSrv,
    type VisualService,
    PI_2,
    MeshComponent,
} from "@/honda";
import { createSphereMesh, FresnelMaterial, Material } from "@/honda/gpu2";
import { quat } from "wgpu-matrix";
import { TL_LAYER_PLAYER } from "../constants";
import { PlayerScript } from "../scripts/player.script";
import { LerpCameraScript } from "../scripts/lerpCamera.script";
import GameHud from "@/ui/GameHud.vue";

class UIScript extends Script {
    public override onAttach(): void {
        console.log("Attaching UI Script");
        Game.ui.setView(GameHud, false);
        Game.ui.sendMessage({
            abilities: [],
        });
    }

    public override update(): void {
        Game.ui.sendMessage({
            health: 1,
        });
    }
}

class FanScript extends Script {
    public override update(): void {
        quat.fromEuler(PI_2, Game.time, 0, "xyz", this.node.transform.rotation);
        this.node.transform.update();
    }
}

class PropellerScript extends Script {
    public override update(): void {
        quat.fromEuler(0, Game.time, 0, "xyz", this.node.transform.rotation);
        this.node.transform.update();
    }
}

export function createScene() {
    const as = Game.ecs.getService(AssetSrv);
    const level = as.getAsset("l1");

    const scene = new Scene();
    scene.name = "GameScene";
    scene.addComponent(new ScriptComponent(new UIScript()));

    scene.addChild(level.sceneAsNode());

    scene.forEachChild((x) => {
        if (x.name.startsWith("Fan.Blade")) {
            x.addComponent(new ScriptComponent(new FanScript()));
        }

        if (x.name.startsWith("Spot")) {
            const l = x.assertComponent(LightComponent);
            l.lightInfo.color = [0, 0.7, 1];
            l.lightInfo.intensity = 25;
        }
    });

    const maybeLight = scene
        .findChild((x) => x.name === "Sun")
        ?.assertComponent(LightComponent);
    const maybeSun =
        maybeLight?.lightInfo.type === "directional"
            ? maybeLight.lightInfo
            : undefined;

    maybeSun!.maxRange = 10;

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

        const miku = as.getAsset("miku").sceneAsNode();

        miku.transform.scale.fill(0.1);
        quat.fromEuler(
            0,
            (-1 * Math.PI) / 4,
            0,
            "xyz",
            miku.transform.rotation,
        );
        miku.transform.update();

        player.addChild(miku);

        // fresnel shell around the player
        const shell = new SceneNode();
        shell.name = "PlayerShell";
        shell.transform.translation.set([0, 1.3, 0]);
        shell.transform.update();
        shell.addComponent(
            new MeshComponent(
                createSphereMesh(Game.gpu, { radius: 1.4, label: "playerShell", rings: 32, segments: 48 }),
                new Material(FresnelMaterial, { color: [0.4, 2.5, 3], power: 3 }, "playerShell"),
                "playerShell",
            ),
        );
        player.addChild(shell);

        scene.addChild(player);

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
        scene.addChild(cameraHolder);
    }

    scene.addComponent(
        new ScriptComponent(
            new (class extends Script {
                private d: DebugService = null!;

                override onAttach(): void {
                    this.d = Game.ecs.getService(DebugSrv);
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

    {
        const drone = as.getAsset("drone").getNodeByName("Drone");

        drone.children.forEach((node) => {
            if (node.name.startsWith("Propeller")) {
                node.addComponent(new ScriptComponent(new PropellerScript()));
            }
        });

        drone.transform.translation.set([0, 1.5, 0]);
        drone.transform.scale.fill(0.1);
        quat.fromEuler(0, PI_2 * 1.5, 0, "xyz", drone.transform.rotation);
        drone.transform.update();

        scene.addChild(drone);
    }

    scene.addComponent(
        new ScriptComponent(
            new (class extends Script {
                public glitchMinTime = 0.2;
                public glitchMaxTime = 0.4;
                public offsetTime = 0.2;

                private nextGlitch = 0;
                private nextOffset = 0;

                private vis!: VisualService;

                public onAttach(): void {
                    this.vis = Game.ecs.getService(VisualSrv);
                    this.vis.glitchConfig.blockSize = 256;
                    this.vis.glitchConfig.probability = 0.3;
                }

                private frame = 0;

                public update(): void {
                    const glen = Game.input.btnMap.KeyG ?? false;
                    this.vis.glitchConfig.enabled = glen;
                    this.vis.postConfig.grain = glen ? 1 : 0.05;
                    this.vis.postConfig.saturation = glen ? 3 : 1;
                    this.vis.bloomConfig.threshold = glen ? 5 : 10;
                    this.vis.postConfig.bloomPower = glen ? 10 : 0.5;
                    this.vis.postConfig.chromaticAberration = glen ? 1 : 0.05;

                    if (Game.time >= this.nextOffset) {
                        this.vis.glitchConfig.offset = Math.floor(
                            Math.random() * 3,
                        );
                        this.nextOffset = Game.time + this.offsetTime;
                    }

                    if (Game.time >= this.nextGlitch) {
                        this.vis.glitchConfig.reroll = true;
                        this.nextGlitch =
                            Game.time +
                            Math.random() *
                                (this.glitchMaxTime - this.glitchMinTime) +
                            this.glitchMinTime;
                    }

                    this.frame++;
                }
            })(),
            "glitchToggle",
        ),
    );

    console.groupCollapsed("scene");
    console.log(scene.tree());
    console.groupEnd();

    console.groupCollapsed("GPU ref counts");
    (Game.gpu as { printRcStats?: () => void }).printRcStats?.();
    console.groupEnd();

    return scene;
}
