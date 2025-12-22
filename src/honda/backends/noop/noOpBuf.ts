import { GPUBufBase } from "../../gpu2/base/bufferBase";
import type { IGPUBuf } from "../../gpu2/interface";

export class NoOpBuf extends GPUBufBase implements IGPUBuf {
    public copyFrom(): void {}

    public download(): void {}

    public upload(): void {}

    protected _rcDestroy(): void {}
}
