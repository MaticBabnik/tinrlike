import type { IMipViewable, ITViewable } from "../texture";
import type { IPass } from "./pass.interface";
import { StructArrayBuffer, StructBuffer } from "../buffer";
import type { WGpu } from "../gpu";
import { getBloomBlurPipeline, getBloomThresholdPipeline } from "../pipelines";
import { align } from "../utils";

export interface IBloomPassParams {
    threshold: number;
    knee: number;
    maxPasses: number;
}

function getMipSize(baseSize: number, mipLevel: number) {
    return ~~Math.max(1, baseSize >> mipLevel);
}

export class BloomPass implements IPass {
    private maxPasses: number;
    private passes: number = 0;

    private blurUniAlign;

    private sampler: GPUSampler;
    private thresholdPipeline: GPURenderPipeline;
    private blurPipeline: GPURenderPipeline;
    private blurPipelineAdd: GPURenderPipeline;

    private uniformBufferThreshold: StructBuffer;
    private uniformBufferBlur: StructArrayBuffer;

    private bindGroupThreshold: GPUBindGroup | null = null;
    private bindGroupBlur: GPUBindGroup[] = [];
    constructor(
        public gpu: WGpu,

        public params: IBloomPassParams,

        public shaded: ITViewable,

        public output: IMipViewable,
    ) {
        this.maxPasses = params.maxPasses;

        this.sampler = gpu.device.createSampler({
            label: "bloomSampler",
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
        });

        const bus = gpu.getStruct("blur", "Uniforms");
        this.blurUniAlign = align(
            bus.size,
            gpu.device.limits.minUniformBufferOffsetAlignment,
        );

        this.uniformBufferThreshold = new StructBuffer(
            gpu,
            gpu.getStruct("bloom", "Uniforms"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "bloomThresholdUniforms",
        );

        this.uniformBufferBlur = new StructArrayBuffer(
            gpu,
            gpu.getStruct("blur", "Uniforms"),
            this.maxPasses * 2,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "bloomBlurUniforms",
            this.blurUniAlign,
        );

        this.thresholdPipeline = getBloomThresholdPipeline(gpu, output.format);
        this.blurPipeline = getBloomBlurPipeline(gpu, output.format, false);
        this.blurPipelineAdd = getBloomBlurPipeline(gpu, output.format, true);
    }

    public createBindGroups() {
        this.bindGroupThreshold = this.gpu.device.createBindGroup({
            label: "bloomThresholdBindGroup",
            layout: this.gpu.bindGroupLayouts.bloom,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBufferThreshold.gpuBuf },
                },
                {
                    binding: 1,
                    resource: this.shaded.view,
                },
            ],
        });

        this.bindGroupBlur = [];
        this.bindGroupBlur.length = this.maxPasses * 2;

        this.passes = Math.min(this.maxPasses, this.output.mipLevels - 1);

        for (let i = 0; i < this.passes; i++) {
            this.uniformBufferBlur.set(i, {
                pixelSize: [
                    1 / getMipSize(this.output.width, i),
                    1 / getMipSize(this.output.height, i),
                ],
            });

            this.bindGroupBlur[i] = this.gpu.device.createBindGroup({
                label: `bloomBlurBindGroup:ds:${i}`,
                layout: this.gpu.bindGroupLayouts.blur,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.uniformBufferBlur.gpuBuf,
                            size: this.blurUniAlign,
                        },
                    },
                    {
                        binding: 1,
                        resource: this.output.views[i],
                    },
                    {
                        binding: 2,
                        resource: this.sampler,
                    },
                ],
            });
        }

        for (let i = 0; i < this.passes; i++) {
            const idx = i + this.passes;

            this.uniformBufferBlur.set(idx, {
                pixelSize: [
                    1 / getMipSize(this.output.width, i),
                    1 / getMipSize(this.output.height, i),
                ],
            });

            this.bindGroupBlur[idx] = this.gpu.device.createBindGroup({
                label: `bloomBlurBindGroup:us:${i}`,
                layout: this.gpu.bindGroupLayouts.blur,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.uniformBufferBlur.gpuBuf,
                            size: this.blurUniAlign,
                        },
                    },
                    {
                        binding: 1,
                        resource: this.output.views[i + 1],
                    },
                    {
                        binding: 2,
                        resource: this.sampler,
                    },
                ],
            });
        }

        this.uniformBufferBlur.push();
    }

    private threshold() {
        this.uniformBufferThreshold.set({
            threshold: this.params.threshold,
            knee: this.params.knee,
        });
        this.uniformBufferThreshold.push();

        const p = this.gpu.cmdEncoder.beginRenderPass({
            label: "threshold",
            colorAttachments: [
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.output.views[0],
                },
            ],
            timestampWrites: this.gpu.timestamp("bloom"),
        });

        p.setPipeline(this.thresholdPipeline);
        p.setBindGroup(0, this.bindGroupThreshold);
        p.draw(3);
        p.end();
    }

    private downsample(i: number) {
        const p = this.gpu.cmdEncoder.beginRenderPass({
            label: `downsample:${i}`,
            colorAttachments: [
                {
                    loadOp: "clear",
                    storeOp: "store",
                    view: this.output.views[i + 1],
                },
            ],
            timestampWrites: this.gpu.timestamp("bloom"),
        });
        p.setPipeline(this.blurPipeline);
        p.setBindGroup(0, this.bindGroupBlur[i], [i * this.blurUniAlign]);
        p.draw(3);
        p.end();
    }

    private upsample(i: number) {
        const p = this.gpu.cmdEncoder.beginRenderPass({
            label: `upsample:${i}`,
            colorAttachments: [
                {
                    loadOp: "load",
                    storeOp: "store",
                    view: this.output.views[i],
                },
            ],
            timestampWrites: this.gpu.timestamp("bloom"),
        });

        p.setPipeline(i ? this.blurPipelineAdd : this.blurPipeline);
        p.setBindGroup(0, this.bindGroupBlur[i + this.passes], [
            (i + this.passes) * this.blurUniAlign,
        ]);
        p.draw(3);

        p.end();
    }

    public apply(): void {
        if (!this.bindGroupThreshold || this.output.resized) {
            this.createBindGroups();
        }

        // Step one: shaded -> output[0] with thresholding
        this.threshold();

        // Step two: output[i] -> output[i+1] downsample blur
        for (let i = 0; i < this.passes; i++) {
            this.downsample(i);
        }

        // Step three: output[i] -> output[i-1] upsample blur (with blend?)
        for (let i = this.passes - 1; i >= 0; i--) {
            this.upsample(i);
        }
    }
}
