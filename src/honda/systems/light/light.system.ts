import { LightComponent } from "./light.component";
import { System } from "@/honda/core/ecs";
import type { SceneNode } from "@/honda/core/node";


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
