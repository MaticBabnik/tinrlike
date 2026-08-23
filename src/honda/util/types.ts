export type Two<T> = [T, T];
export type Three<T> = [T, T, T];
export type Four<T> = [T, T, T, T];

/**
 * Drops every optional key of `T`, keeping the ones that must be provided.
 */
export type Defined<T> = {
    [K in keyof T as undefined extends T[K] ? never : K]: T[K];
};
