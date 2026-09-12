import { type Mat4, mat4, type Vec3, type Quat } from "wgpu-matrix";

interface ITransformData {
    translation: Vec3;
    rotation: Quat;
    scale: Vec3;
}

export interface ITransform extends ITransformData {
    $glbMtx: Mat4;
    $glbInvMtx: Mat4;

    update(): void;
    materialize(): void;
    $updateGlobal(parent: Transform): void;
}

const MTX_SIZE = 4 * 4 * 4; // 4x4 matrix of float32
const VEC_SIZE = 4 * 4; // vec4 (or aligned vec3) of float32
const TRANSFORM_SIZE = 4 * MTX_SIZE + 3 * VEC_SIZE;

const _scratch = mat4.create();

export class Transform implements ITransform {
    public $mem: ArrayBuffer;

    public readonly $glbMtx: Mat4;
    public readonly $glbInvMtx: Mat4;
    private readonly _locMtx: Mat4;
    private readonly _locInvMtx: Mat4;

    public readonly translation: Vec3;
    public readonly rotation: Quat;
    public readonly scale: Vec3;

    public dirty = false;

    constructor() {
        const mem = new ArrayBuffer(TRANSFORM_SIZE);
        this.$mem = mem;
        this.$glbMtx = new Float32Array(mem, 0, 16);
        this.$glbInvMtx = new Float32Array(mem, MTX_SIZE, 16);
        this._locMtx = new Float32Array(mem, 2 * MTX_SIZE, 16);
        this._locInvMtx = new Float32Array(mem, 3 * MTX_SIZE, 16);

        this.translation = new Float32Array(mem, 4 * MTX_SIZE, 3);
        this.rotation = new Float32Array(mem, 4 * MTX_SIZE + VEC_SIZE, 4);
        this.scale = new Float32Array(mem, 4 * MTX_SIZE + 2 * VEC_SIZE, 3);

        this.translation.fill(0);
        this.scale.fill(1);
        this.rotation[0] = this.rotation[1] = this.rotation[2] = 0;
        this.rotation[3] = 1;

        this.updateLocal();
    }

    public update() {
        this.dirty = true;
    }

    /**
     * Forces the local matrix to be up to date
     */
    public materialize() {
        if (this.dirty) this.updateLocal();
    }

    private updateLocal() {
        mat4.identity(this._locMtx);
        mat4.translate(this._locMtx, this.translation, this._locMtx);
        mat4.multiply(
            this._locMtx,
            mat4.fromQuat(this.rotation, _scratch),
            this._locMtx,
        );
        mat4.scale(this._locMtx, this.scale, this._locMtx);

        mat4.inverse(this._locMtx, this._locInvMtx);
        this.dirty = false;
    }

    public $updateGlobal(parent: Transform) {
        if (this.dirty) this.updateLocal();
        mat4.mul(parent.$glbMtx, this._locMtx, this.$glbMtx);
        mat4.mul(this._locInvMtx, parent.$glbInvMtx, this.$glbInvMtx);
    }

    public get localMatrix() {
        if (this.dirty) this.updateLocal();
        return this._locMtx;
    }

    public get localInvMatrix() {
        if (this.dirty) this.updateLocal();
        return this._locInvMtx;
    }
}
