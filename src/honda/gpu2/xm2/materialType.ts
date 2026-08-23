import type { TParamSet } from "./params";
import type { RenderState } from "./renderState";

export class MaterialType<
    P extends TParamSet,
    D extends Partial<P>,
    O extends keyof RenderState = never,
> {
    /** phantom, emits no runtime field */
    declare readonly __p: P;
    /** phantom, emits no runtime field */
    declare readonly __d: D;
    /** phantom, emits no runtime field */
    declare readonly __o: (o: O) => void;

    private static _nextTypeId = 0;
    public readonly id = MaterialType._nextTypeId++;

    public constructor(
        public readonly name: string,
        public readonly defaults: D,
        public readonly render: RenderState,
    ) {}
}

export type AnyMatType = MaterialType<TParamSet, Partial<TParamSet>, never>;

export type TEmpty = Record<never, never>;

export type TOverridable<T extends AnyMatType> = T["__o"] extends (
    o: infer O,
) => void
    ? O & keyof RenderState
    : never;

export type UntypedMatType = MaterialType<TEmpty, TEmpty>;
