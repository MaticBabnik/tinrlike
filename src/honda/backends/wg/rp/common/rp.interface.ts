import type { WGpuComposite } from "../../gpu/gpu";
import type { IPass } from "./passes/pass.interface";
import type { IResizable } from "../../texture";
import type { AnyMaterial } from "@/honda/gpu2/material";

export interface IWGRPFactoryObject<
    T extends IWGRenderPipeline = IWGRenderPipeline,
> {
    create(gpu: WGpuComposite): T;
}

export type IWGRPFactoryFunction<
    T extends IWGRenderPipeline = IWGRenderPipeline,
> = (gpu: WGpuComposite) => T;

export type IWGRPFactory<T extends IWGRenderPipeline = IWGRenderPipeline> =
    | IWGRPFactoryFunction<T>
    | IWGRPFactoryObject<T>;

export interface IWGRenderPipeline {
    get id(): string;
    get description(): string;
    get wg(): WGpuComposite;

    get passes(): readonly IPass[];
    get viewports(): ReadonlySet<IResizable>;

    frame(): void;

    /** eagerly create backend data for a material (optional, RPs may do it lazily) */
    $allocMaterial?(m: AnyMaterial): void;

    /** the material is gone, drop its backend data */
    $freeMaterial?(m: AnyMaterial): void;

    destroy(): void;
}
