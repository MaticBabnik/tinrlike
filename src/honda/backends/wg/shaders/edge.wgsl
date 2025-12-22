struct Uniforms {
    near: f32,
    far: f32,
    isOrtho: u32,
    pixelSize: vec2<f32>,

    normalBoost: f32,
    depthBoost: f32,
}

const bigTri = array(vec2f(- 1, 3), vec2f(- 1, - 1), vec2f(3, - 1),);

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
@group(0) @binding(1)
var gNormal: texture_2d<f32>;
@group(0) @binding(2)
var gDepth: texture_2d<f32>;
@group(0) @binding(3)
var samp: sampler;

struct VertexOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

fn linDepth(depth: f32) -> f32 {
    if (uniforms.isOrtho == 1u) {
        return uniforms.near + depth * (uniforms.far - uniforms.near);
    } else {
        return (uniforms.near * uniforms.far) / (uniforms.far - depth * (uniforms.far - uniforms.near));
    }
}

@vertex
fn vs(@builtin(vertex_index) index: u32) -> VertexOut {
    var out: VertexOut;
    out.position = vec4f(bigTri[index], 0, 1);
    out.uv = (bigTri[index] * vec2f(0.5, -0.5)) + vec2f(0.5, 0.5);
    return out;
}

@fragment
fn fs(v: VertexOut) -> @location(0) vec4f {
    let p = vec2<u32>(v.position.xy);

    let px = vec2f(uniforms.pixelSize.x, 0);
    let py = vec2f(0, uniforms.pixelSize.y);

    // fetch normals
    let nt = normalize((textureSample(gNormal, samp, v.uv + py) - 0.5) * 2.0);
    let nb = normalize((textureSample(gNormal, samp, v.uv - py) - 0.5) * 2.0);
    let nl = normalize((textureSample(gNormal, samp, v.uv - px) - 0.5) * 2.0);
    let nr = normalize((textureSample(gNormal, samp, v.uv + px) - 0.5) * 2.0);
    // compute normal edge factor
    let nex = 1 - abs(dot(nl, nr));
    let ney = 1 - abs(dot(nt, nb));
    let ne = min(pow(nex * nex + ney * ney, 0.5) * uniforms.normalBoost, 1.0);

    // fetch depth
    let dt = linDepth(textureSample(gDepth, samp, v.uv + py).x);
    let db = linDepth(textureSample(gDepth, samp, v.uv - py).x);
    let dl = linDepth(textureSample(gDepth, samp, v.uv - px).x);
    let dr = linDepth(textureSample(gDepth, samp, v.uv + px).x);

    let dex = min(abs(dl - dr), 1.0);
    let dey = min(abs(dt - db), 1.0);
    let de = min((dex + dey) * uniforms.depthBoost, 1.0);

    let edge = max(ne, de);

    return vec4f(edge);
}
