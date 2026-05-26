export interface IComponent {
    name: string | undefined;
    destroy?(): void;
}
