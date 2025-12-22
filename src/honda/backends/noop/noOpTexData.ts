import { GPUTexDataBase } from "../../gpu2/base/textureDataBase";
import type { IGPUTexData } from "../../gpu2/interface";

export class NoOpTexData extends GPUTexDataBase implements IGPUTexData {
    public uploadExternImage(_image: ImageBitmap): void {}

    public doMips(): void {}

    protected _rcDestroy(): void {}
}
