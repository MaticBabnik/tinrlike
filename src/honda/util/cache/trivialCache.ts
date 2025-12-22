import type { ICache } from "./cache.interface";

export class TrivialCache<TKey, TValue> implements ICache<TKey, TValue> {
    protected _cache = new Map<TKey, TValue>();

    get(k: TKey): TValue | undefined {
        return this._cache.get(k);
    }

    set(k: TKey, v: TValue): void {
        this._cache.set(k, v);
    }

    getOrCreate(k: TKey, create: () => TValue): TValue {
        const existing = this.get(k);
        if (existing) return existing;

        const created = create();
        this.set(k, created);
        return created;
    }
}
