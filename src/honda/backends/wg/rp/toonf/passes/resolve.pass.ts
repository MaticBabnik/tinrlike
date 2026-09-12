import type { WGpu } from "../../../gpu";
import type { IMultiSamplable, ITViewable } from "../../../texture";
import type { IPass } from "../../common/passes/pass.interface";

/**
 * To be able to deal with msaa targets in a clean way, we have an explicit resolve pass
 * that gets added to the graph when msaa is enabled.
 *
 * The resolve pass just sets a resolve target and finishes.
 *
 * It could be folded into main but then you have to figure out the last pass there.
 * Also main pass is already the most disgusting one CPU code-wise.
 */
export class ResolvePass implements IPass {
    public constructor(
        private g: WGpu,
        private from: ITViewable & IMultiSamplable,
        private to: ITViewable,
    ) {}

    public apply(): void {
        this.g.cmdEncoder
            .beginRenderPass({
                label: "resolve",
                colorAttachments: [
                    {
                        view: this.from.view,
                        resolveTarget: this.to.view, // if this errors out I will kill myself
                        loadOp: "load",
                        storeOp: "discard",
                    },
                ],
                timestampWrites: this.g.timestamp("resolve"),
            })
            .end();
    }
}
