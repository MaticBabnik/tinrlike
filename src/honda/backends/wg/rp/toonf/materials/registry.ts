import type { AnyMatType, AnyMaterial, Material } from "@/honda/gpu2/material";
import type { WGpuComposite } from "../../../gpu/gpu";
import type { IToonMatImpl, ToonMatSlot } from "./material";

/**
 * Owns the backend data of every material the RP has seen.
 * Materials get allocated lazily when the gather pass first meets them.
 */
export class ToonMaterialRegistry {
    private _impls = new Map<number, IToonMatImpl>();
    private _live = new Set<AnyMaterial>();
    private _warned = new Set<number>();
    private _nextId = 0;

    public constructor(private readonly wg: WGpuComposite) {}

    public get liveCount(): number {
        return this._live.size;
    }

    public register<T extends AnyMatType, S extends ToonMatSlot>(impl: IToonMatImpl<T, S>): void {
        this._impls.set(impl.type.id, impl as unknown as IToonMatImpl);
    }

    /**
     * Returns the material's slot, synced for this frame.
     * Undefined when the material type has no ToonF implementation.
     */
    public sync(m: AnyMaterial): ToonMatSlot | undefined {
        const s = m.$backendData as ToonMatSlot | null;

        if (s?.owner !== this) return this.alloc(m);
        if (s.frame === this.wg.frameNo) return s;

        s.frame = this.wg.frameNo;
        s.impl.update(m, s);
        return s;
    }

    public free<T extends AnyMatType>(m: Material<T>): void {
        const s = m.$backendData as ToonMatSlot | null;
        if (s?.owner !== this) return;

        s.impl.free(s);
        m.$backendData = null;
        m.$alloced = false;
        this._live.delete(m as unknown as AnyMaterial);
    }

    public destroy(): void {
        for (const m of this._live) this.free(m);
    }

    private alloc(m: AnyMaterial): ToonMatSlot | undefined {
        const impl = this._impls.get(m.type.id);

        if (!impl) {
            if (!this._warned.has(m.type.id)) {
                this._warned.add(m.type.id);
                console.warn(
                    `ToonF: no implementation for material type '${m.type.name}', meshes using it won't render`,
                );
            }
            return undefined;
        }

        const s = impl.alloc(m, {
            owner: this,
            impl,
            id: this._nextId++,
            frame: this.wg.frameNo,
        });

        m.$backendData = s;
        m.$alloced = true;
        this._live.add(m);

        return s;
    }
}
