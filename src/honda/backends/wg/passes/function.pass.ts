import type { IPass } from "./pass.interface";

export class FunctionPass implements IPass {
    public constructor(private fn: () => void) {}

    public apply(): void {
        this.fn();
    }
}
