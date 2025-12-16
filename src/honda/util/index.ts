/**
 * Not null/undefined assertion
 */
export function nn<T>(value: T | null | undefined, message?: string): T {
    if (value === null) throw new Error(message ?? "value was null");
    if (value === undefined) throw new Error(message ?? "value was undefined");
    return value;
}

/**
 * Assertion
 * @param assertion condition
 * @param message error message for fails
 */
export function assert<T>(
    assertion: T,
    message = "Assertion failed",
): asserts assertion {
    if (!assertion) throw new Error(message);
}

export function clamp(min: number, x: number, max: number) {
    if (x < min) return min;
    if (x > max) return max;
    return x;
}

// TODO: move to ../gpu
export function nMips(w: number, h: number) {
    const maxSize = Math.max(w, h);
    return (1 + Math.log2(maxSize)) | 0;
}

export const PI_2 = Math.PI / 2;

export const $ = <T extends Element>(key: string) =>
    nn(document.querySelector<T>(key));
