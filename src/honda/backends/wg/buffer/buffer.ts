import type { WGpu } from "../gpu";

export class Buffer {
    public cpuBuf: ArrayBuffer;
    public gpuBuf: GPUBuffer;

    constructor(
        private gpu: WGpu,
        public readonly size: number,
        public usage: GPUBufferUsageFlags,
        public name: string = "unnamedBuffer",
    ) {
        this.cpuBuf = new ArrayBuffer(size);
        this.gpuBuf = this.gpu.device.createBuffer({
            size,
            usage,
            mappedAtCreation: false,
            label: name,
        });
        this.gpuBuf.label = name;
    }

    public push(offset: number = 0, size: number = this.size) {
        this.gpu.device.queue.writeBuffer(
            this.gpuBuf,
            offset,
            this.cpuBuf,
            offset,
            size,
        );
    }

    public async pull() {
        if (!(this.usage & GPUBufferUsage.MAP_READ)) {
            throw new Error(
                `Buffer ${this.name} was not created with MAP_READ usage flag!`,
            );
        }

        await this.gpuBuf.mapAsync(GPUMapMode.READ);
        const copy = this.gpuBuf.getMappedRange();
        new Uint8Array(this.cpuBuf).set(new Uint8Array(copy));
        this.gpuBuf.unmap();
    }

    /**
     * Don't call while used in GPU operations
     */
    public destroy() {
        this.gpuBuf.destroy();
        this.cpuBuf = null!;
        this.gpuBuf = null!;

        this.name = `DESTROYED! ${this.name}`;
    }
}
