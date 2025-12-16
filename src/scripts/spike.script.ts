import { TL_LAYER_PLAYER } from "@/constants";
import { AABBShape, FizSystem, Game, type IFizNotify, Script } from "@/honda";
import { PlayerScript } from "./player.script";

// biome-ignore lint/suspicious/noConstEnum: Only used in this file
const enum SpikeState {
    Idle = 0,
    Triggering = 1,
    Open = 2,
    Rearming = 3,
}

const TRIGGER_TIME = 0.5;
const OPEN_TIME = 1.0;
const REARM_TIME = 1.0;

const spikeHurtShape = new AABBShape(1.2, 1.2);

export class SpikeScript extends Script implements IFizNotify {
    protected state = SpikeState.Idle;
    protected nextStateTime = Infinity;
    protected fiz: FizSystem = null!;

    override onAttach(): void {
        this.fiz = Game.ecs.getSystem(FizSystem);
    }

    override update(): void {
        const now = Game.time;

        if (this.state === SpikeState.Open) {
            this.fiz.collisionQuery(
                spikeHurtShape,
                this.node.transform.translation,
                0,
                TL_LAYER_PLAYER,
                (obj) => {
                    Script.findInstance(obj, PlayerScript)?.hurt();
                },
            );
        }

        if (now >= this.nextStateTime) {
            switch (this.state) {
                case SpikeState.Triggering:
                    this.state = SpikeState.Open;
                    this.nextStateTime = now + OPEN_TIME;
                    this.node.transform.translation[1] = 0.1;
                    this.node.transform.update();
                    break;

                case SpikeState.Open:
                    this.state = SpikeState.Rearming;
                    this.nextStateTime = now + REARM_TIME;
                    this.node.transform.translation[1] = 0;
                    this.node.transform.update();
                    break;

                case SpikeState.Rearming:
                    this.state = SpikeState.Idle;
                    this.nextStateTime = Infinity;
                    break;
            }
        }
    }

    onCollision(): void {
        switch (this.state) {
            case SpikeState.Idle:
                this.state = SpikeState.Triggering;
                this.nextStateTime = Game.time + TRIGGER_TIME;
                break;
            case SpikeState.Open:
                break;
        }
    }
}
