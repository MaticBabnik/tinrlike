import {
    vec3,
    type Vec3,
    type Quat,
    quat,
    utils,
    type Vec4,
    vec4,
} from "wgpu-matrix";
import type { HondaAccesor } from "./gltf";

export enum AnimInterp {
    STEP = "STEP",
    LINEAR = "LINEAR",
    CUBICSPLINE = "CUBICSPLINE",
}

export type ASampler = SSampler | V3Sampler | V4Sampler;

/**
 *
 * @param t Segment normalized time [0,1]
 * @param td Duration of segment
 * @param vs Value @ start
 * @param bs Out tangent @ start
 * @param ae In tangent @ end
 * @param ve Value @ end
 * @returns value @ time
 */
function spline(
    t: number,
    td: number,
    vs: number,
    bs: number,
    ae: number,
    ve: number,
): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
        (2 * t3 - 3 * t2 + 1) * vs +
        td * (t3 - 2 * t2 + t) * bs +
        (-2 * t3 + 3 * t2) * ve +
        td * (t3 - t2) * ae
    );
}

export class SSampler {
    constructor(
        public readonly interp: AnimInterp,
        public readonly inAcc: HondaAccesor<Float32Array, "SCALAR">,
        public readonly outAcc: HondaAccesor<Float32Array, "SCALAR">,
    ) {}

    public sample(t: number): number {
        // Handle accesses outside of animation range
        const l = this.inAcc.count - 1;
        const o = this.interp === AnimInterp.CUBICSPLINE ? 1 : 0;
        if (t < this.inAcc.accessor[0]) return this.outAcc.accessor[o];
        if (t > this.inAcc.accessor[l]) return this.outAcc.accessor[l - o];

        // Find start keyframe index
        let i = 0;
        while (t >= this.inAcc.accessor[i + 1]) {
            i++;
        }

        switch (this.interp) {
            case AnimInterp.STEP: {
                return this.outAcc.accessor[i];
            }

            case AnimInterp.LINEAR: {
                const ts = this.inAcc.accessor[i],
                    te = this.inAcc.accessor[i + 1];

                return utils.lerp(
                    this.outAcc.accessor[i],
                    this.outAcc.accessor[i + 1],
                    (t - ts) / te,
                );
            }

            case AnimInterp.CUBICSPLINE: {
                const ts = this.inAcc.accessor[i],
                    te = this.inAcc.accessor[i + 1];
                const tn = (t - ts) / te,
                    td = te - ts;

                // real and true and real and true and real and...
                return spline(
                    tn,
                    td,
                    this.outAcc.accessor[i * 3 + 1],
                    this.outAcc.accessor[i * 3 + 2],
                    this.outAcc.accessor[i * 3 + 3],
                    this.outAcc.accessor[i * 3 + 4],
                );
            }
        }
    }
}

export class V3Sampler {
    constructor(
        public readonly interp: AnimInterp,
        public readonly inAcc: HondaAccesor<Float32Array, "SCALAR">,
        public readonly outAcc: HondaAccesor<Float32Array, "VEC3">,
    ) {}

    public sample(t: number): Vec3 {
        return this.sampleInto(t, vec3.create());
    }

