import { DebugSystem, Game, Script } from "@/honda";
import { vec4 } from "wgpu-matrix";

export class AxesScript extends Script {
    private i = vec4.create(0, 0, 0, 1);
    private r1 = vec4.create(0, 0, 0, 1);
    private r2 = vec4.create(0, 0, 0, 1);

    override lateUpdate(): void {
        const d = Game.ecs.getSystem(DebugSystem);
        Game.scene.computeTransforms();

        this.i.set([0, 0, 0]);
        vec4.transformMat4(this.i, this.node.transform.$glbMtx, this.r1);

        this.i.set([0.1, 0, 0]);
        vec4.transformMat4(this.i, this.node.transform.$glbMtx, this.r2);
        d.line(this.r1, this.r2, [1, 0, 0]);

        this.i.set([0, 0.1, 0]);
        vec4.transformMat4(this.i, this.node.transform.$glbMtx, this.r2);
        d.line(this.r1, this.r2, [0, 1, 0]);

        this.i.set([0, 0, 0.1]);
        vec4.transformMat4(this.i, this.node.transform.$glbMtx, this.r2);
        d.line(this.r1, this.r2, [0, 0, 1]);
    }
}
