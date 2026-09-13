import {
    AssetSrv,
    CameraComponent,
    Game,
    MeshComponent,
    Scene,
    SceneNode,
    ScriptComponent,
} from "@/honda";
import { PbrMaterial } from "@/honda/gpu2";
import { AnimationPlayerScript } from "@/scripts/animplayer.script";
import { quat } from "wgpu-matrix";

export function createTestScene(): Scene {
    const as = Game.ecs.getService(AssetSrv);
    const sc = as.getAsset("summoningcircle");

    const scene = new Scene();
    scene.name = "TestScene";

    {
        const scn = sc.sceneAsNode();
        const scMesh = scn.assertChildComponent(MeshComponent);
        scMesh.castShadow = false;
        const scMat = scMesh.material.asType(PbrMaterial);
        scMat.params.emissionFactor = [4, 0, 0];
        scMat.push();

        scn.transform.translation.set([0, 0.1, 0]);
        scn.transform.update();

        const anim = sc.getAnimation(0);
        anim.attach(scn);
        const ap = new AnimationPlayerScript(anim);
        scn.addComponent(new ScriptComponent(ap));

        scene.addChild(scn);
    }

    {
        const cameraHolder = new SceneNode();

        const camera = new SceneNode();
        camera.name = "Camera";
        camera.transform.translation.set([0, 0, 50]);
        camera.transform.update();
        camera.addComponent(new CameraComponent(NaN, NaN, NaN, "MainCamera"));
        const DEG = Math.PI / 180;

        quat.fromEuler(
            -30 * DEG,
            -45 * DEG,
            0,
            "zyx",
            cameraHolder.transform.rotation,
        );
        cameraHolder.transform.update();

        cameraHolder.addChild(camera);
        scene.addChild(cameraHolder);
    }

    console.groupCollapsed("scene");
    console.log(scene.tree());
    console.groupEnd();

    return scene;
}
