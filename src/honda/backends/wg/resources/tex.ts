import { GPUTexBase } from "../../../gpu2/base/textureBase";
import type {
    IGPUTex,
    IGPUTexData,
    IGPUTexDesc,
} from "../../../gpu2/interface";
import type { IWGResourceContainer } from "../gpu/resources";
import type { WGSampler } from "./sampler";

export class WGTex extends GPUTexBase implements IGPUTex {
    protected $sampler: WGSampler;

    public constructor(
        protected gpu: IWGResourceContainer,
        d: IGPUTexDesc,
        data: IGPUTexData,
    ) {
        super(d, data);

        this.$sampler = gpu.getSampler(d);
    }

    public get sampler(): GPUSampler {
        return this.$sampler.sampler;
    }
}
