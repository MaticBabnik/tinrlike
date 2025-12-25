// dual kawase blur?-ish?
// down/upsample op

struct Uniforms {
    pixelSize: vec2<f32>
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var input: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;

struct VertexOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

const bigTri = array(vec2f(- 1, 3), vec2f(- 1, - 1), vec2f(3, - 1),);

@vertex
fn vs(@builtin(vertex_index) index: u32) -> VertexOut {
    var out: VertexOut;
    out.position = vec4f(bigTri[index], 0, 1);
    out.uv = (bigTri[index] * vec2f(0.5, -0.5)) + vec2f(0.5, 0.5);
    return out;
}

fn sampleBox(uv: vec2<f32>) -> vec3<f32> {
    let a = uv.xyxy + uniforms.pixelSize.xyxy * vec2(1.0, -1.0).xxyy;

    return (
        textureSample(input, smp, a.xy).rgb +
        textureSample(input, smp, a.zy).rgb +
        textureSample(input, smp, a.xw).rgb +
        textureSample(input, smp, a.zw).rgb
    ) * 0.25;
}

@fragment
fn fs(v: VertexOut) -> @location(0) vec4f {
    let c = sampleBox(v.uv);
    return vec4f(c, 1.0);
}
