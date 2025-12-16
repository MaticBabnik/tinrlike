import { makeStructuredView } from "webgpu-utils";
import type { IPass } from "./pass.interface";
import { Game } from "@/honda/state";
import { CameraSystem } from "@/honda/systems/camera";
import { LightSystem } from "@/honda/systems/light";

export class ShadePass implements IPass {
    protected settings = makeStructuredView(
        Game.gpu.shaderModules.shade.defs.structs.ShadeUniforms,
    );

    protected uniforms: GPUBuffer;
    protected shadeMainGroup!: GPUBindGroup;

    constructor() {
        this.uniforms = Game.gpu.device.createBuffer({
            size: this.settings.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    protected createMainBindGroup() {
        this.shadeMainGroup = Game.gpu.device.createBindGroup({
            label: "shadebg",
            layout: Game.gpu.bindGroupLayouts.shadeMain,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniforms,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: Game.ecs.getSystem(LightSystem).lightsBuf,
                    },
                },
                {
                    binding: 2,
                    resource: Game.gpu.textures.base.view,
                },
                {
                    binding: 3,
                    resource: Game.gpu.textures.normal.view,
                },
                {
                    binding: 4,
                    resource: Game.gpu.textures.mtlRgh.view,
                },
                {
                    binding: 5,
                    resource: Game.gpu.textures.emission.view,
                },
                {
                    binding: 6,
                    resource: Game.gpu.textures.depth.view,
                },
                {
                    binding: 7,
                    resource: Game.gpu.shadowmaps.view,
                },
                {
                    binding: 8,
                    resource: Game.gpu.device.createSampler({
                        label: "shadowSampler",
                        compare: "greater",
                        minFilter: "linear",
                        magFilter: "linear",
                    }),
                },
            ],
        });
    }

    apply() {
        if (!this.shadeMainGroup || Game.gpu.wasResized) {
            this.createMainBindGroup();
        }

        const csys = Game.ecs.getSystem(CameraSystem);
        this.settings.set({
            VInv: csys.viewMtxInv,
            VPInv: csys.viewProjMtxInv,
            camera: csys.viewMtx,
            shadowMapSize: Game.gpu.shadowmaps.size,
            nLights: Game.ecs.getSystem(LightSystem).nLights,
            // iblMaxMips: Game.gpu.sky.mips - 1,
        });

        const pass = Game.cmdEncoder.beginRenderPass({
            label: "shade",
            colorAttachments: [
                {
                    view: Game.gpu.textures.shaded.view,
                    loadOp: "load",
                    storeOp: "store",
                },
            ],
            timestampWrites: Game.gpu.timestamp("shade"),
        });

        pass.setPipeline(Game.gpu.pipelines.shade);
        Game.gpu.device.queue.writeBuffer(
            this.uniforms,
            0,
            this.settings.arrayBuffer,
        );
        pass.setBindGroup(0, this.shadeMainGroup);
        pass.draw(3);
        pass.end();
    }
}

/*


                {
                    binding: 7,
                    resource: Game.gpu.getSampler({
                        addressModeU: "clamp-to-edge",
                        addressModeV: "clamp-to-edge",
                        magFilter: "linear",
                        minFilter: "linear",
                        mipmapFilter: 'linear'
                    }),
                },
                {
                    binding: 10,
                    resource: Game.gpu.env?.specularView ?? Game.gpu.sky.specularView,
                },
                {
                    binding: 11,
                    resource: Game.gpu.env?.irradianceView ??Game.gpu.sky.irradianceView,
                },

                */
