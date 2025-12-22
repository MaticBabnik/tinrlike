import {
    type DynamicPhysicsObject,
    FizComponent,
    Game,
    nn,
    Script,
    type SkinnedMeshComponent,
} from "@/honda";
import type { IGPUMat } from "@/honda/gpu2";
import { vec2, quat } from "wgpu-matrix";

const ORIGIN = vec2.create(0, 0);

function dz(x: number) {
    return Math.abs(x) < 0.1 ? 0 : x;
}

function aLerp(a: number, b: number, t: number) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + diff * t;
}

export class PlayerScript extends Script {
    protected angle = 0;
    protected moveBaseVec = vec2.create(0, 0);
    protected ROT = quat.fromEuler(0, -Math.PI / 4, 0, "xyz");

    protected fiz: DynamicPhysicsObject = null!;

    protected material!: IGPUMat;

    override onAttach(): void {
        this.fiz =
            this.node.assertComponent<FizComponent<DynamicPhysicsObject>>(
                FizComponent,
            ).object;

        const cube = this.node.findChild((x) => x.name === "Cube");
        const mesh = cube?.components.find(
            (x) => x.name === "skinnedMesh0.prim0",
        ) as SkinnedMeshComponent;

        this.material = nn(mesh.material);
    }

    override update(): void {
        let boost = false;
        const g = Game.input.activeGamepad;

        this.material.colorFactor[0] = Math.abs(Math.sin(Game.time));
        this.material.push();

        if (g) {
            boost = g.buttons[0].pressed;
            this.moveBaseVec[0] = dz(g.axes[0]);
            this.moveBaseVec[1] = dz(g.axes[1]);
        } else {
            boost = Game.input.btnMap.ShiftLeft;
            this.moveBaseVec[0] =
                (Game.input.btnMap.KeyD ? 1 : 0) +
                (Game.input.btnMap.KeyA ? -1 : 0);
            this.moveBaseVec[1] =
                (Game.input.btnMap.KeyW ? -1 : 0) +
                (Game.input.btnMap.KeyS ? 1 : 0);
        }

        // rotate moveBaseVec by 45 degrees on z
        vec2.rotate(this.moveBaseVec, ORIGIN, Math.PI / 4, this.moveBaseVec);

        if (this.moveBaseVec[0] !== 0 || this.moveBaseVec[1] !== 0) {
            const newAngle = Math.atan2(
                this.moveBaseVec[0],
                this.moveBaseVec[1],
            );

            // This is not great... Watch https://www.youtube.com/watch?v=LSNQuFEDOyQ
            this.angle = aLerp(this.angle, newAngle, 0.2);
            quat.fromEuler(
                0,
                this.angle,
                0,
                "xyz",
                this.node.transform.rotation,
            );

            if (vec2.length(this.moveBaseVec) > 1) {
                vec2.normalize(this.moveBaseVec, this.moveBaseVec);
            }

            vec2.mulScalar(
                this.moveBaseVec,
                Game.deltaTime * (boost ? 1500 : 500),
                this.moveBaseVec,
            );

            this.fiz.applyForce(this.moveBaseVec);
        }
    }

    public hurt() {
        console.log("Ouch!");
    }
}
