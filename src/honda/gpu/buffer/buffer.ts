import { Game } from "@/honda/state";

export class Buffer {
    public cpuBuf: ArrayBuffer;
    public gpuBuf: GPUBuffer;

    constructor(
        public readonly size: number,
        public usage: GPUBufferUsageFlags,
        public name: string = "unnamedBuffer",
    ) {
        this.cpuBuf = new ArrayBuffer(size);
        this.gpuBuf = Game.gpu.device.createBuffer({
            size,
            usage,
            mappedAtCreation: false,
            label: name,
        });
        this.gpuBuf.label = name;
    }

    public push(offset: number = 0, size: number = this.size) {
        Game.gpu.device.queue.writeBuffer(
            this.gpuBuf,
            offset,
            this.cpuBuf,
            offset,
            size,
        );
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
