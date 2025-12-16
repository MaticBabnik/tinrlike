struct Uniforms {
    viewProjection: mat4x4<f32>,
};

struct VertexIn {
    @builtin(vertex_index) vertex: u32
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) color: vec3f,
};

struct FragmentOutput {
    @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage> positions: array<vec3f>;
@group(0) @binding(2) var<storage> colors: array<vec3f>;

@vertex
fn vertex_main(input: VertexIn) -> VertexOutput {
    let inputPos = positions[input.vertex];
    let inputColor = colors[input.vertex >> 1];

    let transformedPos = uniforms.viewProjection * vec4f(inputPos, 1.0);

    var output: VertexOutput;
    output.pos = transformedPos;
    output.color = inputColor;
    return output;
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    return vec4f(input.color, 1.0);
}