import { Game } from "@/honda/state";
import type { IPass } from "../pass.interface";

export class SkyPass implements IPass {
    public constructor(public color: GPUColor = [0.7, 1, 2, 1]) {}

    apply(): void {
        const post = Game.cmdEncoder.beginRenderPass({
            label: "sky",
            colorAttachments: [
                {
                    view: Game.gpu.textures.shaded.view,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: this.color,
                },
            ],
        });

        post.end();
    }
}
