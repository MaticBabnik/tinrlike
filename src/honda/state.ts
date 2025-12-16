/** biome-ignore-all lint/style/noNonNullAssertion: this object is only safe to use after init */

import type { WebGpu } from "./gpu";
import type { Input } from "./util/input";
import { Perf } from "./util/perf";
import GUI from "muigui";
import type { Flags } from "./util/flags";
import { ECS } from "./core/ecs";
import { Scene } from "./core/scene";
import type { IPass } from "./gpu/passes";

export const Game = {
    ecs: new ECS(),

    //TODO(mbabnik): Scene management?
    scene: new Scene(),

    // TODO(mbabnik): Be specifica about when this is set/valid/...
    time: 0,
    deltaTime: 0,

    // TODO(mbabnik): Make into a Renderer class
    gpu: null! as WebGpu,
    input: null! as Input,
    cmdEncoder: null! as GPUCommandEncoder,

    // TODO(mbabnik): Remove
    gui: new GUI(),
    perf: new Perf(),

    // TODO(mbabnik): Remove
    flags: new Set<Flags>(),

    // TODO(mbabnik): Move to Renderer class
    passes: [] as IPass[],
};

//@ts-expect-error expose state to the console
window.Game = Game;
