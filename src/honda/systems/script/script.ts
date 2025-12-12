import type { SceneNode } from "@/honda";
import { ScriptComponent } from "./script.component";

/* eslint-disable class-methods-use-this */
export abstract class Script {
    private _node!: SceneNode;

    public get node(): SceneNode {
        if (!this._node) {
            throw new Error("Node accesed when Script unnatached");
        }
        return this._node;
    }

    public earlyUpdate() {}
    public update() {}
    public lateUpdate() {}

    public onDetach() {}
    public onAttach() {}

    public static findInstance<T extends Script>(
        node: SceneNode,
        scriptCtor: new (...args: never[]) => T,
    ): T | undefined {
        for (const comp of node.components) {
            if (comp instanceof ScriptComponent) {
                if (comp.script instanceof scriptCtor) {
                    return comp.script as T;
                }
            }
        }
        return undefined;
    }

    public static assertInstance<T extends Script>(
        node: SceneNode,
        scriptCtor: new (...args: never[]) => T,
    ): T {
        const inst = Script.findInstance(node, scriptCtor);
        if (!inst) {
            throw new Error(
                `Script of type ${scriptCtor.name} not found on node ${node.name}`,
            );
        }
        return inst;
    }
}
