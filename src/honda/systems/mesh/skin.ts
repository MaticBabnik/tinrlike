export class SkinInfo {
    constructor(
        public gltfId: number,
        public joints: number[],
        public inverseBindMatrices: Float32Array,
    ) {}
}
