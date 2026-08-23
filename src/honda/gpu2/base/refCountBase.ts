import type { IRefCnt } from "../interface/rc.interface";

interface IRcLeakInfo {
    type: string;
    label: string;
    stack: string | undefined;
}

export abstract class RefCntBase implements IRefCnt {
    protected _rcValid: boolean = true;
    protected _rcCount: number = 0;

    private static _registry: FinalizationRegistry<IRcLeakInfo> | null = null;
    private static _leaks = 0;

    public static trackLeaks(): void {
        RefCntBase._registry ??= new FinalizationRegistry<IRcLeakInfo>(
            RefCntBase._onLeak,
        );
    }

    public static get leakCount(): number {
        return RefCntBase._leaks;
    }

    private static _onLeak(info: IRcLeakInfo): void {
        RefCntBase._leaks++;

        console.groupCollapsed(
            `%c[rc]%c leak%c ${info.type} ${info.label}`,
            "background-color: red; color:white;",
            "color:red",
            "color: inherit; font-weight: 400;",
        );
        console.error(info.stack);
        console.groupEnd();
    }

    protected readonly _rcInfo: IRcLeakInfo | null = null;

    public constructor(label?: string) {
        const reg = RefCntBase._registry;
        if (reg === null) return;

        this._rcInfo = {
            type: this.constructor.name,
            label: label ?? this._rcLabel,
            stack: new Error("created here").stack,
        };

        reg.register(this, this._rcInfo, this);
    }

    protected _rcSetLabel(label: string): void {
        if (this._rcInfo !== null) this._rcInfo.label = label;
    }

    protected get _rcLabel(): string {
        return (
            (this as { name?: string }).name ??
            (this as { label?: string }).label ??
            this.constructor.name
        );
    }

    public get valid(): boolean {
        return this._rcValid;
    }

    public get refCount(): number {
        return this._rcCount;
    }

    public rcUse(): void {
        if (!this._rcValid) {
            throw new Error(
                "Attempt to use an invalid reference counted object.",
            );
        }

        this._rcCount++;
    }

    public rcRelease(): void {
        if (!this._rcValid || this._rcCount <= 0) {
            console.warn("Ref count negative!");
            return;
        }

        this._rcCount--;

        if (this._rcCount === 0) {
            this._rcValid = false;
            RefCntBase._registry?.unregister(this);
            this._rcDestroy();
        }
    }

    protected abstract _rcDestroy(): void;
}

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
