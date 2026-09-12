export function nMips(w: number, h: number, d = 1): number {
    const minSize = Math.min(w, h, d);
    return (1 + Math.log2(minSize)) | 0;
}
