export interface WGPerfData {
    readonly labels: Readonly<Record<number, string>>;
    readonly times: BigInt64Array;
    readonly n: number;
}

const enum SlotState {
    Free,
    Copied,
    Mapping,
}

interface ReadbackSlot {
    buffer: GPUBuffer;
    labels: string[];
    n: number;
    state: SlotState;
}

const BYTES_PER_PAIR = 16;
const READBACK_SLOTS = 3;

export class WGTimestamps {
    private _querySet: GPUQuerySet;
    private _resolveBuffer: GPUBuffer;
    private _slots: ReadbackSlot[] = [];
    private _pending: ReadbackSlot | undefined;

    private _labels: string[] = [];
    private _n = 0;
    private _warned = false;

    private _perf: { labels: string[]; times: BigInt64Array; n: number };

    public constructor(
        device: GPUDevice,
        public readonly capacity: number,
    ) {
        this._querySet = device.createQuerySet({
            label: "timestamps",
            type: "timestamp",
            count: 2 * capacity,
        });

        this._resolveBuffer = device.createBuffer({
            label: "timestamps:resolve",
            size: BYTES_PER_PAIR * capacity,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        });

        for (let i = 0; i < READBACK_SLOTS; i++) {
            this._slots.push({
                buffer: device.createBuffer({
                    label: `timestamps:readback${i}`,
                    size: BYTES_PER_PAIR * capacity,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
                }),
                labels: [],
                n: 0,
                state: SlotState.Free,
            });
        }

        this._perf = { labels: [], times: new BigInt64Array(2 * capacity), n: 0 };
    }

    public get perf(): WGPerfData {
        return this._perf;
    }

    public $alloc(label: string): GPURenderPassTimestampWrites | undefined {
        if (this._n >= this.capacity) {
            if (!this._warned) {
                console.warn(`Out of timestamp slots (${this.capacity}), '${label}' and later passes aren't timed`);
                this._warned = true;
            }
            return undefined;
        }

        const i = this._n++;
        this._labels[i] = label;

        return {
            querySet: this._querySet,
            beginningOfPassWriteIndex: 2 * i,
            endOfPassWriteIndex: 2 * i + 1,
        };
    }

    public $begin(): void {
        this._n = 0;
    }

    public $resolve(enc: GPUCommandEncoder): void {
        this._pending = undefined;
        if (this._n === 0) return;

        // all readback slots still in flight: queries were written but this frame goes unmeasured
        const slot = this._slots.find((s) => s.state === SlotState.Free);
        if (!slot) return;

        const bytes = BYTES_PER_PAIR * this._n;
        enc.resolveQuerySet(this._querySet, 0, 2 * this._n, this._resolveBuffer, 0);
        enc.copyBufferToBuffer(this._resolveBuffer, 0, slot.buffer, 0, bytes);

        for (let i = 0; i < this._n; i++) slot.labels[i] = this._labels[i];
        slot.n = this._n;
        slot.state = SlotState.Copied;
        this._pending = slot;
    }

    /** Must be called after the encoder passed to `$resolve` was submitted. */
    public $readback(): void {
        const slot = this._pending;
        if (!slot) return;
        this._pending = undefined;

        slot.state = SlotState.Mapping;
        const bytes = BYTES_PER_PAIR * slot.n;

        slot.buffer.mapAsync(GPUMapMode.READ, 0, bytes).then(
            () => {
                const perf = this._perf;
                perf.times.set(new BigInt64Array(slot.buffer.getMappedRange(0, bytes)));
                for (let i = 0; i < slot.n; i++) perf.labels[i] = slot.labels[i];
                perf.n = slot.n;

                slot.buffer.unmap();
                slot.state = SlotState.Free;
            },
            // device lost / destroyed; slot stays out of rotation
            () => {},
        );
    }

    public $destroy(): void {
        this._querySet.destroy();
        this._resolveBuffer.destroy();
        for (const s of this._slots) s.buffer.destroy();
        this._slots.length = 0;
    }
}
