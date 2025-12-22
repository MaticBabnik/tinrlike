export interface ICache<TKey, TValue> {
    get(k: TKey): TValue | undefined;
    set(k: TKey, v: TValue): void;
    getOrCreate(k: TKey, create: () => TValue): TValue;
}
