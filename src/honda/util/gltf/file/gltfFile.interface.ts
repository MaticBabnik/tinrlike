import type { IGltfRoot } from "../gltf.types";
import type { ABView, GltfAccessor, GltfBufView } from "../types";

export interface IGltfFile {
    get bin(): ABView;
    get json(): IGltfRoot;
    get id(): number;
    get name(): string;

    getBuffer(index: number): ArrayBufferView<ArrayBuffer>;
    getBufferView(index: number): GltfBufView;
    getAccessor(index: number): GltfAccessor;
    getImageBitmap(index: number): ImageBitmap;
}
