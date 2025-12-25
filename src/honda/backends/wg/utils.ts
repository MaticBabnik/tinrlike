const { max, min } = Math;

/**
 * Computes the minimum alignment that satisfies all specs.
 * @param specs alignment requirements
 */
export function minAlign(...specs: number[]): number {
    return specs.reduce((a, b) =>
        max(a, b) % min(a, b) === 0 ? max(a, b) : a * b,
    );
}

/**
 * Aligns n to the nearest multiple of to.
 */
export function align(n: number, to: number): number {
    return Math.ceil(n / to) * to;
}
