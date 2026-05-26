import type { IComponent } from "./component";
import type { SceneNode } from "./node";

export abstract class System {
    public abstract componentType: new (
        ...args: never[]
    ) => IComponent;

    public earlyUpdate() {}
    public update() {}
    public lateUpdate() {}
    public fixedUpdate?() {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public componentCreated(_node: SceneNode, _component: IComponent): void {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public componentDestroyed(_node: SceneNode, _component: IComponent): void {}
}