    public sampleInto(t: number, v: Vec3): Vec3 {
        const l = this.inAcc.count - 1;
        const o = this.interp === AnimInterp.CUBICSPLINE ? 1 : 0;

        // TODO: fix EVIL before start error!
        if (t < this.inAcc.accessor[0]) {
            v[0] = this.outAcc.accessor[o * 3 + 0];
            v[1] = this.outAcc.accessor[o * 3 + 1];
            v[2] = this.outAcc.accessor[o * 3 + 2];
            return v;
        }
        if (t > this.inAcc.accessor[l]) {
            v[0] = this.outAcc.accessor[(l - o) * 3 + 0];
            v[1] = this.outAcc.accessor[(l - o) * 3 + 1];
            v[2] = this.outAcc.accessor[(l - o) * 3 + 2];
            return v;
        }

        // Find start keyframe index
        let i = 0;
        while (t >= this.inAcc.accessor[i + 1]) {
            i++;
        }

        switch (this.interp) {
            case AnimInterp.STEP: {
                v[0] = this.outAcc.accessor[i * 3 + 0];
                v[1] = this.outAcc.accessor[i * 3 + 1];
                v[2] = this.outAcc.accessor[i * 3 + 2];
                return v;
            }

            case AnimInterp.LINEAR: {
                const ts = this.inAcc.accessor[i],
                    te = this.inAcc.accessor[i + 1];
                const tn = (t - ts) / (te - ts);

                v[0] = utils.lerp(
                    this.outAcc.accessor[i * 3 + 0],
                    this.outAcc.accessor[i * 3 + 3],
                    tn,
                );
                v[1] = utils.lerp(
                    this.outAcc.accessor[i * 3 + 1],
                    this.outAcc.accessor[i * 3 + 4],
                    tn,
                );
                v[2] = utils.lerp(
                    this.outAcc.accessor[i * 3 + 2],
                    this.outAcc.accessor[i * 3 + 5],
                    tn,
                );
                return v;
            }

            case AnimInterp.CUBICSPLINE: {
                const ts = this.inAcc.accessor[i],
                    te = this.inAcc.accessor[i + 1],
                    td = te - ts,
                    tn = (t - ts) / td;

                // real and true and real and true and real and...
                v[0] = spline(
                    tn,
                    td,
                    this.outAcc.accessor[(i * 3 + 1) * 3 + 0],
                    this.outAcc.accessor[(i * 3 + 2) * 3 + 0],
                    this.outAcc.accessor[(i * 3 + 3) * 3 + 0],
                    this.outAcc.accessor[(i * 3 + 4) * 3 + 0],
                );
                v[1] = spline(
                    tn,
                    td,
                    this.outAcc.accessor[(i * 3 + 1) * 3 + 1],
                    this.outAcc.accessor[(i * 3 + 2) * 3 + 1],
                    this.outAcc.accessor[(i * 3 + 3) * 3 + 1],
                    this.outAcc.accessor[(i * 3 + 4) * 3 + 1],
                );
                v[2] = spline(
                    tn,
                    td,
                    this.outAcc.accessor[(i * 3 + 1) * 3 + 2],
                    this.outAcc.accessor[(i * 3 + 2) * 3 + 2],
                    this.outAcc.accessor[(i * 3 + 3) * 3 + 2],
                    this.outAcc.accessor[(i * 3 + 4) * 3 + 2],
                );

                return v;
            }
        }
    }
}

export class V4Sampler {
    constructor(
        public readonly interp: AnimInterp,
        public readonly inAcc: HondaAccesor<Float32Array, "SCALAR">,
        public readonly outAcc: HondaAccesor<Float32Array, "VEC4">,
    ) {}

    public sample(t: number): Vec4 {
        return this.sampleInto(t, vec4.create());
    }

    /**
     * @param rotation linear = linear on sphere, default to true
     */
    public sampleQuat(t: number, rotation = true): Quat {
        return this.sampleInto(t, quat.create(), rotation);
    }

