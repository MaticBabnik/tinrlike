/** biome-ignore-all lint/style/noNonNullAssertion: this object is only safe to use after init */

import type { Input } from "./util/input";
import { Perf } from "./util/perf";
import { ECS } from "./core/ecs";
import { Scene } from "./core/scene";
import type { IGPUImplementation } from "./gpu2";

export const Game = {
    ecs: new ECS(),

    //TODO(mbabnik): Scene management?
    scene: new Scene(),

    // TODO(mbabnik): Be specifica about when this is set/valid/...
    time: 0,
    deltaTime: 0,

    input: null! as Input,
    cmdEncoder: null! as GPUCommandEncoder,

    perf: new Perf(),

    gpu2: null! as IGPUImplementation,
};

//@ts-expect-error expose state to the console
window.Game = Game;
