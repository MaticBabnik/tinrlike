import { GPUTexBase } from "../../gpu2/base/textureBase";
import type { IGPUTex } from "../../gpu2/interface";

export class NoOpTex extends GPUTexBase implements IGPUTex {
    protected _rcDestroy(): void {}
}
