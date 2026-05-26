import { LightComponent } from "./light.component";
import { hsym, System, type SceneNode } from "@/honda/core/ecs";

export class LightSystem extends System {
    public componentType = LightComponent;

    protected components = new Map<LightComponent, SceneNode>();

    public get $components() {
        return this.components.entries();
    }

    public componentCreated(node: SceneNode, comp: LightComponent) {
        if (this.components.delete(comp)) {
            console.warn("moved component to new node", comp, node);
        }
        this.components.set(comp, node);
    }

    public componentDestroyed(_: SceneNode, comp: LightComponent) {
        this.components.delete(comp);
    }

    public lateUpdate(): void {}
}

export const LightSys = hsym<LightSystem>("light");
