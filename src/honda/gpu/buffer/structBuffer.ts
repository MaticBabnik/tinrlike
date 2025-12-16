import { setTypedValues, type TypeDefinition } from "webgpu-utils";
import { Buffer } from "./buffer";

export class StructBuffer<T = unknown> extends Buffer {
    constructor(
        public readonly type: TypeDefinition,
        usage: GPUBufferUsageFlags,
        name: string = "unnamedStructBuffer",
        size: number = type.size,
    ) {
        super(size, usage, name);
    }

    public set(data: Partial<T>): void {
        setTypedValues(this.type, data, this.cpuBuf);
    }
}
