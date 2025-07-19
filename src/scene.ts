import {
    Game,
    SceneNode,
    CameraComponent,
    GltfBinary,
    ScriptComponent,
    Script,
    LightComponent,
} from "@/honda";
import { clamp, PI_2 } from "@/honda/util";
import { quat, vec3 } from "wgpu-matrix";
import { CubemapTexture } from "./honda/gpu/textures/cubemap";
import { setStatus } from "./honda/util/status";

// basic deadzone
function dz(x: number) {
    return Math.abs(x) < 0.1 ? 0 : x;
}

const sens = 0.005;
const sensGamepad = 0.05;

class FlyCameraScript extends Script {
    protected moveBaseVec = vec3.create(0, 0, 0);
    protected pitch = 0;
    protected yaw = 0;

    override update(): void {
        let boost = false;
        const g = Game.input.activeGamepad;

        if (g) {
            boost = g.buttons[0].pressed;
            this.moveBaseVec[0] = dz(g.axes[0]);
            this.moveBaseVec[1] = 0;
            this.moveBaseVec[2] = dz(g.axes[1]);

            this.pitch = clamp(
                -PI_2,
                this.pitch + dz(g.axes[3]) * -sensGamepad,
                PI_2
            );
            this.yaw += dz(g.axes[2]) * -sensGamepad; // maybe modulo this one?
            quat.fromEuler(
                this.pitch,
                this.yaw,
                0,
                "yxz",
                this.node.transform.rotation
            );
        } else {
            boost = Game.input.btnMap["ShiftLeft"];
            this.moveBaseVec[0] =
                (Game.input.btnMap["KeyD"] ? 1 : 0) +
                (Game.input.btnMap["KeyA"] ? -1 : 0);
            this.moveBaseVec[1] = 0;
            this.moveBaseVec[2] =
                (Game.input.btnMap["KeyW"] ? -1 : 0) +
                (Game.input.btnMap["KeyS"] ? 1 : 0);

            this.pitch = clamp(
                -PI_2,
                this.pitch + Game.input.mouseDeltaY * -sens,
                PI_2
            );
            this.yaw += Game.input.mouseDeltaX * -sens; // maybe modulo this one?
            quat.fromEuler(
                this.pitch,
                this.yaw,
                0,
                "yxz",
                this.node.transform.rotation
            );
        }

        if (this.moveBaseVec[0] != 0 || this.moveBaseVec[2] != 0) {
            if (vec3.length(this.moveBaseVec) > 1) {
                vec3.normalize(this.moveBaseVec, this.moveBaseVec);
            }
            vec3.mulScalar(
                this.moveBaseVec,
                Game.deltaTime * (boost ? 5 : 1),
                this.moveBaseVec
            );

            vec3.transformQuat(
                this.moveBaseVec,
                this.node.transform.rotation,
                this.moveBaseVec
            );

            vec3.add(
                this.node.transform.translation,
                this.moveBaseVec,
                this.node.transform.translation
            );
        }

        this.node.transform.update();
    }
}

export async function createScene() {
    setStatus("loading assets");
    const sponza = await GltfBinary.fromUrl("./SponzaBS.glb");
    const iblTest = await GltfBinary.fromUrl("./IBL2.glb");
    const sky2 = await CubemapTexture.loadRGBM(
        CubemapTexture.SIDES.map((x) => `hdrsky/${x}.rgbm`),
        "sky2",
        16
    );

    setStatus("building scene");

    sponza.json.extensions?.KHR_lights_punctual?.lights.forEach((light) => {
        if (light.intensity) light.intensity /= 50;
    });

    Game.scene.addChild(sponza.sceneAsNode());

    {
        const camera = new SceneNode();
        camera.name = "Player";
        camera.addComponent(new CameraComponent(70, 0.1, 32, "MainCamera"));
        camera.addComponent(new ScriptComponent(new FlyCameraScript()));
        Game.scene.addChild(camera);
        camera.transform.translation[1] = -6;
        camera.transform.update();

        const testNode = iblTest.sceneAsNode();
        testNode.transform.translation[2] = -1;
        testNode.transform.scale.set([0.2, 0.2, 0.2]);
        testNode.transform.update();
        camera.addChild(testNode);
    }

    {
        const roatatingLight = new SceneNode();
        roatatingLight.name = "light";
        roatatingLight.addComponent(
            new LightComponent({
                castShadows: true,
                color: [1, 0, 0],
                intensity: 1000,
                type: "spot",
                innerCone: 0.7,
                outerCone: 0.9,
                maxRange: 10,
            })
        );

        roatatingLight.addComponent(
            new ScriptComponent(
                new (class extends Script {
                    public onAttach(): void {
                        this.node.transform.translation[1] = 4;
                    }

                    public earlyUpdate(): void {
                        quat.fromAxisAngle(
                            [0, 1, 0],
                            Game.time * 4,
                            this.node.transform.rotation
                        );
                        this.node.transform.update();
                    }
                })()
            )
        );

        // Game.scene.addChild(roatatingLight);
    }

    console.groupCollapsed("scene");
    console.log(Game.scene.tree());
    console.groupEnd();

    Game.gpu.sky = sky2;
}
