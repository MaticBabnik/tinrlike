import type { IRefCnt } from "../interface/rc.interface";

export abstract class RefCntBase implements IRefCnt {
    protected _rcValid: boolean = true;
    protected _rcCount: number = 0;

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
            console.log(
                "RefCountBase: Destroying",
                (this as { name?: string }).name ??
                    (this as { label?: string }).label ??
                    this.constructor.name,
            );
            this._rcDestroy();
        }
    }

    protected abstract _rcDestroy(): void;
}
