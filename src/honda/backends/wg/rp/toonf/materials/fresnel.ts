import { type AlphaMode, FresnelMaterial, type Material } from "@/honda/gpu2";
import type { Three } from "@/honda/util/types";
import { StructBuffer } from "../../../buffer";
import { bindGroupLayout } from "../../../bindGroupBuilder";
import type { ToonContext } from "../context";
import { getFresnelPipeline } from "../pipelines/fresnel.pipeline";
import type { IToonMatImpl, ToonMatSlot, ToonMatSlotBase, ToonMatTargets } from "./material";

type FresnelMat = Material<typeof FresnelMaterial>;

/** mirrors `struct FresnelMaterial` in toon.wgsl */
type FresnelUniforms = {
    color: Three<number>;
    power: number;
};

interface FresnelSlot extends ToonMatSlot {
    uniforms: StructBuffer<FresnelUniforms>;
}

const layoutDesc = bindGroupLayout("toonf/mat/fresnel").binding(0, "f", "buffer", { type: "uniform" });

/**
 * Emission only fresnel shell. Main pass only, the render state is fixed by the type.
 */
export class ToonFresnelImpl implements IToonMatImpl<typeof FresnelMaterial, FresnelSlot> {
    public readonly type = FresnelMaterial;
    public readonly layout: GPUBindGroupLayout;

    private _main: GPURenderPipeline;

    public constructor(
        private readonly ctx: ToonContext,
        targets: ToonMatTargets,
    ) {
        this.layout = layoutDesc.create(ctx.device);

        this._main = getFresnelPipeline(ctx, {
            material: this.layout,
            colorFormat: targets.color,
            depthFormat: targets.depth,
            multisample: targets.multisample,
        });
    }

    public alloc(m: FresnelMat, base: ToonMatSlotBase): FresnelSlot {
        const s = base as FresnelSlot;

        s.uniforms = new StructBuffer<FresnelUniforms>(
            this.ctx.wg,
            this.ctx.struct("FresnelMaterial"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            m.label,
        );

        // no textures, so the bind group never changes
        s.bindGroup = this.ctx.device.createBindGroup({
            label: m.label,
            layout: this.layout,
            entries: [{ binding: 0, resource: { buffer: s.uniforms.gpuBuf } }],
        });
        m.$texturesDirty = false;

        this.writeUniforms(m, s);

        return s;
    }

    public update(m: FresnelMat, s: FresnelSlot): void {
        if (m.$uniformsDirty) this.writeUniforms(m, s);
    }

    public free(s: FresnelSlot): void {
        s.uniforms.destroy();
    }

    public mainPipeline(_alpha: AlphaMode): GPURenderPipeline {
        return this._main;
    }

    public depthPipeline(_alpha: AlphaMode, _shadow: boolean): GPURenderPipeline {
        // blended materials never reach the depth/shadow lists
        throw new Error("Fresnel materials are main pass only");
    }

    private writeUniforms(m: FresnelMat, s: FresnelSlot) {
        s.uniforms.set({
            color: m.params.color,
            power: m.params.power,
        });
        s.uniforms.push();

        m.$uniformsDirty = false;
    }
}
