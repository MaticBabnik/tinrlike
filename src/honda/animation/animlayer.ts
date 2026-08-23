import { quat, vec3, type Quat, type Vec3 } from "wgpu-matrix";
import type { SceneNode } from "../core/ecs";
import { assert } from "../util";
import type { V4Sampler, ASampler, V3Sampler } from "./animationsampler";
import type { IAnimtionChannel } from "../util/gltf/gltf.types";

export class AnimationLayerDef {
    public readonly n: number;
    public readonly nodeIdToJoint: Map<number, number>;
    public readonly jointsByName: Map<string, number>;

    public constructor(
        public readonly fileId: number,
        public readonly rootNodeId: number,

        public readonly joints: number[],
        names: readonly (string | undefined)[],
    ) {
        this.n = joints.length;
        this.nodeIdToJoint = new Map(joints.map((nodeId, i) => [nodeId, i]));
        this.jointsByName = new Map(
            joints.map((nodeId, i) => [names[i] ?? `<joint_${nodeId}>`, i]),
        );
    }
}

const enum ATType {
    T = 1,
    R = 2,
    S = 4,
}

export class AnimationLayer {
    public weight: number = 1;
    public boneWeights: number[];
    public boneMask: number[];
    public layerTranslations: Vec3[];
    public layerScales: Vec3[];
    public layerRotations: Quat[];
    public readonly n: number;

    public constructor(
        public readonly name: string,
        public readonly def: AnimationLayerDef,
    ) {
        this.n = def.n;
        this.boneWeights = def.joints.map(() => 1);
        this.boneMask = def.joints.map(() => ATType.T | ATType.R | ATType.S);

        // how many bytes for translation/rotation/scale of all joints
        const transformSize = 4 * 4; // aligned vec3<f32> & vec4<f32>
        const transformGroupSize = transformSize * this.n;

        // allocate a single buffer for all translations, rotations and scales
        const t = new ArrayBuffer(transformGroupSize * 3);

        const tBase = 0;
        const rBase = transformGroupSize;
        const sBase = transformGroupSize * 2;

        this.layerTranslations = def.joints.map(
            (_, i) => new Float32Array(t, tBase + i * transformSize, 3) as Vec3,
        );

        this.layerRotations = def.joints.map(
            (_, i) => new Float32Array(t, rBase + i * transformSize, 4) as Quat,
        );

        this.layerScales = def.joints.map(
            (_, i) => new Float32Array(t, sBase + i * transformSize, 3) as Vec3,
        );

        this.identity();
    }

    public identity() {
        for (let i = 0; i < this.n; i++) {
            this.layerTranslations[i].set([0, 0, 0]);
            this.layerRotations[i].set([0, 0, 0, 1]);
            this.layerScales[i].set([1, 1, 1]);
        }
    }
}

export class AnimationLayerStack<TAnimKeys extends string = string> {
    public layers: Map<TAnimKeys, AnimationLayer>;

    private nodeLut?: SceneNode[];

    public constructor(
        public def: AnimationLayerDef,
        public layerNames: readonly TAnimKeys[],
    ) {
        this.layers = new Map(
            layerNames.map(
                (name) => [name, new AnimationLayer(name, def)] as const,
            ),
        );
    }

    private _attachNode(lut: SceneNode[], n: SceneNode) {
        const gi = n.meta.gltfId;

        // if the node isn't from the same glTF file, skip it
        if (typeof gi !== "number" || gi !== this.def.fileId) return;

        const gni = n.meta.gltfNodeId;
        if (typeof gni === "number") {
            const jointIndex = this.def.nodeIdToJoint.get(gni);

            // if the node matches a joint, add it to the lut
            if (jointIndex !== undefined) {
                lut[jointIndex] = n;
            }
        }

        // walk the children
        n.children.forEach((x) => {
            this._attachNode(lut, x);
        });
    }

    /**
     * Build a lookup table for mapping glTF skin indices to scene nodes.
     * @param root
     */
    public attach(root: SceneNode) {
        const newNodeLut = Array<SceneNode>(this.def.joints.length);

        this._attachNode(newNodeLut, root);

        assert(
            newNodeLut.every((n) => n !== undefined),
            "Missing nodes",
        );
        this.nodeLut = newNodeLut;
    }

    public detach() {
        this.nodeLut = undefined;
    }

    private _scratchT = vec3.create();
    private _scratchR = quat.create();
    private _scratchS = vec3.create();

    public apply() {
        if (!this.nodeLut) {
            console.warn(
                "Trying to apply animation layer stack without attaching it to a scene node",
            );
            return;
        }

        const stra = this._scratchT;
        const srot = this._scratchR;
        const ssca = this._scratchS;

        for (let i = 0; i < this.def.n; i++) {
            const node = this.nodeLut[i];
            if (!node) continue;

            let awT = 0,
                awR = 0,
                awS = 0;
            let bT = false,
                bR = false,
                bS = false;

            for (const layer of this.layers.values()) {
                const w = layer.weight * layer.boneWeights[i];
                const m = layer.boneMask[i];
                if (w <= 0) continue;

                if (m & ATType.T)
                    if (!bT) {
                        vec3.copy(layer.layerTranslations[i], stra);
                        bT = true;
                        awT = w;
                    } else {
                        const t = w / (awT + w);
                        vec3.lerp(stra, layer.layerTranslations[i], t, stra);
                        awT += w;
                    }

                if (m & ATType.R)
                    if (!bR) {
                        quat.copy(layer.layerRotations[i], srot);
                        bR = true;
                        awR = w;
                    } else {
                        const t = w / (awR + w);
                        quat.slerp(srot, layer.layerRotations[i], t, srot);
                        awR += w;
                    }

                if (m & ATType.S)
                    if (!bS) {
                        vec3.copy(layer.layerScales[i], ssca);
                        bS = true;
                        awS = w;
                    } else {
                        const t = w / (awS + w);
                        vec3.lerp(ssca, layer.layerScales[i], t, ssca);
                        awS += w;
                    }
            }

            if (bT) node.transform.translation.set(stra);
            if (bR) node.transform.rotation.set(srot);
            if (bS) node.transform.scale.set(ssca);

            node.transform.update();
        }
    }
}

