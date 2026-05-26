export type HSym<T> = {
    __sym__: T;
    __brand__: "hondaSymbol";
} & symbol;

export function hsym<T>(key: string): HSym<T> {
    return Symbol.for(key) as HSym<T>;
}
