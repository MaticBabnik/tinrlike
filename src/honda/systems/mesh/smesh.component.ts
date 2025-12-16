import type { Material, Mesh, SceneNode } from "@/honda";
import type { IComponent } from "@/honda/core/ecs";
import type { SkinInfo } from "./skin";
import { mat4, type Mat4 } from "wgpu-matrix";

// snipers on the roof, please kill me if I lose
// RIP bozo Charlie Kirk

const IDENT = mat4.identity();

export class SkinnedMeshComponent implements IComponent {
    public boneMatrices: Float32Array;

    constructor(
        public primitive: Mesh,
        public material: Material,
        public skin: SkinInfo, // bladee reference

        public name: string = `unknownSkinnedMeshComponent`,
    ) {
        this.boneMatrices = new Float32Array(skin.joints.length * 16);
    }

    /**
     * Updates the bone matrices for the skinned mesh
     * will check for all required bones in the scene node hierarchy
     */
    public updateBoneMatrices(node: SceneNode) {
        if (!node.parent) {
            console.warn("skinned mesh has no parent node!", this, node);
            return;
        }

        this.bonez(IDENT, node.parent);
    }

    /**
     * Horrible recursive function to fetch bone matrices
     */
    private bonez(t: Mat4, n: SceneNode) {
        for (const c of n.children) {
            const gltfId = c.meta.gltfId as number | undefined;
            const gltfNodeId = c.meta.gltfNodeId as number | undefined;

            // only skin nodes that belong to this skin
            if (gltfId === undefined || gltfNodeId === undefined) {
                continue;
            }
            // skip nodes that don't belong to this skin
            if (gltfId !== this.skin.gltfId) {
                continue;
            }

            // make sure local matrix is up to date
            c.transform.materialize();
            // compute current node's model local matrix
            const ct = mat4.mul(t, c.transform.localMatrix);

            // are we a joint?
            const jointIdx = this.skin.joints.indexOf(gltfNodeId);
            if (jointIdx !== -1) {
                // compute final bone matrix
                const ibm = this.skin.inverseBindMatrices.subarray(
                    jointIdx * 16,
                    (jointIdx + 1) * 16,
                );

                const r = this.boneMatrices.subarray(
                    jointIdx * 16,
                    (jointIdx + 1) * 16,
                );

                mat4.mul(ct, ibm, r);

            }

            // recurse into children
            this.bonez(ct, c);
        }
    }
}
