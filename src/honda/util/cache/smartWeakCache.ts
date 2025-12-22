import type { ICache } from "./cache.interface";
import { TrivialWeakCache } from "./trivialWeakCache";

export class SmartWeakCache<TKey, TValue extends WeakKey>
    extends TrivialWeakCache<TKey, TValue>
    implements ICache<TKey, TValue>
{
    constructor(private readonly predicate: (v: TValue) => boolean) {
        super();
    }

    get(k: TKey): TValue | undefined {
        const val = this._cache.get(k)?.deref();
        if (val && this.predicate(val)) {
            return val;
        } else {
            this._cache.delete(k);
        }
        return undefined;
    }
}
