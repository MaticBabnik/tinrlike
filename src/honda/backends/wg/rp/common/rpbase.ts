import {
    type TrackableResource,
    isManagedResource,
    isRefCountable,
} from "@/honda/util/managedResource";
import { assert } from "@/honda/util";
import type { WGpuComposite } from "../../gpu/gpu";
import type { IResizable } from "../../texture";
import type { IPass } from "./passes/pass.interface";
import type { IWGRenderPipeline } from "./rp.interface";
import type { PartialUnion } from "@/honda/util/types";

type PUTrackable = PartialUnion<TrackableResource>;

export abstract class WGRenderPipelineBase implements Omit<
    IWGRenderPipeline,
    "id" | "description"
> {
    protected _passes: IPass[] = [];
    protected _viewports: Set<IResizable> = new Set();
    protected _resources: Set<TrackableResource> = new Set();

    public constructor(public wg: WGpuComposite) {}

    /*
        Public readonly proxies
    */

    public get passes(): readonly IPass[] {
        return this._passes;
    }

    public get viewports(): ReadonlySet<IResizable> {
        return this._viewports;
    }

    public frame(): void {
        for (const p of this._passes) p.apply();
    }

    /*
        Pass management
    */

    protected addPass(p: IPass) {
        this._passes.push(p);
        this.autotrack(p);
    }

    protected insertPass(after: number, p: IPass) {
        this._passes.splice(after, 0, p);
        this.autotrack(p);
    }

    protected removePass(p: IPass | number) {
        const idx = typeof p === "number" ? p : this._passes.indexOf(p);

        assert(idx >= 0 && idx < this._passes.length, "No such pass");

        const removed = this._passes.splice(idx, 1);
        this.autountrack(removed);
    }

    /*
        Viewport management
    */

    protected addViewport(v: IResizable) {
        this._viewports.add(v);
        this.autotrack(v);
    }

    protected removeViewport(v: IResizable) {
        if (this._viewports.delete(v)) {
            this.autountrack(v);
        }
    }

    /*
        Tracking
        - appends/removes resources from delete list
        - increments/decrements refcounts
    */

    protected autotrack(maybeRes: unknown) {
        if (isManagedResource(maybeRes)) this.track(maybeRes);
    }

    protected autountrack(maybeRes: unknown) {
        if (isManagedResource(maybeRes)) this.untrack(maybeRes);
    }

    protected track(res: TrackableResource) {
        if (this._resources.has(res)) return;

        if (isRefCountable(res)) {
            res.rcUse();
        }

        this._resources.add(res);
    }

    protected untrack(res: TrackableResource) {
        if (this._resources.delete(res)) {
            if (isRefCountable(res)) {
                res.rcRelease();
            }
        }
    }

    // destroys all still tracked resources
    public destroy(): void {
        this._viewports.clear();
        this._passes.length = 0;

        for (const r of this._resources as Set<PUTrackable>) {
            if (isRefCountable(r)) {
                r.rcRelease();
                continue;
            }

            r.destroy?.();
            r.dispose?.();
        }
    }
}

// public getShaderModule(key: string) {
//     const s = nn(this._shaders[key]);

//     if (!s.module) {
//         s.module = this.device.createShaderModule({
//             label: key,
//             code: s.code,
//         });
//     }

//     return s.module;
// }

// public getStruct(key: string, name: string) {
//     const s = nn(this._shaders[key]);
//     return nn(s.defs.structs[name]);
// }
