import type { IPass } from "./pass.interface";

export class SwitchPass implements IPass {
    constructor(
        private pass: IPass,
        private predicate: () => boolean,
    ) {}

    public apply(): void {
        if (this.predicate()) {
            this.pass.apply();
        }
    }

    public destroy(): void {
        this.pass.destroy?.();
    }

    public describe(): string {
        return `conditional(${this.pass.describe?.() ?? this.pass.constructor.name})`;
    }
}
