const bigTri = array(vec2f(- 1, 3), vec2f(- 1, - 1), vec2f(3, - 1),);

@group(0) @binding(0) var source: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(bigTri[index], 0, 1);
}

@fragment 
fn fs(@builtin(position) p: vec4<f32>) -> @location(0) vec4f {
    return textureLoad(source, vec2u(textureDimensions(source).x - u32(p.x) - 1, u32(p.y)), 0);
}