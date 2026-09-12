import { VisualSrv } from "@/honda/services";
import { CameraSys, MeshSys, LightSys } from "@/honda/systems";
import type { Mat4 } from "wgpu-matrix";
import { Buffer, StructArrayBuffer, StructBuffer } from "../buffer";
import {
    ViewportTexture,
    ViewportMipTexture,
    ShadowMapTexture,
    type IResizable,
} from "../texture";
import { SwitchbleTView } from "../texture/switch";
import { FunctionPass } from "./common/passes/function.pass";
import { SwitchPass } from "./common/passes/switch.pass";
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
import type { IWGRenderPipeline, IWGRPFactoryFunction } from "./common/rp.interface";
import type { WGpu } from "../gpu";
import type { IPass } from "./common/passes/pass.interface";
import type { ECS } from "@/honda/core/ecs";

interface ToonForwardRPSettings {
    multisample: 1 | 4;
    renderScale: number;
    shadowMapSize: number;
}

export function makeToonForward(
    ecs: ECS,
    settings: ToonForwardRPSettings,
): IWGRPFactoryFunction<ToonForwardRP> {
    return (g: WGpu) => {
        return new ToonForwardRP(ecs, g, settings);
    };
}

export class ToonForwardRP implements IWGRenderPipeline {
    public passes: IPass[] = [];
    public viewports: IResizable[] = [];

    public constructor(
        public ecs: ECS,
        public wg: WGpu,
        public settings: ToonForwardRPSettings,
    ) {}

    public get id(): string {
        return "ToonF";
    }

    public get description(): string {
        const viewports = this.viewports
            .map(
                (t) =>
                    t.label ??
                    `${t.label ?? "unnamed"}(<${t.format} ${t.width}x${t.height}>)`,
            )
            .join(", ");

        const passes = this.passes
            .map((p) => p.describe?.() ?? p.constructor.name)
            .join(", ");

        return `${this.id}\n\tViewports: ${viewports}\n\tPases:${passes}`;
    }

    public destroy(): void {}

    public setupPipeline() {
        const wg = this.wg;
        const ecs = this.ecs;
        const { multisample, renderScale, shadowMapSize } = this.settings;

        let shadedRead: ViewportTexture<"rgba16float">;

        const shadedRenderTarget = new ViewportTexture(
            "rgba16float",
            renderScale,
            "shaded",
            multisample,
        );

        if (multisample > 1) {
            shadedRead = new ViewportTexture(
                "rgba16float",
                renderScale,
                "shadedResolve",
                false,
            );
            wg.addViewport(shadedRead);
        } else {
            shadedRead = shadedRenderTarget;
        }

        const bloom = new ViewportMipTexture(
            "rgba16float",
            10, // dont limit mips
            renderScale,
            "bloom",
        );

        const depth = new ViewportTexture(
            "depth24plus",
            renderScale,
            "depth",
            multisample,
        );
        const shadowmaps = new ShadowMapTexture(
            4,
            "depth24plus",
            shadowMapSize * 4,
            "shadowmaps",
        );

        const postTmp = new ViewportTexture(
            wg.pFormat,
            renderScale,
            "postTmp",
            false,
        );

        shadowmaps.alloc(wg.device);

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
            Math.max(wg.device.limits.minUniformBufferOffsetAlignment, 64) * 8,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "shadowmapUniforms",
        );

        const meshBuf = new StructArrayBuffer<ToonMeshInstance>(
            wg,
            wg.getStruct("toonf/toon", "Instance"),
            8192,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            "meshInstanceBuffer",
        );

        // TODO: get own structs
        const lightBuf = new StructArrayBuffer(
            wg,
            wg.getStruct("toonf/toon", "Light"),
            128,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "lightInstanceBuffer",
        );

        const postBuf = new StructBuffer<GPUPostCfg>(
            wg,
            wg.getStruct("toonf/toon", "PostCfg"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "postConfigBuffer",
        );

        wg.addViewport(shadedRenderTarget);
        wg.addViewport(depth);
        wg.addViewport(bloom);
        wg.addViewport(postTmp);

        const post2target = new SwitchbleTView(
            "post2target",
            wg.canvasTexture,
            postTmp,
        );

        const visualService = ecs.getService(VisualSrv);

        wg.addPass(
            new FunctionPass(() => {
                post2target.resetSwitched();

                // when enabled it activates the 2nd post2target,
                // which allows for glitching the final image before it gets drawn to the canvas
                post2target.activate(visualService.glitchConfig.enabled);
            }),
        );

        // 0. gather data
        // TODO(mbabnik): fetch skeleton data
        wg.addPass(
            new GatherDataPass(
                wg,
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
        wg.addPass(new DepthPass(wg, uniformData, meshDraws, meshBuf, depth));

        // 2. shadowmaps
        // TODO(mbabnik): draw skinned meshes. (they need shadows lol)
        wg.addPass(
            new ShadowPass(
                wg,
                uniformData,
                meshDraws,
                meshBuf,
                shadowmaps,
                shadowBuffer.gpuBuf,
            ),
        );

        // 3. render all
        // TODO(mbabnik): draw skinned meshes!
        wg.addPass(
            new MainPass(
                wg,
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
            wg.addPass(new ResolvePass(wg, shadedRenderTarget, shadedRead));
        }

        // 4. bloom
        wg.addPass(
            new SwitchPass(
                new BloomPass(wg, visualService.bloomConfig, shadedRead, bloom),
                () => visualService.postConfig.bloomPower > 0,
            ),
        );

        // 5. postprocess; render either as final or to a temp texture
        wg.addPass(
            new PostPass(wg, postBuf.gpuBuf, shadedRead, bloom, post2target),
        );

        // 6. glitch pass; only runs if enabled, and renders to the canvas
        wg.addPass(
            new SwitchPass(
                new GlitchPass(
                    wg,
                    visualService.glitchConfig,
                    post2target,
                    wg.canvasTexture,
                ),
                () => visualService.glitchConfig.enabled,
            ),
        );
    }
}
