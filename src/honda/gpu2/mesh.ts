import { getNewResourceId } from "../util/resource";
import type { IGPUBuf } from "./interface";

export const enum MeshIndexType {
    None = 0,
    U16 = 1,
    U32 = 2,
}

export class MeshV2 {
    public readonly id: number;

    constructor(
        public readonly position: IGPUBuf,
        public readonly normal: IGPUBuf,
        public readonly texCoord: IGPUBuf,

        public readonly tangent: IGPUBuf | undefined,

        public readonly joints: IGPUBuf | undefined,
        public readonly weights: IGPUBuf | undefined,

        public readonly index: IGPUBuf | undefined,
        public readonly indexType: MeshIndexType,

        public readonly drawCount: number,
    ) {
        this.id = getNewResourceId();

        this.position.rcUse();
        this.normal.rcUse();
        this.texCoord.rcUse();
        this.tangent?.rcUse();
        this.joints?.rcUse();
        this.weights?.rcUse();
        this.index?.rcUse();
    }

    public destroy(): void {
        this.position.rcRelease();
        this.normal.rcRelease();
        this.texCoord.rcRelease();
        this.tangent?.rcRelease();
        this.joints?.rcRelease();
        this.weights?.rcRelease();
        this.index?.rcRelease();
    }
}
