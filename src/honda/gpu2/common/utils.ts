export function nMips(w: number, h: number, d = 1): number {
    const maxSize = Math.max(w, h, d);
    return (1 + Math.log2(maxSize)) | 0;
}
