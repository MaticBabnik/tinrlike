import type { IPass } from "./pass.interface";
import { type StructArrayBuffer, StructBuffer } from "../buffer";
import type { WGpu } from "../gpu";
import type { DrawCall, Instance, UniformData } from "./gatherData.pass";
import type { WGMat } from "../resources/mat";
import type { WGBuf } from "../resources/buf";
import { type Four, MeshIndexType } from "@/honda/gpu2";
import type { IResizable, ITViewable, ViewportTexture } from "../textures";
import type { DepthFormats } from "../textures/types";
import { getGPipeline } from "../pipelines";

export class GBufferPass implements IPass {
    protected uniforms: StructBuffer;
    protected bindGroup: GPUBindGroup;
    protected skinBindGroup: GPUBindGroup;

    private _gPipeline: GPURenderPipeline;
    private _gNormPipeline: GPURenderPipeline;
    private _gSkinPipeline: GPURenderPipeline;

    constructor(
        private g: WGpu,

        private uniformData: UniformData,
        private meshDrawCalls: DrawCall[],
        meshInstanceBuffer: StructArrayBuffer,
        private skinInstances: Instance[],
        skinMeshInstanceBuffer: StructArrayBuffer,

        private gBase: ITViewable,
        private gNormal: ITViewable,
        private gMtlRgh: ITViewable,
        private gEmission: ITViewable,
        private gDepth: ITViewable,
    ) {
        this.uniforms = new StructBuffer(
            g,
            g.getStruct("g", "Uniforms"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "gbufUniforms",
        );

        this.bindGroup = g.device.createBindGroup({
            label: "gbufBG",
            layout: g.bindGroupLayouts.g,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniforms.gpuBuf },
                },
                {
                    binding: 1,
                    resource: { buffer: meshInstanceBuffer.gpuBuf },
                },
            ],
        });

        this.skinBindGroup = g.device.createBindGroup({
            label: "gSkinBG",
            layout: g.bindGroupLayouts.gskin,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniforms.gpuBuf },
                },
                {
                    binding: 1,
                    resource: { buffer: skinMeshInstanceBuffer.gpuBuf },
                },
            ],
        });

        const fmts = [
            this.gBase.format,
            this.gNormal.format,
            this.gMtlRgh.format,
            this.gEmission.format,
        ] as Four<GPUTextureFormat>;

        this._gPipeline = getGPipeline(this.g, "g", fmts);
        this._gNormPipeline = getGPipeline(this.g, "gNorm", fmts);
        this._gSkinPipeline = getGPipeline(this.g, "gSkin", fmts);
    }

    apply(): void {
        this.uniforms.set({ viewProjection: this.uniformData.vp });

        this.uniforms.push();

        const rp = this.g.cmdEncoder.beginRenderPass({
            label: "gpass",
            colorAttachments: [
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.gBase.view,
                },
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.gNormal.view,
                },
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.gMtlRgh.view,
                },
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.gEmission.view,
                },
            ],
            depthStencilAttachment: {
                view: this.gDepth.view,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 0,
            },
        });

        this.render(rp);
        this.renderSkinned(rp);

        rp.end();
    }

    render(rp: GPURenderPassEncoder) {
        let activeMat: WGMat | undefined;
        let normalMaps: boolean | undefined;

        rp.setBindGroup(0, this.bindGroup);

        for (const c of this.meshDrawCalls) {
            const mat = c.mat as WGMat;

            // activate/switch pipeline
            if (mat.hasNormal !== normalMaps) {
                rp.setPipeline(
                    mat.hasNormal ? this._gNormPipeline : this._gPipeline,
                );
                normalMaps = mat.hasNormal;
            }

            // attach material
            if (mat !== activeMat) {
                activeMat = mat;
                rp.setBindGroup(1, mat.bindGroup);
            }

            // attach mesh buffers
            rp.setVertexBuffer(0, (c.mesh.position as WGBuf).buffer);
            rp.setVertexBuffer(1, (c.mesh.texCoord as WGBuf).buffer);
            rp.setVertexBuffer(2, (c.mesh.normal as WGBuf).buffer);

            if (normalMaps) {
                rp.setVertexBuffer(3, (c.mesh.tangent as WGBuf).buffer);
            }

            const iType = c.mesh.indexType;
            if (iType !== MeshIndexType.None) {
                rp.setIndexBuffer(
                    (c.mesh.index as WGBuf).buffer,
                    iType === MeshIndexType.U16 ? "uint16" : "uint32",
                );

                rp.drawIndexed(
                    c.mesh.drawCount,
                    c.nInstances,
                    0,
                    0,
                    c.firstInstance,
                );
            } else {
                rp.draw(c.mesh.drawCount, c.nInstances, 0, c.firstInstance);
            }
        }
    }

    renderSkinned(rp: GPURenderPassEncoder) {
        rp.setPipeline(this._gSkinPipeline);
        rp.setBindGroup(0, this.skinBindGroup);

        let i = 0;
        for (const { mat, mesh } of this.skinInstances) {
            rp.setBindGroup(1, (mat as WGMat).bindGroup);

            rp.setVertexBuffer(0, (mesh.position as WGBuf).buffer);
            rp.setVertexBuffer(1, (mesh.texCoord as WGBuf).buffer);
            rp.setVertexBuffer(2, (mesh.normal as WGBuf).buffer);
            rp.setVertexBuffer(3, (mesh.joints as WGBuf).buffer);
            rp.setVertexBuffer(4, (mesh.weights as WGBuf).buffer);

            if (mesh.indexType !== MeshIndexType.None) {
                rp.setIndexBuffer(
                    (mesh.index as WGBuf).buffer,
                    mesh.indexType === MeshIndexType.U16 ? "uint16" : "uint32",
                );
            }

            rp.drawIndexed(mesh.drawCount, 1, 0, 0, i++);
        }
    }
}
