import type { SceneNode } from "@/honda/core/node";
import { nn } from "..";
import { type ASampler, V3Sampler, V4Sampler } from "./animationsampler";
import type { IAnimtionChannel } from "./gltf.types";

interface IHAnimationChannel {
    node: SceneNode;
    type: "translation" | "rotation" | "scale";
    sampler: ASampler;
}

// TODO: this is fucking terrible; also the name is abit sus
export class HAnimation {
    public length: number;
    private channels: IHAnimationChannel[] = [];

    public constructor(
        public readonly samplers: ASampler[],
        public readonly channelDefs: IAnimtionChannel[],
        public readonly gltfId: number,
        public readonly name = "<unknown animation>",
    ) {
        this.length = samplers
            .map((x) => x.inAcc.accessor.findLast(() => true) ?? 0)
            .reduce((p, c) => Math.max(p, c));
    }

    /**
     *
     * @param gltfIndex Index of node inside the glTF file
     * @param node The node
     */
    public addNode(gltfIndex: number, node: SceneNode) {
        const channels = this.channelDefs.filter(
            (x) => x.target.node === gltfIndex,
        );

        for (const channel of channels) {

            const type = channel.target.path;
            if (
                type !== "translation" &&
                type !== "rotation" &&
                type !== "scale"
            ) {
                return;
            }

            const sampler = nn(
                this.samplers[channel.sampler],
                "sampler not found",
            );

            switch (type) {
                case "translation":
                    if (!(sampler instanceof V3Sampler)) {
                        throw new Error("Translation requires a V3 sampler");
                    } else break;
                case "rotation":
                    if (!(sampler instanceof V4Sampler)) {
                        throw new Error("Rotation requires a V4 sampler");
                    } else break;
                case "scale":
                    if (!(sampler instanceof V3Sampler)) {
                        throw new Error("Scale requires a V3 sampler");
                    } else break;
            }

            this.channels.push({
                node,
                type,
                sampler,
            });
        }
    }

    public attach(n: SceneNode) {
        const gi = n.meta.gltfId;
        if (typeof gi === "number" && gi === this.gltfId) {
            const gni = n.meta.gltfNodeId;
            if (typeof gni === "number") {
                this.addNode(gni, n);
            }
        }
        n.children.forEach((x) => {
            this.attach(x);
        });
    }

    public apply(t: number) {
        this.channels.forEach((x) => {
            switch (x.type) {
                case "translation":
                    (x.sampler as V3Sampler).sampleInto(
                        t,
                        x.node.transform.translation,
                    );
                    break;
                case "rotation":
                    (x.sampler as V4Sampler).sampleInto(
                        t,
                        x.node.transform.rotation,
                        true,
                    );
                    break;
                case "scale":
                    (x.sampler as V3Sampler).sampleInto(
                        t,
                        x.node.transform.scale,
                    );
                    break;
            }

            x.node.transform.update();
        });
    }
}
