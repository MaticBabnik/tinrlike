import { vec2, type Vec2 } from "wgpu-matrix";
import type { TShape } from "./shapes/shape";
import type { Vec2Like } from "./common";
import { FIZ_LAYER_PHYS } from "./layer";
import { FIZ_DEFAULT_MATERIAL, type Material } from "./material";

interface IPhysicsObject {
    readonly id: number;
    dynamic: boolean;

    shape: TShape;
    position: Vec2;
    angle: number;
}

export abstract class PhysicsObjectBase implements IPhysicsObject {
    private static _nextId: number = 0;
    public readonly id: number = PhysicsObjectBase._nextId++;
    public position: Vec2 = vec2.create();

    constructor(
        public readonly dynamic: boolean,
        public shape: TShape,
        position?: Vec2Like,
        public angle: number = 0,
        public layersOn: number = FIZ_LAYER_PHYS,
        public layersListen: number = 0,
        public material: Material = FIZ_DEFAULT_MATERIAL,
    ) {
        if (position) {
            vec2.copy(position, this.position);
        }
    }
}

export class DynamicPhysicsObject extends PhysicsObjectBase {
    public velocity: Vec2 = vec2.create();
    public angularVelocity: number = 0;

    public _force: Vec2 = vec2.create();
    public _inverseMass: number = 1;

    constructor(
        shape: TShape,
        position?: Vec2Like,
        angle: number = 0,
        mass: number = 1,
        layersOn: number = FIZ_LAYER_PHYS,
        layersListen: number = 0,
        material: Material = FIZ_DEFAULT_MATERIAL,
    ) {
        super(true, shape, position, angle, layersOn, layersListen, material);
        this.mass = mass;
    }

    public set mass(m: number) {
        if (m < 0) throw new Error("Mass cannot be negative");
        this._inverseMass = m > 0 ? 1 / m : 0;
    }

    public get mass(): number {
        return this._inverseMass > 0 ? 1 / this._inverseMass : Infinity;
    }

    public applyForce(f: Vec2Like, _point?: Vec2Like): void {
        if (this._inverseMass === 0) return;
        vec2.add(this._force, f, this._force);
    }

    public applyImpulse(i: Vec2Like, _point?: Vec2Like): void {
        if (this._inverseMass === 0) return;
        this.velocity[0] += i[0] * this._inverseMass;
        this.velocity[1] += i[1] * this._inverseMass;
    }
}

export class StaticPhysicsObject extends PhysicsObjectBase {
    constructor(
        shape: TShape,
        position?: Vec2Like,
        angle: number = 0,
        layersOn: number = FIZ_LAYER_PHYS,
        layersListen: number = 0,
        material: Material = FIZ_DEFAULT_MATERIAL,
    ) {
        super(false, shape, position, angle, layersOn, layersListen, material);
    }
}

export type TPhysicsObject = DynamicPhysicsObject | StaticPhysicsObject;
