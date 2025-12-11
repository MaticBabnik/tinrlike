import type { THondaLight } from "./lights.interface";
import type { IComponent } from "@/honda/core/ecs";

export class LightComponent implements IComponent {
    constructor(
        public lightInfo: THondaLight,
        public name = `${lightInfo.type}Light`,
    ) {
        if (this.lightInfo.castShadows && this.lightInfo.type === "point") {
            console.warn("pointlights don't support castShadows");
        }
    }
}
