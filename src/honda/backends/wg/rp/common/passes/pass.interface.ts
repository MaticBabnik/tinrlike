export interface IPass {
    apply(): void;

    describe?(): string;

    destroy?(): void;
}
