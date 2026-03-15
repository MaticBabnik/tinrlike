import { Scene } from "./scene";

const DEFAULT_SCENE = new Scene();
DEFAULT_SCENE.name = "DEFAULT_SCENE";

export type SceneFactory = () => Scene;

export class SceneManager {
    private _scene: Scene = DEFAULT_SCENE;
    private _switchToScene: SceneFactory | null = null;

    public get scene(): Scene {
        return this._scene;
    }
    
    public queueScene(s: SceneFactory) {
        this._switchToScene = s;
    }

    public switchPoint() {
        if (this._switchToScene) {
            this._scene.deactivate();
            this._scene = this._switchToScene();
            this._scene.activate();
            this._switchToScene = null;
        }
    }
}
