import { AlphaMode, type Material, type IGPUTex, PbrMaterial } from "@/honda/gpu2";
import type { Four, Three } from "@/honda/util/types";
import { StructBuffer } from "../../../buffer";
import { bindGroupLayout } from "../../../bindGroupBuilder";
import type { WGTex, WGTexData } from "../../../resources";
import type { ToonContext } from "../context";
import { getDepthPipeline } from "../pipelines/depth.pipeline";
import { getMainPipeline } from "../pipelines/main.pipeline";
import type { IToonMatImpl, ToonMatSlot, ToonMatSlotBase, ToonMatTargets } from "./material";

type PbrMat = Material<typeof PbrMaterial>;

/** mirrors `struct Material` in toon.wgsl */
type PbrUniforms = {
    baseFactor: Four<number>;
    emissionFactor: Three<number>;
    metalFactor: number;
    roughFactor: number;
    normalScale: number;
    alphaCutoff: number;
    ignoreAlpha: number;
};

interface PbrSlot extends ToonMatSlot {
    uniforms: StructBuffer<PbrUniforms>;
    samplerVersion: number;
}

const layoutDesc = bindGroupLayout("toonf/mat/pbr")
    .binding(0, "f", "buffer", { type: "uniform" })
    .binding(1, "f", "texture")
    .binding(2, "f", "sampler")
    .binding(3, "f", "texture")
    .binding(4, "f", "sampler")
    .binding(5, "f", "texture")
    .binding(6, "f", "sampler");

const isBlend = (a: AlphaMode) => a >= AlphaMode.AlphaBlend;

/**
 * glTF PBR material, shaded with the toon BRDF.
 */
export class ToonPbrImpl implements IToonMatImpl<typeof PbrMaterial, PbrSlot> {
    public readonly type = PbrMaterial;
    public readonly layout: GPUBindGroupLayout;

    private _mainClip: GPURenderPipeline;
    private _mainBlend: GPURenderPipeline;
    private _depthOpaque: GPURenderPipeline;
    private _depthClip: GPURenderPipeline;
    private _shadowOpaque: GPURenderPipeline;
    private _shadowClip: GPURenderPipeline;

    public constructor(
        private readonly ctx: ToonContext,
        targets: ToonMatTargets,
    ) {
        this.layout = layoutDesc.create(ctx.device);

        const main = {
            material: this.layout,
            colorFormat: targets.color,
            depthFormat: targets.depth,
            multisample: targets.multisample,
        };
        this._mainClip = getMainPipeline(ctx, { ...main, kind: "mainAlphaClip" });
        this._mainBlend = getMainPipeline(ctx, {
            ...main,
            kind: "mainAlphaBlend",
        });

        const depth = {
            material: this.layout,
            format: targets.depth,
            multisample: targets.multisample,
            shadow: false,
        };
        this._depthOpaque = getDepthPipeline(ctx, { ...depth, kind: "depthOpaque" });
        this._depthClip = getDepthPipeline(ctx, { ...depth, kind: "depthAlphaClip" });

        const shadow = {
            material: this.layout,
            format: targets.shadow,
            multisample: 1,
            shadow: true,
        };
        this._shadowOpaque = getDepthPipeline(ctx, {
            ...shadow,
            kind: "depthOpaque",
        });
        this._shadowClip = getDepthPipeline(ctx, {
            ...shadow,
            kind: "depthAlphaClip",
        });
    }

    public alloc(m: PbrMat, base: ToonMatSlotBase): PbrSlot {
        const s = base as PbrSlot;

        s.uniforms = new StructBuffer<PbrUniforms>(
            this.ctx.wg,
            this.ctx.struct("Material"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            m.label,
        );
        s.samplerVersion = -1;

        this.writeUniforms(m, s);
        this.writeBindGroup(m, s);

        return s;
    }

    public update(m: PbrMat, s: PbrSlot): void {
        if (m.$uniformsDirty) this.writeUniforms(m, s);

        // anisotropy changes recreate samplers, which invalidates bind groups
        if (m.$texturesDirty || s.samplerVersion !== this.ctx.wg.resources.samplerCache.version) {
            this.writeBindGroup(m, s);
        }
    }

    public free(s: PbrSlot): void {
        s.uniforms.destroy();
    }

    public mainPipeline(alpha: AlphaMode): GPURenderPipeline {
        return isBlend(alpha) ? this._mainBlend : this._mainClip;
    }

    public depthPipeline(alpha: AlphaMode, shadow: boolean): GPURenderPipeline {
        if (alpha === AlphaMode.Opaque) {
            return shadow ? this._shadowOpaque : this._depthOpaque;
        }
        return shadow ? this._shadowClip : this._depthClip;
    }

    private writeUniforms(m: PbrMat, s: PbrSlot) {
        const p = m.params;

        s.uniforms.set({
            baseFactor: p.colorFactor,
            emissionFactor: p.emissionFactor,
            metalFactor: p.metallicFactor,
            roughFactor: p.roughnessFactor,
            normalScale: p.normalScale,
            alphaCutoff: m.render.alphaClip,
            ignoreAlpha: m.render.alphaMode === AlphaMode.Opaque ? 1 : 0,
        });
        s.uniforms.push();

        m.$uniformsDirty = false;
    }

    private writeBindGroup(m: PbrMat, s: PbrSlot) {
        const p = m.params;

        const [base, baseSmp] = this.texture(p.baseTexture, "rgba8unorm-srgb");
        const [mr, mrSmp] = this.texture(p.metRghTexture, "rgba8unorm");
        const [ems, emsSmp] = this.texture(p.emissionTexture, "rgba8unorm");

        s.bindGroup = this.ctx.device.createBindGroup({
            label: m.label,
            layout: this.layout,
            entries: [
                { binding: 0, resource: { buffer: s.uniforms.gpuBuf } },
                { binding: 1, resource: base },
                { binding: 2, resource: baseSmp },
                { binding: 3, resource: mr },
                { binding: 4, resource: mrSmp },
                { binding: 5, resource: ems },
                { binding: 6, resource: emsSmp },
            ],
        });

        s.samplerVersion = this.ctx.wg.resources.samplerCache.version;
        m.$texturesDirty = false;
    }

    private texture(tex: IGPUTex | undefined, format: GPUTextureFormat): [GPUTextureView, GPUSampler] {
        const t = (tex ?? this.ctx.wg.resources.defaultTexture) as WGTex;
        const d = t.data as WGTexData;

        return [d.views[format] ?? d.nativeView, t.sampler];
    }
}