    public sampleInto(t: number, q: Vec4, rotation?: boolean): Vec4;
    public sampleInto(t: number, q: Quat, rotation?: boolean): Quat;
    public sampleInto(t: number, vq: Vec4 | Quat, rot = false): Vec4 | Quat {
        const l = this.inAcc.count - 1;
        const o = this.interp === AnimInterp.CUBICSPLINE ? 1 : 0;

        if (t < this.inAcc.accessor[0]) {
            t = this.inAcc.accessor[0];
            // TODO(mbabnik): WHY THE FUCK DOES THE BELLOW CODE FAIL ???????
            // vq[0] = this.outAcc.accessor[o * 4 + 0];
            // vq[1] = this.outAcc.accessor[o * 4 + 1];
            // vq[2] = this.outAcc.accessor[o * 4 + 2];
            // vq[2] = this.outAcc.accessor[o * 4 + 3];
            // return vq;
        }
        if (t > this.inAcc.accessor[l]) {
            vq[0] = this.outAcc.accessor[(l - o) * 4 + 0];
            vq[1] = this.outAcc.accessor[(l - o) * 4 + 1];
            vq[2] = this.outAcc.accessor[(l - o) * 4 + 2];
            vq[2] = this.outAcc.accessor[(l - o) * 4 + 3];
            return vq;
        }

        // Find start keyframe index
        let i = 0;
        while (t >= this.inAcc.accessor[i + 1]) {
            i++;
        }

        switch (this.interp) {
            case AnimInterp.STEP: {
                vq[0] = this.outAcc.accessor[i * 4 + 0];
                vq[1] = this.outAcc.accessor[i * 4 + 1];
                vq[2] = this.outAcc.accessor[i * 4 + 2];
                vq[2] = this.outAcc.accessor[i * 4 + 3];
                return vq;
            }

            case AnimInterp.LINEAR: {
                if (rot) {
                    quat.slerp(
                        this.outAcc.accessor.slice(i * 4, i * 4 + 4) as Quat,
                        this.outAcc.accessor.slice(
                            (i + 1) * 4,
                            (i + 1) * 4 + 4,
                        ) as Quat,
                        (t - this.inAcc.accessor[i]) /
                            (this.inAcc.accessor[i + 1] -
                                this.inAcc.accessor[i]),
                        vq as Quat,
                    );
                    return vq;
                }

                const ts = this.inAcc.accessor[i],
                    te = this.inAcc.accessor[i + 1];
                const tn = (t - ts) / (te - ts);

                vq[0] = utils.lerp(
                    this.outAcc.accessor[i * 4 + 0],
                    this.outAcc.accessor[i * 4 + 4],
                    tn,
                );
                vq[1] = utils.lerp(
                    this.outAcc.accessor[i * 4 + 1],
                    this.outAcc.accessor[i * 4 + 5],
                    tn,
                );
                vq[2] = utils.lerp(
                    this.outAcc.accessor[i * 4 + 2],
                    this.outAcc.accessor[i * 4 + 6],
                    tn,
                );
                vq[3] = utils.lerp(
                    this.outAcc.accessor[i * 4 + 3],
                    this.outAcc.accessor[i * 4 + 7],
                    tn,
                );
                return vq;
            }

            case AnimInterp.CUBICSPLINE: {
                const ts = this.inAcc.accessor[i],
                    te = this.inAcc.accessor[i + 1],
                    td = te - ts,
                    tn = (t - ts) / td;

                // real and true and real and true and real and...
                vq[0] = spline(
                    tn,
                    td,
                    this.outAcc.accessor[(i * 4 + 1) * 4 + 0],
                    this.outAcc.accessor[(i * 4 + 2) * 4 + 0],
                    this.outAcc.accessor[(i * 4 + 3) * 4 + 0],
                    this.outAcc.accessor[(i * 4 + 4) * 4 + 0],
                );
                vq[1] = spline(
                    tn,
                    td,
                    this.outAcc.accessor[(i * 4 + 1) * 4 + 1],
                    this.outAcc.accessor[(i * 4 + 2) * 4 + 1],
                    this.outAcc.accessor[(i * 4 + 3) * 4 + 1],
                    this.outAcc.accessor[(i * 4 + 4) * 4 + 1],
                );
                vq[2] = spline(
                    tn,
                    td,
                    this.outAcc.accessor[(i * 4 + 1) * 4 + 2],
                    this.outAcc.accessor[(i * 4 + 2) * 4 + 2],
                    this.outAcc.accessor[(i * 4 + 3) * 4 + 2],
                    this.outAcc.accessor[(i * 4 + 4) * 4 + 2],
                );
                vq[3] = spline(
                    tn,
                    td,
                    this.outAcc.accessor[(i * 4 + 1) * 4 + 3],
                    this.outAcc.accessor[(i * 4 + 2) * 4 + 3],
                    this.outAcc.accessor[(i * 4 + 3) * 4 + 3],
                    this.outAcc.accessor[(i * 4 + 4) * 4 + 3],
                );

                return vq;
            }
        }
    }
}
