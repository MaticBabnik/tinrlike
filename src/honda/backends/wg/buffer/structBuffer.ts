import { setTypedValues, type TypeDefinition } from "webgpu-utils";
import { Buffer } from "./buffer";
import type { WGpuComposite } from "../gpu/gpu";

export class StructBuffer<T = unknown> extends Buffer {
    constructor(
        gpu: WGpuComposite,
        public readonly type: TypeDefinition,
        usage: GPUBufferUsageFlags,
        name: string = "unnamedStructBuffer",
        size: number = type.size,
    ) {
        super(gpu, size, usage, name);
    }

    public set(data: Partial<T>): void {
        setTypedValues(this.type, data, this.cpuBuf);
    }
}
