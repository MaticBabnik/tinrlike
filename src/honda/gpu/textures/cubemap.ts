import { Game } from "@/honda/state";
import { assert } from "@/honda/util";

/**
 * F16 Enviroment map texture
 */
export class CubemapTexture {
    public tex!: GPUTexture;

    /**
     * Original view (full res only view)
     */
    public cubemapView!: GPUTextureView;

    /**
     * Specular view; at mips levels down to 32x32
     */
    public specularView!: GPUTextureView;

    /**
     * 16 * 16 Irradiance view
     */
    public irradianceView!: GPUTextureView;

    public readonly mips: number;

    /**
     * Params don't get validated; GLHF
     */
    public constructor(
        public readonly size: number,
        public readonly label = "<unnamed cubemap>",
    ) {
        this.mips = Math.log2(size / 32) + 1;

        this.tex = Game.gpu.device.createTexture({
            label,
            format: "rgba16float",
            size: [size, size, 6],
            dimension: "2d",
            mipLevelCount: this.mips + 1,
            usage:
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.STORAGE_BINDING,
        });

        this.cubemapView = this.tex.createView({
            label: `${label}:fullres`,
            dimension: "cube",
            baseMipLevel: 0,
            mipLevelCount: 1,
        });

        this.specularView = this.tex.createView({
            label: `${label}:specular`,
            dimension: "cube",
            baseMipLevel: 0,
            mipLevelCount: this.mips,
        });

        this.irradianceView = this.tex.createView({
            label: `${label}:irradiance`,
            dimension: "cube",
            baseMipLevel: this.mips,
            mipLevelCount: 1,
        });
    }

    public computeIrradiance() {
        const enc = Game.gpu.device.createCommandEncoder({
            label: `computeDiffuse:${this.label}`,
        });

        const cpass = enc.beginComputePass({
            label: `computeDiffuse:${this.label}`,
        });

        const bindGroup = Game.gpu.device.createBindGroup({
            label: `${this.label}:'cd_bg`,
            layout: Game.gpu.bindGroupLayouts.computeIbl,
            entries: [
                {
                    binding: 0,
                    resource: this.cubemapView,
                },
                {
                    binding: 1,
                    resource: this.tex.createView({
                        dimension: "2d-array",
                        baseMipLevel: this.mips,
                        mipLevelCount: 1,
                    }),
                },
                {
                    binding: 2,
                    resource: Game.gpu.getSampler({
                        magFilter: "linear",
                        minFilter: "linear",
                        addressModeU: "clamp-to-edge",
                        addressModeV: "clamp-to-edge",
                    }),
                },
            ],
        });

        cpass.setPipeline(Game.gpu.pipelines.bIblIrradiance);
        cpass.setBindGroup(0, bindGroup);
        cpass.dispatchWorkgroups(2, 2, 6);
        cpass.end();

        Game.gpu.device.queue.submit([enc.finish()]);
    }

    public computeSpecular() {
        const enc = Game.gpu.device.createCommandEncoder({
            label: `computeSpecular:${this.label}`,
        });

        for (let i = 1; i < this.mips; i++) {
            const mipSize = this.size >> i;
            const dipsatchXy = mipSize / 8;

            const cpass = enc.beginComputePass({
                label: `computeSpecular:${this.label}:${i}`,
            });

            const bindGroup = Game.gpu.device.createBindGroup({
                label: `${this.label}:'cd_bg`,
                layout: Game.gpu.bindGroupLayouts.computeIbl,
                entries: [
                    {
                        binding: 0,
                        resource: this.cubemapView,
                    },
                    {
                        binding: 1,
                        resource: this.tex.createView({
                            dimension: "2d-array",
                            baseMipLevel: i,
                            mipLevelCount: 1,
                        }),
                    },
                    {
                        binding: 2,
                        resource: Game.gpu.getSampler({
                            magFilter: "linear",
                            minFilter: "linear",
                            addressModeU: "clamp-to-edge",
                            addressModeV: "clamp-to-edge",
                        }),
                    },
                ],
            });

            cpass.setPipeline(Game.gpu.pipelines.cIblSpecular);
            cpass.setBindGroup(0, bindGroup);
            cpass.dispatchWorkgroups(dipsatchXy, dipsatchXy, 6);
            cpass.end();
        }

        Game.gpu.device.queue.submit([enc.finish()]);
    }

    public static readonly SIDES = [
        "px",
        "nx",
        "py",
        "ny",
        "pz",
        "nz",
    ] as const;

    public static async loadRGBM(
        imageUrls: string[],
        label = "<unnamed cubemap>",
        scale = 1,
    ) {
        assert(imageUrls.length === 6, "Expected 6 sides");
        const images = await Promise.all(
            imageUrls.map(async (x) => {
                const img = new Image();
                img.src = x;
                await img.decode();

                assert(img.width >= 128, "Expected at least 128x128 cubemaps");
                assert(img.width === img.height, "Expected square sides");
                assert(
                    img.width
                        .toString(2)
                        .split("")
                        .filter((y) => y === "1").length === 1, // popcount at home :sob:
                    "Expected power of two size",
                );

                return createImageBitmap(img, {
                    colorSpaceConversion: "none",
                    premultiplyAlpha: "none",
                });
            }),
        );

        const size = images[0].width;

        assert(
            images.find((x) => x.width !== size) === undefined,
            "All textures must be of same size",
        );

        const texture = new CubemapTexture(size, label);

        const tmp = Game.gpu.device.createTexture({
            label: "rgbm-temp",
            format: "rgba8unorm",
            size: [size, size],
            dimension: "2d",
            usage:
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });

        const uniforms = new Float32Array([scale]);
        const uniformsGpu = Game.gpu.device.createBuffer({
            size: uniforms.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });

        Game.gpu.device.queue.writeBuffer(
            uniformsGpu,
            0,
            uniforms,
            0,
            uniforms.length,
        );

        const bindGroup = Game.gpu.device.createBindGroup({
            layout: Game.gpu.bindGroupLayouts.rgbmload,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: uniformsGpu },
                },
                { binding: 1, resource: tmp.createView() },
            ],
        });

        for (let i = 0; i < 6; i++) {
            const enc = Game.gpu.device.createCommandEncoder({
                label: `Cubemap RGBM loader ${i}`,
            });

            Game.gpu.device.queue.copyExternalImageToTexture(
                { source: images[i] },
                { texture: tmp },
                [size, size, 1],
            );

            const rp = enc.beginRenderPass({
                colorAttachments: [
                    {
                        loadOp: "clear",
                        storeOp: "store",
                        view: texture.tex.createView({
                            baseArrayLayer: i,
                            arrayLayerCount: 1,
                            baseMipLevel: 0,
                            mipLevelCount: 1,
                        }),
                    },
                ],
            });

            rp.setPipeline(Game.gpu.pipelines.rgbmload);
            rp.setBindGroup(0, bindGroup);
            rp.draw(3);
            rp.end();

            Game.gpu.device.queue.submit([enc.finish()]);
        }

        uniformsGpu.destroy();
        tmp.destroy();
        texture.computeIrradiance();
        texture.computeSpecular();

        return texture;
    }
}
