import type { WGpuComposite } from "../../gpu/gpu";
import type { IPass } from "./passes/pass.interface";
import type { IResizable } from "../../texture";

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

    destroy(): void;
}
