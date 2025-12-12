import {
    Game,
    SceneNode,
    CameraComponent,
    GltfBinary,
    ScriptComponent,
    Script,
    LightComponent,
} from "@/honda";
import { quat, vec2, vec3 } from "wgpu-matrix";
import { CubemapTexture } from "./honda/gpu/textures/cubemap";
import { setStatus } from "./honda/util/status";
import { nn } from "./honda/util";
import {
    AABBShape,
    CircleShape,
    CopyTransformMode,
    DynamicPhysicsObject,
    FizComponent,
    FizMaterial,
    StaticPhysicsObject,
    CUSTOM_LAYER_OFFSET,
    FIZ_LAYER_PHYS,
    type IFizNotify,
} from "@/honda/systems/fiz";

// basic deadzone
function dz(x: number) {
    return Math.abs(x) < 0.1 ? 0 : x;
}

function aLerp(a: number, b: number, t: number) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + diff * t;
}

const TL_LAYER_PLAYER = 1 << (CUSTOM_LAYER_OFFSET + 0);

const ORIGIN = vec2.create(0, 0);

class PlayerScript extends Script {
    protected angle = 0;
    protected moveBaseVec = vec2.create(0, 0);
    protected ROT = quat.fromEuler(0, -Math.PI / 4, 0, "xyz");

    protected fiz: DynamicPhysicsObject = null!;

    override onAttach(): void {
        this.fiz =
            this.node.assertComponent<FizComponent<DynamicPhysicsObject>>(
                FizComponent,
            ).object;
    }

    override update(): void {
        let boost = false;
        const g = Game.input.activeGamepad;

        if (g) {
            boost = g.buttons[0].pressed;
            this.moveBaseVec[0] = dz(g.axes[0]);
            this.moveBaseVec[1] = dz(g.axes[1]);
        } else {
            boost = Game.input.btnMap.ShiftLeft;
            this.moveBaseVec[0] =
                (Game.input.btnMap.KeyD ? 1 : 0) +
                (Game.input.btnMap.KeyA ? -1 : 0);
            this.moveBaseVec[1] =
                (Game.input.btnMap.KeyW ? -1 : 0) +
                (Game.input.btnMap.KeyS ? 1 : 0);
        }

        // rotate moveBaseVec by 45 degrees on z
        vec2.rotate(this.moveBaseVec, ORIGIN, Math.PI / 4, this.moveBaseVec);

        if (this.moveBaseVec[0] !== 0 || this.moveBaseVec[1] !== 0) {
            const newAngle = Math.atan2(
                this.moveBaseVec[0],
                this.moveBaseVec[1],
            );

            // This is not great... Watch https://www.youtube.com/watch?v=LSNQuFEDOyQ
            this.angle = aLerp(this.angle, newAngle, 0.2);
            quat.fromEuler(
                0,
                this.angle,
                0,
                "xyz",
                this.node.transform.rotation,
            );

            if (vec2.length(this.moveBaseVec) > 1) {
                vec2.normalize(this.moveBaseVec, this.moveBaseVec);
            }

            vec2.mulScalar(
                this.moveBaseVec,
                Game.deltaTime * (boost ? 1500 : 500),
                this.moveBaseVec,
            );

            this.fiz.applyForce(this.moveBaseVec);
        }
    }

    public hurt() {
        console.log("Ouch!");
    }
}

class LerpCameraScript extends Script {
    override update(): void {
        const playerNode = nn(this.node.parent).assertChildWithName("Player");

        // This is not great... Watch https://www.youtube.com/watch?v=LSNQuFEDOyQ
        vec3.lerp(
            this.node.transform.translation,
            playerNode.transform.translation,
            0.1,
            this.node.transform.translation,
        );

        this.node.transform.update();
    }
}

const enum SpikeState {
    Idle = 0,
    Triggering = 1,
    Open = 2,
    Rearming = 3,
}

const TRIGGER_TIME = 0.5;
const OPEN_TIME = 1.0;
const REARM_TIME = 1.0;

class SpikeScript extends Script implements IFizNotify {
    protected state = SpikeState.Idle;
    protected nextStateTime = Infinity;

    override lateUpdate(): void {
        const now = Game.time;

        if (now >= this.nextStateTime) {
            switch (this.state) {
                case SpikeState.Triggering:
                    this.state = SpikeState.Open;
                    this.nextStateTime = now + OPEN_TIME;
                    this.node.transform.translation[1] = 0.1;
                    this.node.transform.update();
                    break;

                case SpikeState.Open:

                    this.state = SpikeState.Rearming;
                    this.nextStateTime = now + REARM_TIME;
                    this.node.transform.translation[1] = 0;
                    this.node.transform.update();
                    break;

                case SpikeState.Rearming:

                    this.state = SpikeState.Idle;
                    this.nextStateTime = Infinity;
                    break;
            }
        }
    }

    onCollision(otherNode: SceneNode): void {
        switch (this.state) {
            case SpikeState.Idle:
                this.state = SpikeState.Triggering;
                this.nextStateTime = Game.time + TRIGGER_TIME;
                break;
            case SpikeState.Open:
                Script.findInstance(otherNode, PlayerScript)?.hurt();
                break;
        }
    }
}

export async function createScene() {
    setStatus("loading assets");
    const level = await GltfBinary.fromUrl("./next.glb");
    const ps = await GltfBinary.fromUrl("./Untitled.glb");
    const sky2 = await CubemapTexture.loadRGBM(
        CubemapTexture.SIDES.map((x) => `hdrsky/${x}.rgbm`),
        "sky2",
        16,
    );

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
                    new AABBShape(2, 2),
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
        player.addChild(ps.sceneAsNode());
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

    console.groupCollapsed("scene");
    console.log(Game.scene.tree());
    console.groupEnd();

    Game.gpu.sky = sky2;
}
