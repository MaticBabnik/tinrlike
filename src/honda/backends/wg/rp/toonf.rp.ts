import { VisualSrv } from "@/honda/services";
import { CameraSys, MeshSys, LightSys } from "@/honda/systems";
import type { ECS } from "@/honda/core/ecs";
import type { AnyMaterial } from "@/honda/gpu2/material";
import type { Mat4 } from "wgpu-matrix";
import { Buffer, StructArrayBuffer, StructBuffer } from "../buffer";
import type { WGpuComposite } from "../gpu/gpu";
import {
    ViewportTexture,
    ViewportMipTexture,
    ShadowMapTexture,
} from "../texture";
import { SwitchbleTView } from "../texture/switch";
import { FunctionPass } from "./common/passes/function.pass";
import { SwitchPass } from "./common/passes/switch.pass";
import type {
    IWGRenderPipeline,
    IWGRPFactoryFunction,
} from "./common/rp.interface";
import { WGRenderPipelineBase } from "./common/rpbase";
import { ToonContext } from "./toonf/context";
import { ToonFresnelImpl } from "./toonf/materials/fresnel";
import { ToonPbrImpl } from "./toonf/materials/pbr";
import { ToonMaterialRegistry } from "./toonf/materials/registry";
import { BloomPass } from "./toonf/passes/bloom.pass";
import { DepthPass } from "./toonf/passes/depth.pass";
import {
    type MeshDraws2,
    type UniformData,
    type ToonMeshInstance,
    type GPUPostCfg,
    GatherDataPass,
} from "./toonf/passes/gather.pass";
import { GlitchPass } from "./toonf/passes/glitch.pass";
import { MainPass } from "./toonf/passes/main.pass";
import { PostPass } from "./toonf/passes/post.pass";
import { ResolvePass } from "./toonf/passes/resolve.pass";
import { ShadowPass } from "./toonf/passes/shadow.pass";

/**
 * Settings are fixed for the lifetime of the RP,
 * to change them create a new RP (`wg.switchRp(makeToonForward(...))`).
 */
export interface ToonForwardRPSettings {
    /** MSAA sample count of the depth/main passes */
    multisample: 1 | 4;
    /** resolution of a single (square) shadow map */
    shadowMapSize: number;
    /** max number of shadow casting lights (shadow map array layers) */
    shadowMapCount: number;

    /** canvas resolution multiplier, applied on top of the DPR */
    renderScale: number;
    /** DPR override, `undefined` keeps the surface's current DPR */
    dpr?: number;
    /** max anisotropy of linearly filtered material samplers */
    anisotropy: 1 | 4 | 8 | 16;
}

export const DEFAULT_TOONF_SETTINGS: Readonly<ToonForwardRPSettings> = {
    multisample: 4,
    shadowMapSize: 2048,
    shadowMapCount: 4,
    renderScale: 1,
    anisotropy: 4,
};

export function makeToonForward(
    ecs: ECS,
    settings: Partial<ToonForwardRPSettings> = {},
): IWGRPFactoryFunction<ToonForwardRP> {
    const s = { ...DEFAULT_TOONF_SETTINGS, ...settings };
    return (wg: WGpuComposite) => new ToonForwardRP(wg, ecs, s);
}

