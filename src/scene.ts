import {
    Game,
    SceneNode,
    CameraComponent,
    GltfBinary,
    ScriptComponent,
    Script,
    LightComponent,
} from "@/honda";
import { quat, vec3 } from "wgpu-matrix";
import { CubemapTexture } from "./honda/gpu/textures/cubemap";
import { setStatus } from "./honda/util/status";
import { nn } from "./honda/util";

// basic deadzone
function dz(x: number) {
    return Math.abs(x) < 0.1 ? 0 : x;
}

function aLerp(a: number, b: number, t: number) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + diff * t;
}

class MovementScript extends Script {
    protected angle = 0;
    protected moveBaseVec = vec3.create(0, 0, 0);
    protected ROT = quat.fromEuler(0, -Math.PI / 4, 0, "xyz");

    override update(): void {
        let boost = false;
        const g = Game.input.activeGamepad;

        if (g) {
            boost = g.buttons[0].pressed;
            this.moveBaseVec[0] = dz(g.axes[0]);
            this.moveBaseVec[1] = 0;
            this.moveBaseVec[2] = dz(g.axes[1]);
        } else {
            boost = Game.input.btnMap.ShiftLeft;
            this.moveBaseVec[0] =
                (Game.input.btnMap.KeyD ? 1 : 0) +
                (Game.input.btnMap.KeyA ? -1 : 0);
            this.moveBaseVec[1] = 0;
            this.moveBaseVec[2] =
                (Game.input.btnMap.KeyW ? -1 : 0) +
                (Game.input.btnMap.KeyS ? 1 : 0);
        }

        // rotate moveBaseVec by 45 degrees on z
        vec3.transformQuat(this.moveBaseVec, this.ROT, this.moveBaseVec);

        if (this.moveBaseVec[0] !== 0 || this.moveBaseVec[2] !== 0) {
            const newAngle = Math.atan2(
                this.moveBaseVec[0],
                this.moveBaseVec[2],
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

            if (vec3.length(this.moveBaseVec) > 1) {
                vec3.normalize(this.moveBaseVec, this.moveBaseVec);
            }

            vec3.mulScalar(
                this.moveBaseVec,
                Game.deltaTime * (boost ? 100 : 7),
                this.moveBaseVec,
            );

            vec3.add(
                this.node.transform.translation,
                this.moveBaseVec,
                this.node.transform.translation,
            );
            this.node.transform.update();
        }
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

    const DEG = Math.PI / 180;
    {
        const player = new SceneNode();
        player.name = "Player";
        player.addComponent(new ScriptComponent(new MovementScript()));
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
