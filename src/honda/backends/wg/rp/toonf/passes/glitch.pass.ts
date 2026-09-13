import type { GlitchCfg } from "@/honda/services";
import { Buffer, StructBuffer } from "../../../buffer";
import type { ToonContext } from "../context";
import { getGlitchPipeline } from "../pipelines/glitch.pipeline";
import type { ITViewable } from "../../../texture";
import type { IPass } from "../../common/passes/pass.interface";

export type GlitchPassCfg = {
    randomBufSize: number;
};

const DEFAULTS: GlitchPassCfg = {
    randomBufSize: 1024,
};

export class GlitchPass implements IPass {
    private effectCfg: GlitchPassCfg;

    private pipeline: GPURenderPipeline;

    private glitchConf: StructBuffer;
    private glitchBuffer: Buffer;
    private glitchView: Float32Array;
    private bindGroup?: GPUBindGroup;

    private sampler: GPUSampler;

    public constructor(
        private ctx: ToonContext,
        private glitchCfg: GlitchCfg,
        private color: ITViewable,
        private output: ITViewable,

        cfg?: Partial<GlitchPassCfg>,
    ) {
        this.effectCfg = { ...DEFAULTS, ...cfg };

        this.pipeline = getGlitchPipeline(ctx, output.format);

        this.glitchBuffer = new Buffer(
            ctx.wg,
            4 * this.effectCfg.randomBufSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            "randomBuffer",
        );
        this.glitchView = new Float32Array(this.glitchBuffer.cpuBuf);

        this.sampler = ctx.device.createSampler({
            label: "glitchSampler",
            magFilter: "nearest",
            minFilter: "nearest",
            addressModeU: "repeat",
            addressModeV: "repeat",
        });

        this.glitchConf = new StructBuffer(
            ctx.wg,
            ctx.struct("GlitchConf"),
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            "glitchConf",
        );

        this.reroll();
    }

    private reroll() {
        for (let i = 0; i < this.effectCfg.randomBufSize; i++) {
            this.glitchView[i] = Math.random();
        }
        this.glitchBuffer.push();

        this.glitchCfg.reroll = false;
    }

    private createBindGroup() {
        this.bindGroup = this.ctx.device.createBindGroup({
            label: "toonfGlitchBG",
            layout: this.ctx.layouts["toonf/glitch"],
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.glitchConf.gpuBuf },
                },
                {
                    binding: 1,
                    resource: { buffer: this.glitchBuffer.gpuBuf },
                },
                {
                    binding: 2,
                    resource: this.sampler,
                },
                {
                    binding: 3,
                    resource: this.color.view,
                },
            ],
        });
    }

    public apply(): void {
        if (!this.bindGroup || this.color.resized) {
            this.createBindGroup();
        }

        if (this.glitchCfg.reroll) {
            this.reroll();
        }

        const w = this.output.width;
        const h = this.output.height;
        const blockSize = this.glitchCfg.blockSize;
        const nbx = Math.ceil(w / blockSize);
        const nby = Math.ceil(h / blockSize);
        const nblocks = nbx * nby;

        this.glitchConf.set({
            tileSize: [blockSize / w, blockSize / h],
            nbx,
            buf: this.effectCfg.randomBufSize,
            probability: this.glitchCfg.probability,
            offset: this.glitchCfg.offset,
        });
        this.glitchConf.push();

        const pass = this.ctx.wg.encoder.beginRenderPass({
            label: "toonfGlitchPass",
            colorAttachments: [
                {
                    view: this.output.view,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
            timestampWrites: this.ctx.wg.timestamp("glitch"),
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bindGroup);
        pass.draw(4, nblocks, 0, 0);
        pass.end();
    }

    public destroy(): void {
        this.glitchConf.destroy();
        this.glitchBuffer.destroy();
    }
}
