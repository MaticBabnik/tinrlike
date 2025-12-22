import { MaterialBase } from "../../gpu2/base/materialBase";
import type { IGPUMat } from "../../gpu2/interface";

export class NoOpMat extends MaterialBase implements IGPUMat {
    public push(): void {}

    protected _rcDestroy(): void {}
}
