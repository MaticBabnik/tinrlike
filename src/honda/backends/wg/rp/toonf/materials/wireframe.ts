import { type AlphaMode, MeshIndexType, type MeshV2, type Material, WireframeMaterial } from "@/honda/gpu2";
import type { Three } from "@/honda/util/types";
import { StructBuffer } from "../../../buffer";
import { bindGroupLayout } from "../../../bindGroupBuilder";
import type { WGBuf } from "../../../resources";
import type { ToonContext } from "../context";
import type { DrawBinder } from "../passes/draw";
import type { ToonDrawCall } from "../passes/gather.pass";
import { getWireframePipeline } from "../pipelines/wireframe.pipeline";
import type { IToonMatImpl, ToonMatSlot, ToonMatSlotBase, ToonMatTargets } from "./material";

type WireframeMat = Material<typeof WireframeMaterial>;

/** mirrors `struct WireframeMaterial` in toon.wgsl */
type WireframeUniforms = {
    color: Three<number>;
};

interface WireframeSlot extends ToonMatSlot {
    uniforms: StructBuffer<WireframeUniforms>;
}

const layoutDesc = bindGroupLayout("toonf/mat/wireframe").binding(0, "f", "buffer", { type: "uniform" });

const meshLayoutDesc = bindGroupLayout("toonf/mat/wireframe:mesh")
    .binding(0, "v", "buffer", { type: "read-only-storage" })
    .binding(1, "v", "buffer", { type: "read-only-storage" });

/**
 * Unlit wireframe. Draws the mesh as lines by pulling positions/indices from
 * storage in the vertex shader, so it needs no extra per-mesh line data.
 */
export class ToonWireframeImpl implements IToonMatImpl<typeof WireframeMaterial, WireframeSlot> {
    public readonly type = WireframeMaterial;
    public readonly layout: GPUBindGroupLayout;
    public readonly meshLayout: GPUBindGroupLayout;

    private _pipelines: Record<MeshIndexType, GPURenderPipeline>;
    private _meshGroups = new WeakMap<MeshV2, GPUBindGroup>();

    public constructor(
        private readonly ctx: ToonContext,
        targets: ToonMatTargets,
    ) {
        this.layout = layoutDesc.create(ctx.device);
        this.meshLayout = meshLayoutDesc.create(ctx.device);

        const desc = {
            material: this.layout,
            mesh: this.meshLayout,
            colorFormat: targets.color,
            depthFormat: targets.depth,
            multisample: targets.multisample,
        };

        this._pipelines = {
            [MeshIndexType.None]: getWireframePipeline(ctx, { ...desc, indexType: MeshIndexType.None }),
            [MeshIndexType.U16]: getWireframePipeline(ctx, { ...desc, indexType: MeshIndexType.U16 }),
            [MeshIndexType.U32]: getWireframePipeline(ctx, { ...desc, indexType: MeshIndexType.U32 }),
        };
    }

    public alloc(m: WireframeMat, base: ToonMatSlotBase): WireframeSlot {
        const s = base as WireframeSlot;

        s.uniforms = new StructBuffer<WireframeUniforms>(
            this.ctx.wg,
            this.ctx.struct("WireframeMaterial"),
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

    public update(m: WireframeMat, s: WireframeSlot): void {
        if (m.$uniformsDirty) this.writeUniforms(m, s);
    }

    public free(s: WireframeSlot): void {
        s.uniforms.destroy();
    }

    public mainPipeline(_alpha: AlphaMode): GPURenderPipeline {
        // the pipeline depends on the mesh's index type, see drawMain
        throw new Error("Wireframe materials draw through drawMain");
    }

    public depthPipeline(_alpha: AlphaMode, _shadow: boolean): GPURenderPipeline {
        // main pass only, never in the depth/shadow lists
        throw new Error("Wireframe materials are main pass only");
    }

    public drawMain(rp: GPURenderPassEncoder, draw: ToonDrawCall, binder: DrawBinder): void {
        const mesh = draw.mesh;

        binder.bind(this._pipelines[mesh.indexType], draw.slot.bindGroup);
        rp.setBindGroup(2, this.meshGroup(mesh));

        // every triangle becomes 3 lines (6 vertices)
        rp.draw(mesh.drawCount * 2, draw.nInstances, 0, draw.firstInstance);
    }

    private meshGroup(mesh: MeshV2): GPUBindGroup {
        let g = this._meshGroups.get(mesh);
        if (g) return g;

        const position = (mesh.position as WGBuf).buffer;
        // non-indexed meshes never read the indices, but the binding still needs a buffer
        const index = mesh.index ? (mesh.index as WGBuf).buffer : position;

        g = this.ctx.device.createBindGroup({
            label: `wireframe:${mesh.id}`,
            layout: this.meshLayout,
            entries: [
                { binding: 0, resource: { buffer: position } },
                { binding: 1, resource: { buffer: index } },
            ],
        });
        this._meshGroups.set(mesh, g);

        return g;
    }

    private writeUniforms(m: WireframeMat, s: WireframeSlot) {
        s.uniforms.set({ color: m.params.color });
        s.uniforms.push();

        m.$uniformsDirty = false;
    }
}
