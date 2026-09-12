export interface IDisposable {
    dispose(): unknown;
}

export interface IDestroyable {
    destroy(): unknown;
}

export interface IRefCnt {
    get valid(): boolean;
    get refCount(): number;

    rcUse(): void;
    rcRelease(): void;
}

export type TrackableResource = IRefCnt | IDisposable | IDestroyable;

export function isRefCountable(v: unknown): v is IRefCnt {
    return (
        typeof v === "object" &&
        v !== null &&
        "rcUse" in v &&
        "rcRelease" in v &&
        "valid" in v &&
        "refCount" in v
    );
}

export function isManagedResource(thing: unknown): thing is TrackableResource {
    if (typeof thing !== "object" || thing === null) return false;

    return (
        ("rcRelease" in thing && typeof thing.rcRelease === "function") ||
        ("dispose" in thing && typeof thing.dispose === "function") ||
        ("delete" in thing && typeof thing.delete === "function")
    );
}
