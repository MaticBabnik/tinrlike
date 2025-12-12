import type { IComponent } from "@/honda/core/ecs";
import type { TPhysicsObject } from "./object";

export enum CopyTransformMode {
    None,
    PositionXZ,
    All
}

export class FizComponent<T extends TPhysicsObject = TPhysicsObject>
    implements IComponent {

    constructor(
        public object: T,
        public name = `${object.constructor.name}:${object.id}`,
        public copyTransformMode = CopyTransformMode.All,
    ) { }

}
