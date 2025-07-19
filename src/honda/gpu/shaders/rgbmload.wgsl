const bigTri = array(vec2f(- 1, 3), vec2f(- 1, - 1), vec2f(3, - 1),);

struct LoadCfg {
    scale: f32,
};

@group(0) @binding(0) var<uniform> uni: LoadCfg;
@group(0) @binding(1) var source: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(bigTri[index], 0, 1);
}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    let src = textureLoad(source, vec2u(fragCoord.xy), 0);
    return vec4f(src.rgb * src.a * uni.scale, 1.0);
}