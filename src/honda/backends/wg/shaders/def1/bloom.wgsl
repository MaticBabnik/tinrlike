// Bloom code, lifted from Catlike coding
// https://catlikecoding.com/unity/tutorials/advanced-rendering/bloom/#2.7

struct Uniforms {
    threshold: f32,
    knee: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var input: texture_2d<f32>;

const BIGTRI = array(vec2f(- 1, 3), vec2f(- 1, - 1), vec2f(3, - 1),);

@vertex
fn vs(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
    return vec4<f32>(BIGTRI[idx], 0.0, 1.0);
}

fn brightness(c: vec3<f32>) -> f32 {
    return max(c.r, max(c.g, c.b));
}

@fragment
fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4f {
    let c = textureLoad(input, vec2u(pos.xy), 0);
    let b = brightness(c.rgb);

    let contrib = max(0, b - uniforms.threshold) / max(uniforms.knee, 0.00001);

    return c * contrib;
}
