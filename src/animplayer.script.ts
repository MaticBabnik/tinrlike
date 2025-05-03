import { Game, Script } from "./honda";
import { HAnimation } from "./honda/util/gltf/animation";

export class AnimationPlayerScript extends Script {
    public constructor(public animation: HAnimation) {
        super();
    }

    public override update(): void {
        this.animation.apply(Game.time % this.animation.length);
    }
}
