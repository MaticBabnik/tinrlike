import { setTypedValues, type TypeDefinition } from "webgpu-utils";
import { Buffer } from "./buffer";
import type { WGpu } from "../gpu";

export class StructArrayBuffer<T = unknown> extends Buffer {
    constructor(
        gpu: WGpu,
        public readonly type: TypeDefinition,
        public readonly count: number,
        usage: GPUBufferUsageFlags,
        name: string = "unnamedStructArrayBuffer",
        public readonly elementSize: number = type.size,
    ) {
        super(gpu, elementSize * count, usage, name);
    }

    public set(index: number, data: Partial<T>): void {
        setTypedValues(this.type, data, this.cpuBuf, index * this.elementSize);
    }
}
