import type { IRefCnt } from "@/honda/gpu2/interface/rc.interface";
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

    public printRcStats(): void {
        console.table(
            Array.from(this.rcResources).map((r) => ({
                label: r.label,
                type: r.constructor.name,
                rcCount: r.refCount,
            })),
        );
    }

    public startFrame(): void {}

    public render(): void {}

    public async frameEnd(): Promise<void> {
        return;
    }
}
