import { MeshIndexType } from "@/honda/gpu2";
import type { WGBuf } from "../../../resources";
import type { ToonDrawCall } from "./gather.pass";

/**
 * Binds the mesh's vertex/index buffers and issues the (instanced) draw.
 * Slots: 0 position, 1 uv, 2 normal (when `normals` is set).
 */
export function drawMesh(rp: GPURenderPassEncoder, draw: ToonDrawCall, normals: boolean) {
    const mesh = draw.mesh;

    rp.setVertexBuffer(0, (mesh.position as WGBuf).buffer);
    rp.setVertexBuffer(1, (mesh.texCoord as WGBuf).buffer);
    if (normals) rp.setVertexBuffer(2, (mesh.normal as WGBuf).buffer);

    if (mesh.indexType !== MeshIndexType.None) {
        rp.setIndexBuffer((mesh.index as WGBuf).buffer, mesh.indexType === MeshIndexType.U16 ? "uint16" : "uint32");
        rp.drawIndexed(mesh.drawCount, draw.nInstances, 0, 0, draw.firstInstance);
    } else {
        rp.draw(mesh.drawCount, draw.nInstances, 0, draw.firstInstance);
    }
}

/**
 * Skips redundant pipeline/material rebinds while walking a sorted draw list.
 */
export class DrawBinder {
    private _pipeline: GPURenderPipeline | undefined;
    private _group: GPUBindGroup | undefined;

    public constructor(private rp: GPURenderPassEncoder) {}

    public bind(pipeline: GPURenderPipeline, material: GPUBindGroup) {
        if (pipeline !== this._pipeline) {
            this._pipeline = pipeline;
            this.rp.setPipeline(pipeline);
        }

        if (material !== this._group) {
            this._group = material;
            this.rp.setBindGroup(1, material);
        }
    }
}
