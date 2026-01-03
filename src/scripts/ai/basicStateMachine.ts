import {
    DebugSystem,
    DynamicPhysicsObject,
    FizComponent,
    Game,
    SceneNode,
    Script,
} from "@/honda";
import { vec2, vec3 } from "wgpu-matrix";

const enum State {
    Idle,
    Follow,
}

export class BasicStateMachine extends Script {
    private detectionRadius: number = 3.5;
    private player!: SceneNode;
    private currentState: State = State.Idle;
    private dSystem: DebugSystem = null!;
    private fiz!: DynamicPhysicsObject;
    private moveBaseVec = vec2.create(0, 0);

    public onAttach(): void {
        this.dSystem = Game.ecs.getSystem(DebugSystem);
        this.player = Game.scene.assertChildWithName("Player");
        this.fiz = this.node.assertComponent(FizComponent)
            .object as DynamicPhysicsObject;
    }

    private idleTick() {
        const distance = vec3.distance(
            this.node.transform.translation,
            this.player.transform.translation
        );

        if (distance < this.detectionRadius) {
            this.currentState = State.Follow;
        }
    }

    private followTick() {
        const distance = vec3.distance(
            this.node.transform.translation,
            this.player.transform.translation
        );

        if (distance >= this.detectionRadius + 2) {
            this.currentState = State.Idle;
            return;
        }

        if (distance > 1.2) {
            this.moveBaseVec[0] =
                this.player.transform.translation[0] -
                this.node.transform.translation[0];
            this.moveBaseVec[1] =
                this.player.transform.translation[2] -
                this.node.transform.translation[2];

            if (vec2.length(this.moveBaseVec) > 1) {
                vec2.normalize(this.moveBaseVec, this.moveBaseVec);
            }

            vec2.mulScalar(
                this.moveBaseVec,
                Game.deltaTime * 500,
                this.moveBaseVec
            );

            this.fiz.applyForce(this.moveBaseVec);
        }
    }

    public update(): void {
        switch (this.currentState) {
            case State.Idle: {
                this.idleTick();

                this.dSystem.circle2d(
                    [
                        this.node.transform.translation[0],
                        this.node.transform.translation[2],
                    ],
                    this.detectionRadius,
                    [1, 0, 0, 1]
                );

                break;
            }

            case State.Follow: {
                this.followTick();

                this.dSystem.line(
                    this.node.transform.translation,
                    this.player.transform.translation,
                    [1, 0, 0, 1]
                );

                break;
            }
        }
    }
}
