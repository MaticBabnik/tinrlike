import {
    Game,
    SceneNode,
    CameraComponent,
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
    MeshComponent,
    Scene,
} from "@/honda";
import { quat } from "wgpu-matrix";
import { AnimationPlayerScript } from "@/scripts/animplayer.script";
import {
    TL_LAYER_ENEMY,
    TL_LAYER_PLAYER,
    TL_LAYER_PLAYER_PROJECTILE,
} from "../constants";
import { PlayerScript } from "../scripts/player.script";
import { LerpCameraScript } from "../scripts/lerpCamera.script";
import { AssetSystem } from "../honda/systems/asset/asset.system";
import { BasicStateMachine } from "../scripts/ai/basicStateMachine";
import GameHud from "@/ui/GameHud.vue";

class UIScript extends Script {
    public override onAttach(): void {
        console.log("Attaching UI Script");
        Game.ui.setView(GameHud, false);
        Game.ui.sendMessage({
            abilities: [
                "It all returns",
                "to nothing",
                "I just keep letting me",
                "down, letting me down",
            ],
        });
    }

    public override update(): void {
        Game.ui.sendMessage({
            health: 6767,
        });
    }
}

export function createScene() {
    const as = Game.ecs.getSystem(AssetSystem);
    const level = as.getAsset("level");
    const sc = as.getAsset("summoningcircle");
    const alpha = as.getAsset("alphatest");

    const scene = new Scene();
    scene.name = "GameScene";
    scene.addComponent(new ScriptComponent(new UIScript()));

    scene.addChild(level.sceneAsNode());

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

        scene.addChild(a);
    }

    // hurt thingy
    {
        // const spikeNode = nn(
        //     scene.findChild((x) => x.name === "floor_tile_big_spikes"),
        // );
        // spikeNode.addComponent(
        //     new FizComponent(
        //         new StaticPhysicsObject(
        //             new AABBShape(1.4, 1.4),
        //             [0, 0],
        //             0,
        //             0,
        //             TL_LAYER_PLAYER,
        //         ),
        //         "HurtZone",
        //         CopyTransformMode.PositionXZ,
        //     ),
        // );
        // spikeNode.addComponent(new ScriptComponent(new SpikeScript()));
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

        const hatsunefuckingmiku = as
            .getAsset("hatsunefuckingmiku")
            .sceneAsNode();

        hatsunefuckingmiku.transform.scale.fill(0.2);
        quat.fromEuler(
            0,
            (-1 * Math.PI) / 4,
            0,
            "xyz",
            hatsunefuckingmiku.transform.rotation,
        );
        hatsunefuckingmiku.transform.update();

        player.addChild(hatsunefuckingmiku);

        {
            const n = new SceneNode();
            n.name = "testLight";
            n.transform.translation.set([0, 1, 0]);
            n.transform.update();

            n.addComponent(
                new LightComponent({
                    type: "point",
                    color: [1, 0, 1],
                    intensity: 5,
                    maxRange: 10,
                    castShadows: false,
                }),
            );

            player.addChild(n);
        }

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

    {
        const sun = new SceneNode();

        sun.name = "sun";
        sun.addComponent(
            new LightComponent({
                castShadows: false,
                color: [1, 0.953, 0.871],
                intensity: 2,
                type: "directional",
                maxRange: 20,
            }),
        );

        sun.transform.rotation = quat.fromEuler(-65, -45, 0, "xyz");
        sun.transform.update();

        scene.addChild(sun);
    }

    scene.addComponent(
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

    {
        const scn = sc.sceneAsNode();
        const scMesh = scn.assertChildComponent(MeshComponent);
        scMesh.castShadow = false;
        scMesh.material.emissionFactor = [4, 0, 0];
        scMesh.material.push();

        scn.transform.translation.set([0, 0.1, 0]);
        scn.transform.update();

        const anim = sc.getAnimation(0);
        anim.attach(scn);
        const ap = new AnimationPlayerScript(anim);
        scn.addComponent(new ScriptComponent(ap));

        // scene.addChild(scn);
    }

    {
        const enemy1 = new SceneNode();
        enemy1.name = "Enemy1";
        enemy1.transform.translation.set([-5, 0, -5]);
        enemy1.transform.update();

        const eg = as.getAsset("enemyGeneric");
        const egNode = eg.sceneAsNode();

        enemy1.addChild(egNode);

        enemy1.addComponent(
            new FizComponent(
                new DynamicPhysicsObject(
                    new CircleShape(0.5),
                    [-5, -5],
                    0,
                    0.1,
                    FIZ_LAYER_PHYS | TL_LAYER_ENEMY,
                    TL_LAYER_PLAYER_PROJECTILE,
                    new FizMaterial(0.1, 0.6),
                ),
                "Enemy1",
                CopyTransformMode.PositionXZ,
            ),
        );

        enemy1.addComponent(new ScriptComponent(new BasicStateMachine()));

        scene.addChild(enemy1);
    }

    for (let i = 0; i < 3; i++) {
        const an = alpha.sceneAsNode();

        an.name = `Alpha ${i}`;
        an.transform.translation[0] = i * 2;
        an.transform.translation[1] = 1;
        an.transform.scale.set([0.5, 0.5, 0.5]);
        an.transform.update();

        an.addComponent(
            new ScriptComponent(
                new (class extends Script {
                    public update(): void {
                        quat.fromAxisAngle(
                            [0, 1, 0],
                            Game.time * 0.5,
                            this.node.transform.rotation,
                        );
                        this.node.transform.update();
                    }
                })(),
            ),
        );

        scene.addChild(an);
    }

    {
        const spheres = as.getAsset("spheres").sceneAsNode();
        spheres.transform.scale.fill(0.5);
        quat.fromEuler(
            0,
            (-3 * Math.PI) / 4,
            0,
            "xyz",
            spheres.transform.rotation,
        );
        spheres.transform.update();

        scene.addChild(spheres);
    }

    {
        const hatsunefuckingmiku = as
            .getAsset("hatsunefuckingmiku")
            .sceneAsNode();

        hatsunefuckingmiku.transform.scale.fill(0.3);
        quat.fromEuler(
            0,
            (-1 * Math.PI) / 4,
            0,
            "xyz",
            hatsunefuckingmiku.transform.rotation,
        );
        hatsunefuckingmiku.transform.update();

        scene.addChild(hatsunefuckingmiku);
    }

    console.groupCollapsed("scene");
    console.log(scene.tree());
    console.groupEnd();

    console.groupCollapsed("GPU ref counts");
    (Game.gpu2 as { printRcStats?: () => void }).printRcStats?.();
    console.groupEnd();

    return scene;
}