export class ToonForwardRP
    extends WGRenderPipelineBase
    implements IWGRenderPipeline
{
    public readonly ctx: ToonContext;
    public readonly materials: ToonMaterialRegistry;

    public constructor(
        wg: WGpuComposite,
        public readonly ecs: ECS,
        public readonly settings: Readonly<ToonForwardRPSettings>,
    ) {
        super(wg);

        this.ctx = new ToonContext(wg);
        this.materials = new ToonMaterialRegistry(wg);

        this.applyGpuSettings();
        this.setupPipeline();
    }

    // surface/sampler state lives on the GPU, not the RP
    private applyGpuSettings() {
        const { renderScale, dpr, anisotropy } = this.settings;

        this.wg.surface.setRenderScale(renderScale);
        if (dpr !== undefined) this.wg.surface.setDpr(dpr);
        this.wg.resources.samplerCache.setAnisotropy(anisotropy);
    }

    public get id(): string {
        return "ToonF";
    }

    public get description(): string {
        const viewports = this._viewports
            .values()
            .map(
                (t) =>
                    `${t.label ?? "unnamed"}(<${t.format} ${t.width}x${t.height}>)`,
            )
            .toArray()
            .join(", ");

        const passes = this._passes
            .map(
                (p, i) =>
                    `${i.toString().padStart(2, " ")}: ${p.describe?.() ?? p.constructor.name}`,
            )
            .join("\n");

        const settings = JSON.stringify(this.settings);

        return `${this.id}\n\tSettings: ${settings}\n\tViewports: ${viewports}\n\tPasses: ${passes}\n\tMaterials: ${this.materials.liveCount}`;
    }

    public $freeMaterial(m: AnyMaterial): void {
        this.materials.free(m);
    }

    public destroy(): void {
        this.materials.destroy();
        super.destroy();
    }

    private setupPipeline() {
        const wg = this.wg;
        const ctx = this.ctx;
        const ecs = this.ecs;
        const { multisample } = this.settings;
        const limits = wg.device.limits;

        const shadowMapSize = Math.min(
            this.settings.shadowMapSize,
            limits.maxTextureDimension2D,
        );
        const shadowMapCount = Math.max(
            1,
            Math.min(this.settings.shadowMapCount, limits.maxTextureArrayLayers),
        );

        // NOTE: render scale is applied by the canvas surface, viewports are 1:1 with it
        const shadedRenderTarget = new ViewportTexture(
            "rgba16float",
            1,
            "shaded",
            multisample,
        );
        this.addViewport(shadedRenderTarget);

        let shadedRead: ViewportTexture<"rgba16float">;

        if (multisample > 1) {
            shadedRead = new ViewportTexture(
                "rgba16float",
                1,
                "shadedResolve",
                false,
            );
            this.addViewport(shadedRead);
        } else {
            shadedRead = shadedRenderTarget;
        }

        const bloom = new ViewportMipTexture(
            "rgba16float",
            10, // dont limit mips
            1,
            "bloom",
        );
        this.addViewport(bloom);

        const depth = new ViewportTexture(
            "depth24plus",
            1,
            "depth",
            multisample,
        );
        this.addViewport(depth);

        const postTmp = new ViewportTexture(
            wg.surface.format,
            1,
            "postTmp",
            false,
        );
        this.addViewport(postTmp);

        const shadowmaps = new ShadowMapTexture(
            shadowMapCount,
            "depth24plus",
            shadowMapSize,
            "shadowmaps",
        );
        shadowmaps.alloc(wg.device);
        this.track(shadowmaps);

        // material implementations, built against the targets above
        const matTargets = {
            color: shadedRenderTarget.format,
            depth: depth.format,
            multisample,
            shadow: shadowmaps.format,
        };
        this.materials.register(new ToonPbrImpl(ctx, matTargets));
        this.materials.register(new ToonFresnelImpl(ctx, matTargets));

        const meshDraws: MeshDraws2 = {
            main: {
                blend: [],
                opaque: [],
            },
            shadows: [],
        };

        const uniformData = {
            maxShadowmaps: shadowmaps.nLights,
            shadowmapVPs: [] as Mat4[],
        } as UniformData;

        const shadowBuffer = new Buffer(
            wg,
            // one (aligned) VP matrix per shadow map
            Math.max(limits.minUniformBufferOffsetAlignment, 64) *
                shadowMapCount,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "shadowmapUniforms",
        );
        this.track(shadowBuffer);

        const meshBuf = new StructArrayBuffer<ToonMeshInstance>(
            wg,
            ctx.struct("Instance"),
            8192,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            "meshInstanceBuffer",
        );
        this.track(meshBuf);

        const lightBuf = new StructArrayBuffer(
            wg,
            ctx.struct("Light"),
            128,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "lightInstanceBuffer",
        );
        this.track(lightBuf);

        const postBuf = new StructBuffer<GPUPostCfg>(
            wg,
            ctx.struct("PostCfg"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "postConfigBuffer",
        );
        this.track(postBuf);

        // canvas target isn't ours, so it's not tracked
        const post2target = new SwitchbleTView(
            "post2target",
            wg.surface.target,
            postTmp,
        );

        const visualService = ecs.getService(VisualSrv);

        this.addPass(
            new FunctionPass(() => {
                post2target.resetSwitched();

                // when enabled it activates the 2nd post2target,
                // which allows for glitching the final image before it gets drawn to the canvas
                post2target.activate(visualService.glitchConfig.enabled);
            }),
        );

        // 0. gather data
        // TODO(mbabnik): fetch skeleton data
        this.addPass(
            new GatherDataPass(
                wg,
                this.materials,
                ecs.getSystem(CameraSys),
                ecs.getSystem(MeshSys),
                ecs.getSystem(LightSys),
                visualService,
                meshDraws,
                meshBuf,
                lightBuf,
                shadowBuffer,
                uniformData,
                postBuf,
            ),
        );

        // 1. depth opaque
        // TODO(mbabnik): maybe draw skinned meshes? (they are bad occluders so maybe don't)
        this.addPass(
            new DepthPass(ctx, uniformData, meshDraws, meshBuf, depth),
        );

        // 2. shadowmaps
        // TODO(mbabnik): draw skinned meshes. (they need shadows lol)
        this.addPass(
            new ShadowPass(
                ctx,
                uniformData,
                meshDraws,
                meshBuf,
                shadowmaps,
                shadowBuffer.gpuBuf,
            ),
        );

        // 3. render all
        // TODO(mbabnik): draw skinned meshes!
        this.addPass(
            new MainPass(
                ctx,
                uniformData,
                meshDraws,
                meshBuf,
                lightBuf,
                shadedRenderTarget,
                depth,
                shadowmaps,
            ),
        );

        if (multisample > 1) {
            // 3.a resolve
            this.addPass(new ResolvePass(wg, shadedRenderTarget, shadedRead));
        }

        // 4. bloom
        this.addPass(
            new SwitchPass(
                new BloomPass(
                    ctx,
                    visualService.bloomConfig,
                    shadedRead,
                    bloom,
                ),
                () => visualService.postConfig.bloomPower > 0,
            ),
        );

        // 5. postprocess; render either as final or to a temp texture
        this.addPass(
            new PostPass(ctx, postBuf.gpuBuf, shadedRead, bloom, post2target),
        );

        // 6. glitch pass; only runs if enabled, and renders to the canvas
        this.addPass(
            new SwitchPass(
                new GlitchPass(
                    ctx,
                    visualService.glitchConfig,
                    post2target,
                    wg.surface.target,
                ),
                () => visualService.glitchConfig.enabled,
            ),
        );
    }
}
