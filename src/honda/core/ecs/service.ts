export interface IService {
    readonly name: string;

    earlyUpdate?(): void;
    update?(): void;
    lateUpdate?(): void;
    fixedUpdate?(): void;
}
