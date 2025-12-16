import type { SceneNode } from "../core/node";
import { type Script, ScriptComponent } from "../systems";

export function applyScriptToAllNodes<T extends Script>(
    n: SceneNode,
    sctor: new () => T,
) {
    n.addComponent(new ScriptComponent(new sctor()));

    for (const c of n.children) {
        applyScriptToAllNodes(c, sctor);
    }
}
