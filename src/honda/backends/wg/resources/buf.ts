import { GPUBufBase } from "../../../gpu2/base/bufferBase";
import { GPUBufUsage, type IGPUBuf } from "../../../gpu2/interface";
import type { WGpu } from "../gpu";

export function toWgBufferUsage(usage: GPUBufUsage): number {
    let wgUsage = 0;

    if (usage & GPUBufUsage.Vertex) {
        wgUsage |= GPUBufferUsage.VERTEX;
    }

    if (usage & GPUBufUsage.Index) {
        wgUsage |= GPUBufferUsage.INDEX;
    }

    if (usage & GPUBufUsage.Uniform) {
        wgUsage |= GPUBufferUsage.UNIFORM;
    }

    if (usage & GPUBufUsage.Storage) {
        wgUsage |= GPUBufferUsage.STORAGE;
    }

    if (usage & GPUBufUsage.CopySource) {
        wgUsage |= GPUBufferUsage.COPY_SRC;
    }

    if (usage & GPUBufUsage.CopyDestination) {
        wgUsage |= GPUBufferUsage.COPY_DST;
    }

    if (usage & GPUBufUsage.Indirect) {
        wgUsage |= GPUBufferUsage.INDIRECT;
    }

    if (usage & GPUBufUsage.MapRead) {
        wgUsage |= GPUBufferUsage.MAP_READ;
    }

    if (usage & GPUBufUsage.MapWrite) {
        wgUsage |= GPUBufferUsage.MAP_WRITE;
    }

    return wgUsage;
}

export class WGBuf extends GPUBufBase implements IGPUBuf {
    public readonly buffer: GPUBuffer;

    constructor(
        protected gpu: WGpu,
        d: GPUBufferDescriptor,
    ) {
        d.size = Math.ceil(d.size / 4) * 4;
        super(d);

        this.buffer = gpu.device.createBuffer({
            label: this.label,
            usage: toWgBufferUsage(this.usage),
            size: d.size,
            mappedAtCreation: false,
        });
    }

    upload(src: BufferSource, offset: number, n: number): void {
        if (src instanceof Uint16Array) {
            if (n & 1) n++;
            offset = offset * 2;
            n = n * 2;

            this.gpu.device.queue.writeBuffer(
                this.buffer,
                offset,
                src.buffer.slice(src.byteOffset, src.byteOffset + n * 2),
                0,
                n,
            );
            return;
        }

        this.gpu.device.queue.writeBuffer(this.buffer, offset, src, 0, n);
    }

    download(_dst: BufferSource, _offset: number, _n: number): void {
        throw new Error("WGBuf.download: Not implemented");
    }

    copyFrom(
        src: IGPUBuf,
        srcOffset: number,
        dstOffset: number,
        n: number,
    ): void {
        this.gpu.cmdEncoder.copyBufferToBuffer(
            (src as WGBuf).buffer,
            srcOffset,
            this.buffer,
            dstOffset,
            n,
        );
    }

    protected _rcDestroy(): void {
        this.gpu.safeDestroy(this.buffer);
    }
}