type HA2Channel = {
    /**
     * Joint index
     */
    jid: number;
    /**
     * Sample type
     */
    type: ATType;
    /**
     * Target vector/quat
     */
    target: Vec3 | Quat;
    /**
     * Sampler providing the animation data
     */
    sampler: V3Sampler | V4Sampler;
};

type ValidSamplerTName = "translation" | "rotation" | "scale";

const TYPE_MAP: Record<ValidSamplerTName, ATType> = {
    translation: ATType.T,
    rotation: ATType.R,
    scale: ATType.S,
};

export class HAnim2Clip {
    public length: number;

    constructor(
        public readonly fileId: number,
        public readonly name = "<unknown animation>",
        public readonly samplers: ASampler[],
        public readonly channelDefs: IAnimtionChannel[],
    ) {
        this.length = samplers
            .map((x) => x.inAcc.accessor.at(-1) ?? 0)
            .reduce((p, c) => Math.max(p, c));
    }
}

export class HAnim2LayerDriver {
    public activeLayer?: AnimationLayer;
    public channels?: HA2Channel[];

    public constructor(public readonly clip: HAnim2Clip) {}

    public attach(l: AnimationLayer) {
        this.channels = [];

        for (const channelDef of this.clip.channelDefs) {
            if (channelDef.target.node === undefined) continue;
            if (!(channelDef.target.path in TYPE_MAP)) continue;

            const type = TYPE_MAP[channelDef.target.path as ValidSamplerTName];

            const jid = l.def.nodeIdToJoint.get(channelDef.target.node);
            if (jid === undefined) {
                console.warn(
                    `Animation channel targets node ${channelDef.target.node} which is not in the layer's definition`,
                    this.clip,
                    l,
                );
                continue;
            }

            const sampler = this.clip.samplers[channelDef.sampler];

            let targetArray: (Vec3 | Quat)[];

            switch (type) {
                case ATType.T:
                    targetArray = l.layerTranslations;
                    assert(
                        sampler.N === 3,
                        "Translation sampler must have 3 output components",
                    );
                    break;
                case ATType.S:
                    targetArray = l.layerScales;
                    assert(
                        sampler.N === 3,
                        "Scale sampler must have 3 output components",
                    );
                    break;
                case ATType.R:
                    targetArray = l.layerRotations;
                    assert(
                        sampler.N === 4,
                        "Rotation sampler must have 4 output components",
                    );
                    break;

                default: //unreachable
                    throw new Error("Invalid sampler type");
            }

            this.channels.push({
                jid,
                type,
                target: targetArray[jid],
                sampler: sampler as V3Sampler | V4Sampler,
            });
        }
        this.activeLayer = l;
    }

    public detach() {
        this.channels = undefined;
        this.activeLayer = undefined;
    }

    /**
     * Masks the layer's effect according to the channels in the clip.
     * Assumes 1 clip on 1 layer
     */
    public configureLayerMask() {
        if (!this.channels || !this.activeLayer) return;

        this.activeLayer.boneMask.fill(0);
        for (const channel of this.channels) {
            this.activeLayer.boneMask[channel.jid] |= channel.type;
        }
    }

    public sample(t: number) {
        if (!this.channels) {
            console.warn(
                "Trying to sample animation clip without attaching it to a layer",
            );
            return;
        }

        for (const channel of this.channels) {
            channel.sampler.sampleInto(
                t,
                channel.target,
                channel.type === ATType.R,
            );
        }
    }

    public sampleIfEnabled(t: number) {
        if (this.activeLayer?.weight && this.activeLayer.weight > 0) {
            this.sample(t);
        }
    }
}

// TODO: remove xample; impl in engine,loader,&scene

// const skinRoot: SceneNode = null!;
// const skinDef: AnimationLayerDef = null!;
// const rest: HAnim2Clip = null!;
// const walking: HAnim2Clip = null!;
// let speed = 0;
// let time = 0;

// const ls = new AnimationLayerStack(skinDef, [
//     "rest",
//     "walking",
//     "running",
//     "hit",
//     "attack",
//     "deflect",
//     "death",
// ]);

// // attach layer stack to node
// ls.attach(skinRoot);

// // deactivate all layers
// ls.layers.values().forEach((x) => {
//     x.weight = 0;
// });

// //setup drivers for rest and walking layers
// const layerRest = ls.layers.get("rest")!;
// const layerWalking = ls.layers.get("walking")!;
// const restDriver = new HAnim2LayerDriver(rest);
// const walkingDriver = new HAnim2LayerDriver(walking);
// restDriver.attach(layerRest);
// restDriver.configureLayerMask();
// walkingDriver.attach(layerWalking);
// walkingDriver.configureLayerMask();

// function onFrame() {
//     const walkingWeight = Math.min(speed, 1);

//     // blend between rest and walking layers based on speed
//     layerRest.weight = 1 - walkingWeight;
//     layerWalking.weight = walkingWeight;

//     restDriver.sample(time);
//     walkingDriver.sample(time);
// }
