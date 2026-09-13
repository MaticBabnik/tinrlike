export interface IPass {
    apply(): void;

    describe?(): string;

    /** releases pass-owned GPU resources; called by the RP when it's destroyed */
    destroy?(): void;
}
