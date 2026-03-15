import type { z, ZodType } from "zod";

type SchemaConfig = Record<string, ZodType<unknown>>;

export class HStorage<T extends SchemaConfig> {
    private static prefix = "hondaStore:";
    constructor(private schemas: T) {}

    public maybeGetKey<Tkey extends keyof T>(
        key: Tkey,
    ): z.infer<T[Tkey]> | undefined {
        const storedValue = localStorage.getItem(
            `${HStorage.prefix}${key as string}`,
        );
        const schema = this.schemas[key];

        if (storedValue) {
            try {
                const parsedValue = JSON.parse(storedValue);
                return schema.parse(parsedValue);
            } catch {}
        }

        return undefined;
    }

    public getKeyOrDefault<Tkey extends keyof T>(
        key: Tkey,
        fallback: z.infer<T[Tkey]>,
    ): z.infer<T[Tkey]> {
        const v = this.maybeGetKey(key);
        if (v !== undefined) return v;

        this.storeKey(key, fallback);
        return fallback;
    }

    public storeKey<Tkey extends keyof T>(
        key: Tkey,
        value: z.infer<T[Tkey]>,
    ): void {
        localStorage.setItem(
            `${HStorage.prefix}${key as string}`,
            JSON.stringify(value),
        );
    }
}
