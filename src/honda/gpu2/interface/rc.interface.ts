export interface IRefCnt {
    get valid(): boolean;
    get refCount(): number;
    
    rcUse(): void;
    rcRelease(): void;
}
