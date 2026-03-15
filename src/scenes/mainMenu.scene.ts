import {
    Game,
    Scene,
    type SceneFactory,
    Script,
    ScriptComponent,
} from "@/honda";
import MainMenu from "../ui/MainMenu.vue";
import SettingsMenu from "../ui/SettingsMenu.vue";
import type { WGpu } from "@/honda/backends/wg";

export class MenuScript extends Script {
    protected queueNextSceneTime = Infinity;

    constructor(protected f: SceneFactory) {
        super();
    }

    public override onAttach(): void {
        Game.ui.setView(MainMenu, true);
        Game.ui.sendMessage("hello");
    }

    public override update(): void {
        switch (Game.ui.getMessage()) {
            case "play":
                Game.sceneManager.queueScene(this.f);
                Game.ui.setView(undefined);
                break;

            case "settings":
                Game.ui.setView(SettingsMenu, true);

                Game.ui.sendMessage({
                    type: "updateSettings",
                    settings: (Game.gpu2 as WGpu).settings,
                });

                break;

            case "pastRuns":
                console.log("Past Runs clicked");
                break;

            case "menu":
                Game.ui.setView(MainMenu, true);
                break;
        }
    }
}

export function createMainMenuScene(f: SceneFactory) {
    const scene = new Scene();
    scene.name = "MainMenuScene";

    scene.addComponent(new ScriptComponent(new MenuScript(f)));

    return scene;
}
