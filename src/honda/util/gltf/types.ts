import type { TAccessorType } from "./gltf.types";

export type ABView = ArrayBufferView<ArrayBuffer>;

export type TTypedArrayCtor<T> = {
    new (buffer: ArrayBuffer, byteOffset?: number, length?: number): T;
    BYTES_PER_ELEMENT: number;
};

export type TypedArrays<T extends ArrayBufferLike = ArrayBuffer> =
    | Int8Array<T>
    | Uint8Array<T>
    | Int16Array<T>
    | Uint16Array<T>
    | Uint32Array<T>
    | Float32Array<T>;

export interface GltfAccessor<
    TArray extends TypedArrays = TypedArrays,
    TElement extends TAccessorType = TAccessorType,
> {
    accessor: TArray;
    normalized: false | undefined;
    type: TElement;
    count: number;
}

export interface GltfBufView {
    buffer: ArrayBuffer;
    byteOffset: number;
    byteLength: number;
}
