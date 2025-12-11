import { vec2, vec4 } from "wgpu-matrix";
import type { DynamicPhysicsObject, TPhysicsObject } from "./object";
import { objectVsObject, type CollisionManifold } from "./collisions";
import { Material } from "./material";

const STATIC_VEL = vec2.zero();

export class PhysicsWorld {
    private objects = new Map<number, TPhysicsObject>();

    constructor(
        /**
         * Size of each hash grid cell in world units.
         */
        public hashSize: number = 25,
        /**
         * Bitmask of layers this world simulates physics for.
         */
        public layersPhysics: number = 0xffffffff,
    ) {}

    private _hashGrid = new Map<string, Set<TPhysicsObject>>();
    private _pairs = [] as [TPhysicsObject, TPhysicsObject][];
    private _collisions = [] as CollisionManifold[];

    public addObject(obj: TPhysicsObject) {
        this.objects.set(obj.id, obj);
    }

    // debug helper
    public get $hashGrid() {
        return this._hashGrid;
    }

    public getObjects() {
        return this.objects.values();
    }

    public getCollisions() {
        return this._collisions[Symbol.iterator]();
    }

    public clearHashGrid() {
        this._hashGrid.clear();
    }

    public get $nPairs() {
        return this._pairs.length;
    }

    public get $nCollisions() {
        return this._collisions.length;
    }

    public get $nObjects() {
        return this.objects.size;
    }

    /**
     * call `clearHashGrid()` on level changes or every now and then
     */
    private broadphase() {
        const aabb = vec4.create();

        for (const s of this._hashGrid.values()) {
            s.clear(); // clear hash grid cells
        }

        for (const obj of this.objects.values()) {
            obj.shape.getBoundsInto(aabb, obj.position, obj.angle);

            const minX = Math.floor(aabb[0] / this.hashSize);
            const minY = Math.floor(aabb[1] / this.hashSize);
            const maxX = Math.floor(aabb[2] / this.hashSize);
            const maxY = Math.floor(aabb[3] / this.hashSize);

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    const key = `${x},${y}`;
                    let cell = this._hashGrid.get(key);
                    if (!cell) {
                        cell = new Set();
                        this._hashGrid.set(key, cell);
                    }
                    cell.add(obj);
                }
            }
        }

        this._pairs.length = 0;
        for (const cell of this._hashGrid.values()) {
            for (const objA of cell) {
                for (const objB of cell) {
                    if (objA.id >= objB.id) continue; // avoid double checks
                    if (!objA.dynamic && !objB.dynamic) continue; // static-static skip
                    if (
                        (objA.layersOn & objB.layersOn) === 0 &&
                        (objA.layersOn & objB.layersListen) === 0 &&
                        (objB.layersOn & objA.layersListen) === 0
                    )
                        continue; // no common layers

                    this._pairs.push([objA, objB]);
                }
            }
        }
    }

    private narrowphase() {
        this._collisions.length = 0;

        const relativeVel = vec2.create();
        const correction = vec2.create();

        for (const [objA, objB] of this._pairs) {
            const collision = objectVsObject(objA, objB);
            if (!collision) continue;
            this._collisions.push(collision);

            if ((objA.layersOn & objB.layersOn & this.layersPhysics) === 0)
                continue; // no common physics layers

            // seperate bodies -------------------------------------------------------------
            const invMassA = objA.dynamic
                ? (objA as DynamicPhysicsObject)._inverseMass
                : 0;
            const invMassB = objB.dynamic
                ? (objB as DynamicPhysicsObject)._inverseMass
                : 0;
            const invMassSum = invMassA + invMassB;
            if (invMassSum === 0) continue; // both static?

            vec2.scale(
                collision.normal,
                collision.depth / invMassSum,
                correction,
            );

            if (objA.dynamic) {
                const dynA = objA as DynamicPhysicsObject;
                vec2.addScaled(
                    dynA.position,
                    correction,
                    -invMassA,
                    dynA.position,
                );
            }

            if (objB.dynamic) {
                const dynB = objB as DynamicPhysicsObject;
                vec2.addScaled(
                    dynB.position,
                    correction,
                    invMassB,
                    dynB.position,
                );
            }

            // impulse resolution ---------------------------------------------------------
            const restitution = Material.restitution(
                objA.material,
                objB.material,
            );

            vec2.sub(
                objB.dynamic
                    ? (objB as DynamicPhysicsObject).velocity
                    : STATIC_VEL,
                objA.dynamic
                    ? (objA as DynamicPhysicsObject).velocity
                    : STATIC_VEL,
                relativeVel,
            );

            const velAlongNormal = vec2.dot(relativeVel, collision.normal);

            if (velAlongNormal > 0) continue; // separating

            const impulseMag =
                (-(1 + restitution) * velAlongNormal) / invMassSum;

            if (objA.dynamic) {
                const dynA = objA as DynamicPhysicsObject;
                vec2.addScaled(
                    dynA.velocity,
                    collision.normal,
                    -impulseMag * invMassA,
                    dynA.velocity,
                );
            }

            if (objB.dynamic) {
                const dynB = objB as DynamicPhysicsObject;
                vec2.addScaled(
                    dynB.velocity,
                    collision.normal,
                    impulseMag * invMassB,
                    dynB.velocity,
                );
            }
        }
    }

    private integrate(dt: number) {
        const tmp = vec2.create();

        for (const obj of this.objects.values()) {
            if (!obj.dynamic) continue;
            const dynObj = obj as DynamicPhysicsObject;

            // -- force generation --

            // trivial drag force (linear damping)
            const speed = vec2.len(dynObj.velocity);
            if (speed < 0.001) vec2.zero(dynObj.velocity);
            else {
                vec2.addScaled(
                    dynObj._force,
                    dynObj.velocity,
                    -obj.material.drag,
                    dynObj._force,
                );
            }

            // -- all forces added --

            // force into acceleration
            vec2.scale(dynObj._force, dynObj._inverseMass, tmp);

            // integrate velocity
            vec2.addScaled(dynObj.velocity, tmp, dt, dynObj.velocity);

            // integrate position
            vec2.addScaled(
                dynObj.position,
                dynObj.velocity,
                dt,
                dynObj.position,
            );

            // integrate angle (ignore angles for now)
            dynObj.angle += dynObj.angularVelocity * dt;

            // clear forces
            vec2.zero(dynObj._force);
        }
    }

    private internalStep(dt: number) {
        this.integrate(dt);
        this.broadphase();
        this.narrowphase();
    }

    public step(dt: number) {
        this.internalStep(dt);
    }
}
