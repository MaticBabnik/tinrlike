import { nn, Script } from "@/honda";
import { vec3 } from "wgpu-matrix";

export class LerpCameraScript extends Script {
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
