import { mat4 } from "wgpu-matrix";
import { SceneNode } from "./node";

function updateTransforms(n: SceneNode) {
    n.children.forEach((x) => {
        x.transform.$updateGlobal(n.transform);
        updateTransforms(x);
    });
}

export class Scene extends SceneNode {
    constructor() {
        super();
        this.name = "Scene";

        mat4.identity(this.transform.$glbMtx);
        mat4.identity(this.transform.$glbInvMtx);
    }

    public computeTransforms() {
        updateTransforms(this);
    }

    protected _active = false;

    protected override isNodeInScene(): boolean {
        return this._active;
    }

    public activate() {
        this._active = true;
        this.attachComponents();
    }

    public deactivate() {
        this._active = false;
        this.detachComponents();
    }
}
