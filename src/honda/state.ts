/** biome-ignore-all lint/style/noNonNullAssertion: this object is only safe to use after init */

import type { Input } from "./util/input";
import { Perf } from "./util/perf";
import { ECS } from "./core/ecs";
import type { IGPUImplementation } from "./gpu2";
import { SceneManager } from "./core/sceneManager";
import type { UIManager } from "./ui/ui";

export const Game = {
    ecs: new ECS(),

    sceneManager: new SceneManager(),

    // TODO(mbabnik): Be specific about when this is set/valid/...
    time: 0,
    deltaTime: 0,

    // chronos: new 

    input: null! as Input,
    cmdEncoder: null! as GPUCommandEncoder,

    perf: new Perf(),

    gpu2: null! as IGPUImplementation,

    ui: null! as UIManager,
};

//@ts-expect-error expose state to the console
window.Game = Game;
