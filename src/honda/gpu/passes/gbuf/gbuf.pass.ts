import { Game } from "@/honda/state";
import type { IPass } from "../pass.interface";
import { type Material, NORMALMAP_BIT } from "@/honda";
import type { Mesh } from "../../meshes/mesh";
import { BIND_MAT, BIND_PASS } from "./gbuf.const";
import { makeStructuredView, type StructuredView } from "webgpu-utils";
import { MeshSystem } from "@/honda/systems/mesh";
import { CameraSystem } from "@/honda/systems/camera";
import type { StructArrayBuffer } from "../../buffer";

export class GBufferPass implements IPass {
    protected uniformsBuf: GPUBuffer;
    protected uniforms: StructuredView;
    protected bindGroup: GPUBindGroup;
    protected skinBindGroup: GPUBindGroup;

    constructor(private skinMeshBuffer: StructArrayBuffer) {
        this.uniforms = makeStructuredView(
            Game.gpu.shaderModules.g.defs.uniforms.uniforms,
        );

        this.uniformsBuf = Game.gpu.device.createBuffer({
            size: this.uniforms.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: "gbufUniforms",
        });

        this.bindGroup = Game.gpu.device.createBindGroup({
            label: "gbufBG",
            layout: Game.gpu.bindGroupLayouts.g,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformsBuf,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: Game.ecs.getSystem(MeshSystem).instanceBuffer,
                    },
                },
            ],
        });

        this.skinBindGroup = Game.gpu.device.createBindGroup({
            label: "gSkinBG",
            layout: Game.gpu.bindGroupLayouts.gskin,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformsBuf,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.skinMeshBuffer.gpuBuf,
                    },
                },
            ],
        });
    }

    apply(): void {
        const { calls } = Game.ecs.getSystem(MeshSystem);
        const { viewProjMtx: viewProjectionMatrix } =
            Game.ecs.getSystem(CameraSystem);

        this.uniforms.set({
            viewProjection: viewProjectionMatrix,
            deltaTime: Game.deltaTime,
            time: Game.time,
        });

        Game.gpu.device.queue.writeBuffer(
            this.uniformsBuf,
            0,
            this.uniforms.arrayBuffer,
        );

        const rp = Game.cmdEncoder.beginRenderPass({
            label: "gpass",
            colorAttachments: [
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: Game.gpu.textures.base.view,
                },
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: Game.gpu.textures.normal.view,
                },
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: Game.gpu.textures.mtlRgh.view,
                },
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: Game.gpu.textures.emission.view,
                },
            ],
            depthStencilAttachment: {
                view: Game.gpu.textures.depth.view,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 0,
            },
        });

        let activeMesh: Mesh | undefined;
        let activeMat: Material | undefined;
        let normalMaps = false;

        rp.setBindGroup(BIND_PASS, this.bindGroup);
        for (const c of calls) {
            // activate/switch pipeline
            if (c.mat.type !== activeMat?.type) {
                rp.setPipeline(
                    c.mat.type & NORMALMAP_BIT
                        ? Game.gpu.pipelines.gNorm
                        : Game.gpu.pipelines.g,
                );
                normalMaps = !!(c.mat.type & NORMALMAP_BIT);
            }

            // attach material
            if (c.mat !== activeMat) {
                activeMat = c.mat;
                rp.setBindGroup(BIND_MAT, c.mat.bindGroup);
            }

            // attach mesh buffers
            if (c.mesh !== activeMesh) {
                if (normalMaps) {
                    if (!c.mesh.tangent) {
                        console.warn("Missing tangents for", c.mesh);
                        continue;
                    }
                    rp.setVertexBuffer(3, c.mesh.tangent);
                }
                rp.setVertexBuffer(0, c.mesh.position);
                rp.setVertexBuffer(1, c.mesh.texCoord);
                rp.setVertexBuffer(2, c.mesh.normal);
                rp.setIndexBuffer(c.mesh.index, "uint16");
                activeMesh = c.mesh;
            }

            // fries you know where
            rp.drawIndexed(
                activeMesh.drawCount,
                c.nInstances,
                0,
                0,
                c.firstInstance,
            );
        }

        this.renderSkinned(rp);
        rp.end();
    }

    renderSkinned(rp: GPURenderPassEncoder) {
        const sms = Game.ecs.getSystem(MeshSystem);

        rp.setPipeline(Game.gpu.pipelines.gSkin);
        rp.setBindGroup(0, this.skinBindGroup);

        let i = 0;
        for (const [comp] of sms.$skinnedMeshes) {
            rp.setBindGroup(1, comp.material.bindGroup);

            rp.setVertexBuffer(0, comp.primitive.position);
            rp.setVertexBuffer(1, comp.primitive.texCoord);
            rp.setVertexBuffer(2, comp.primitive.normal);
            rp.setVertexBuffer(3, comp.primitive.joints);
            rp.setVertexBuffer(4, comp.primitive.weights);

            rp.setIndexBuffer(comp.primitive.index, "uint16");

            rp.drawIndexed(comp.primitive.drawCount, 1, 0, 0, i++);
        }
    }
}
