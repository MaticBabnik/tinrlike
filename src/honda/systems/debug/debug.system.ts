import { BasicTexture } from "@/honda/gpu/textures";
import debugUrl from "./DevSprites.png";
import { createTextureFromImage } from "webgpu-utils";
import { Game } from "@/honda/state";
import { System } from "@/honda/core/ecs";

export class DebugSystem implements System {
    public componentType = class {
        public name = "nop";
    };

    private sprites?: BasicTexture;
    private attemptedFetch = false;
    private _showSprites = false;

    public set showSprites(v: boolean) {
        if (v && !this.attemptedFetch) {
            this.attemptedFetch = true;

            console.info("Loading debug sprites");

            DebugSystem.loadDebugSprites(Game.gpu.device)
                .then((x) => {
                    this.sprites = x;
                })
                .catch((x) => {
                    console.warn("Cannot show debug sprites:", x);
                });
        }

        this._showSprites = v;
    }

    public get showSprites() {
        return this._showSprites;
    }

    private static async loadDebugSprites(g: GPUDevice) {
        const textrue = await createTextureFromImage(g, debugUrl, {
            mips: true,
            format: "rgba8unorm-srgb",
        });

        return new BasicTexture(textrue);
    }

    // eslint-disable-next-line class-methods-use-this
    public earlyUpdate(): void {}

    // eslint-disable-next-line class-methods-use-this
    public update(): void {}

    // eslint-disable-next-line class-methods-use-this
    public lateUpdate(): void {}

    // eslint-disable-next-line class-methods-use-this
    public componentCreated(): void {}

    // eslint-disable-next-line class-methods-use-this
    public componentDestroyed(): void {}
}
