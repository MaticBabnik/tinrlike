struct Uniforms {
    scale: vec2f
};

struct Instance {
    pos: vec2f,
    scale: f32,
    rotation: f32,
    uvmin: vec2f,
    uvmax: vec2f,
    colormul: vec4f
};

struct VertexIn {
    @builtin(instance_index) instance: u32,
    @builtin(vertex_index) vertex: u32
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
    @location(1) tint: vec4f
}

// Pass group
@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
@group(0) @binding(1)
var<storage, read> instances: array<Instance>;
@group(0) @binding(2)
var tBase: texture_2d<f32>;
@group(0) @binding(3)
var sBase: sampler;

const BILLBOARD = array<vec2f, 4>(vec2f(- 1.0, - 1.0), vec2f(- 1.0, 1.0), vec2f(1.0, - 1.0), vec2f(1.0, 1.0));

@vertex
fn vertex_main(input: VertexIn) -> VertexOutput {
    let instance = instances[input.instance];
    let offset = BILLBOARD[input.vertex];

    // compute transforms
    let rotatedOffset = vec2(
        offset.x * cos(instance.rotation) - offset.y * sin(instance.rotation),
        offset.x * sin(instance.rotation) + offset.y * cos(instance.rotation)
    );
    let realPos = instance.pos + instance.scale * rotatedOffset;
    let screenPos = realPos / uniforms.scale;

    // this might be better than branching?
    let uvx = mix(instance.uvmin.x, instance.uvmax.x, (offset.x + 1.0) * 0.5);
    let uvy = mix(instance.uvmax.y, instance.uvmin.y, (offset.y + 1.0) * 0.5);
    let uv = vec2(uvx, uvy);

    var output: VertexOutput;
    output.pos = vec4f(screenPos, 0.0, 1.0);
    output.uv = uv;
    output.tint = instance.colormul;
    return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let texColor = textureSample(tBase, sBase, input.uv);
    return texColor * input.tint;
}