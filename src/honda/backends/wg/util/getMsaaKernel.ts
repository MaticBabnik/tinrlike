import type { WGpu } from "../gpu";

const TEX_FMT = "rgba16float";

const GET_KERNEL_SHADER = /*wgsl*/ `
struct Out {
    @location(0) pos: vec4f
}

struct VertOut {
    @builtin(position) position: vec4<f32>,
    @location(0) @interpolate(linear, sample) pos: vec2f
}


@vertex
fn vs(@builtin(vertex_index) index: u32) -> VertOut {
    const pos = array<vec2f, 12>(
        vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0),
        vec2f(0.0, 0.0), vec2f(-1.0, -1.0), vec2f(1.0, -1.0),
        vec2f(0.0, 0.0), vec2f(-1.0, 1.0), vec2f(-1.0, -1.0),
        vec2f(0.0, 0.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
    );

    var out: VertOut;
    let p = pos[index];
    out.position = vec4f(p, 0, 1);
    out.pos = p;
    return out;
}

struct FragIn {
    @builtin(sample_index) sampleIndex: u32,
    @builtin(sample_mask) sampleMask: u32,

    @location(0) @interpolate(linear, sample) pos: vec2f,
}

@fragment
fn fragment_main(input: FragIn) -> Out {
    var out: Out;
    
    out.pos = vec4(input.pos.xy, f32(input.sampleIndex), f32(input.sampleMask));

    return out;
}
`;

const COPY_KERNEL_SHADER = /*wgsl*/ `
@group(0) @binding(0) var msaaTex: texture_multisampled_2d<f32>;
@group(0) @binding(1) var<storage,read_write> outBuf: array<vec4<f32>>;

@compute
@workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let id = gid.x;

    outBuf[id] = textureLoad(msaaTex, vec2<i32>(0, 0), id);
}
`;

type TSampleInfo = {
    x: number;
    y: number;
    mask: number;
    id: number;
};

function createRenderPipeline(g: WGpu, sampleCount: number) {
    const m = g.device.createShaderModule({
        label: "getMsaaKernelShader",
        code: GET_KERNEL_SHADER,
    });

    return g.device.createRenderPipeline({
        label: "getMsaaKernelPipeline",
        layout: "auto",
        multisample: {
            count: sampleCount,
        },

        vertex: { module: m },
        fragment: { module: m, targets: [{ format: TEX_FMT }] },

        primitive: {
            topology: "triangle-list",
            cullMode: "none",
        },
    });
}

function createComputePipeline(g: WGpu) {
    const m = g.device.createShaderModule({
        label: "getMsaaKernelCopyShader",
        code: COPY_KERNEL_SHADER,
    });

    return g.device.createComputePipeline({
        label: "getMsaaKernelCopyPipeline",
        layout: "auto",

        compute: { module: m, entryPoint: "main" },
    });
}

export async function getMsaaKernel(g: WGpu): Promise<TSampleInfo[]> {
    const SAMPLE_COUNT: number = 4;
    const COMP_SIZE = 4; //f32
    const VEC_SIZE = 4; // vec4

    const rp = createRenderPipeline(g, SAMPLE_COUNT);
    const cp = createComputePipeline(g);

    const mssaTex = g.device.createTexture({
        label: "msaaKernelOutput",
        size: [1, 1, 1],
        format: TEX_FMT,

        usage:
            GPUTextureUsage.RENDER_ATTACHMENT |
            GPUTextureUsage.COPY_SRC |
            GPUTextureUsage.TEXTURE_BINDING,

        sampleCount: SAMPLE_COUNT,
    });

    const bufSize = SAMPLE_COUNT * COMP_SIZE * VEC_SIZE;
    const outBuf = g.device.createBuffer({
        size: bufSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        label: "msaaKernelReadback",
    });

    const readBuf = g.device.createBuffer({
        size: bufSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        label: "msaaKernelReadback",
    });

    const encoder = g.device.createCommandEncoder({
        label: "getMsaaKernelEncoder",
    });

    {
        const pass = encoder.beginRenderPass({
            label: "getMsaaKernelPass",
            colorAttachments: [
                {
                    view: mssaTex.createView(),
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });

        pass.setPipeline(rp);
        pass.draw(12);
        pass.end();
    }

    {
        const pass = encoder.beginComputePass({
            label: "getMsaaKernelCopyPass",
        });
        pass.setPipeline(cp);

        pass.setBindGroup(
            0,
            g.device.createBindGroup({
                layout: cp.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: mssaTex.createView() },
                    { binding: 1, resource: { buffer: outBuf } },
                ],
            }),
        );

        pass.dispatchWorkgroups(SAMPLE_COUNT, 1, 1);
        pass.end();
    }

    encoder.copyBufferToBuffer(outBuf, 0, readBuf, 0, bufSize);

    g.device.queue.submit([encoder.finish()]);

    await readBuf.mapAsync(GPUMapMode.READ);
    const view = new Float32Array(readBuf.getMappedRange());

    const result: TSampleInfo[] = [];

    for (let i = 0; i < SAMPLE_COUNT; i++) {
        const si: TSampleInfo = {
            x: view[i * 4],
            y: view[i * 4 + 1],
            id: view[i * 4 + 2],
            mask: view[i * 4 + 3],
        };

        if (si.mask === 0) {
            console.warn(
                `Sample ${i} was not hit by any geometry, MSAA kernel may be incorrect!`,
            );
        }

        result.push(si);
    }

    readBuf.unmap();
    outBuf.destroy();
    readBuf.destroy();
    mssaTex.destroy();

    return result;
}
