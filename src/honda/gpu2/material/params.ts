import type { Defined, Four, Three, Two } from "@/honda/util/types";
import type { IGPUTex } from "../interface";

export type TScalar = number;
export type TVec2 = Two<number>;
export type TVec3 = Three<number>;
export type TVec4 = Four<number>;

export type TParamValue = TScalar | TVec2 | TVec3 | TVec4 | IGPUTex;

export type TParamSet = Record<string, TParamValue | undefined>;

export type TTextureKeys<P> = keyof {
    [K in keyof P as NonNullable<P[K]> extends IGPUTex ? K : never]: K;
};

export type TUniformKeys<P> = keyof {
    [K in keyof P as NonNullable<P[K]> extends IGPUTex ? never : K]: K;
};

export type TParamView<P> = {
    [K in keyof P as K extends TTextureKeys<P> ? never : K]: P[K];
} & {
    readonly [K in keyof P as K extends TTextureKeys<P> ? K : never]: P[K];
};

export type TMaterialInit<P, D> = Omit<Defined<P>, keyof D> & Partial<P>;
