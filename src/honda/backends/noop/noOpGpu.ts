import type { IRefCnt } from "@/honda/util/managedResource";
import type {
    IGPUBufDesc,
    IGPUImplementation,
    IGPUMatDesc,
    IGPUMat,
    IGPUTexData,
    IGPUTexDataDesc,
    IGPUTexDesc,
} from "../../gpu2/interface";
import { NoOpBuf } from "./noOpBuf";
import { NoOpMat } from "./noOpMaterial";
import { NoOpTex } from "./noOpTex";
import { NoOpTexData } from "./noOpTexData";
import type { Material as MV2, AnyMatType } from "@/honda/gpu2/material";

/**
 * A no-operation GPU implementation that serves as a placeholder.
 */
export class NoOpGpu implements IGPUImplementation {
    private rcResources = new Set<IRefCnt & { get label(): string }>();

    public get viewportWidth(): number {
        return 1024;
    }

    public get viewportHeight(): number {
        return 1024;
    }

    public get aspectRatio(): number {
        return this.viewportWidth / this.viewportHeight;
    }

    public createTextureData(d: IGPUTexDataDesc) {
        const r = new NoOpTexData(d);
        this.rcResources.add(r);
        return r;
    }

    public createTexture(d: IGPUTexDesc, data: IGPUTexData): NoOpTex {
        const r = new NoOpTex(d, data);
        this.rcResources.add(r);
        return r;
    }

    public createTextureWithData(d: IGPUTexDesc & IGPUTexDataDesc): NoOpTex {
        const data = this.createTextureData(d);
        return this.createTexture(d, data);
    }

    public createBuffer(d: IGPUBufDesc): NoOpBuf {
        const r = new NoOpBuf(d);
        this.rcResources.add(r);
        return r;
    }

    public createMaterial(d: IGPUMatDesc): IGPUMat {
        const r = new NoOpMat(d);
        this.rcResources.add(r);
        return r;
    }

    public $allocMaterial<T extends AnyMatType>(mv2: MV2<T>): void {
        this.rcResources.add(mv2);
    }

    public $freeMaterial<T extends AnyMatType>(mv2: MV2<T>): void {
        this.rcResources.delete(mv2);
    }

    public printRcStats(): void {
        console.table(
            Array.from(this.rcResources).map((r) => ({
                label: r.label,
                type: r.constructor.name,
                rcCount: r.refCount,
            })),
        );
    }

    public frame(): void {}
}
