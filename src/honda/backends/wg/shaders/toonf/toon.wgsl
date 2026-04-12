/*
    HONDA HONDA HONDA HO  A
      N   H   A H   A HON A
      N   H   A H   A H NDA
      N   HONDA HONDA H  DA
    
    Honda WebGPU Backend - Toon Pipeline


    Let me speak to the people, Bojan
    Let me speak (No one's stopping you)
    They need to hear this (30)
    They need to hear this (One take)

    I'm not a big fan of the WebGPU Enhanced Shading Language (30 on 30)
    I'm not a big fan of the WebGPU Enhanced Shading Language (30 on 30 on 30)
    I'm not a big fan of the WebGPU Enhanced Shading Language (30, 30, 30, 30, 30)
    I'm not a big fan of the WebGPU Enhanced Shading Language
    Not a big fan (30, 30, 30, 30 on 30)
    I'm not a big fan of the WebGPU Enhanced Shading Language
    I'm not a big fan of the WebGPU Enhanced Shading Language (30, 30, 30)
    I'm not a big fan of the WebGPU Enhanced Shading Language (30, 30, 30)
    I'm not a big fan of the WebGPU Enhanced Shading Language (30, 30, 30)

    also not a big fan of:
     - safari
     - firefox webgpu impl
     - uniformity analysis
     - linux webgpu support
     - nvidia
     - nvidia
     - nvidia (three times)
     - nvidia nsight in particular
*/

//#region common structs

struct Instance {
    transform: mat4x4<f32>,
    invTransform: mat4x4<f32>,
}

struct Material {
    baseFactor: vec4f,
    emissionFactor: vec3f,
    metalFactor: f32,
    roughFactor: f32,
    normalScale: f32,
    alphaCutoff: f32,
    ignoreAlpha: u32
}

struct Light {
    position: vec3f,
    direction: vec3f,
    color: vec3f,

    ltype: u32,
    intensity: f32,
    maxRange: f32,
    innerCone: f32,
    outerCone: f32,

    shadowMap: i32,
    VP: mat4x4f,
}

struct VInIdxPosUv {
    @builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec3f,
    @location(1) uv: vec2f,
}

struct VInIdxPosUvNorm {
    @builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec3f,
    @location(1) uv: vec2f,
    @location(2) normal: vec3f,
}

struct VOPosUv {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
}

struct VOPosWposUvNorm {
    @builtin(position) pos: vec4f,
    @interpolate(perspective, sample) @location(0) wpos: vec3f,
    @interpolate(perspective, sample) @location(1) uv: vec2f,
    @interpolate(perspective, sample) @location(2) normal: vec3f,
}

struct MainUniforms {
    vp: mat4x4f,
    vInv: mat4x4f,
    nLights: u32,
}

//#endregion common structs

//#region common constants

const BIG_TRI = array(vec2f(- 1, 3), vec2f(- 1, - 1), vec2f(3, - 1),);

const L_POINT = 0u;
const L_DIR = 1u;
const L_SPOT = 2u;

const PI: f32 = 3.14159265358979323846264338327950288;

//#endregion common constants

//#region overrides
override m_camera_is_ortho: bool = true;
//#endregion overrides

//#region common bindgroups

// Depth shaders get viewProjection as a uniform
@group(0) @binding(0)
var<uniform> d_viewProjection: mat4x4<f32>;

// TODO: at some point we will need to properly render stuff, we need proper uniforms
@group(0) @binding(0)
var<uniform> m_uni: MainUniforms;

// All geometry rendering shaders get instances, hence no prefix
@group(0) @binding(1)
var<storage, read> instances: array<Instance>;

// Main shaders get lights
@group(0) @binding(2)
var<uniform> m_lights: array<Light, 128>;

// Materials are always the same
@group(1) @binding(0)
var<uniform> m_material: Material;
@group(1) @binding(1)
var m_tBase: texture_2d<f32>;
@group(1) @binding(2)
var m_sBase: sampler;
@group(1) @binding(3)
var m_tMtlRgh: texture_2d<f32>;
@group(1) @binding(4)
var m_sMtlRgh: sampler;
@group(1) @binding(5)
var m_tEms: texture_2d<f32>;
@group(1) @binding(6)
var m_sEms: sampler;

// Post processing shaders that get MSAA texture as input
@group(0) @binding(0)
var pm_shaded: texture_multisampled_2d<f32>;

// Post processing shaders that get non-MSAA texture as input
@group(0) @binding(0)
var p_shaded: texture_2d<f32>;

//#endregion common bindgroups

//#region depth alpha clip

struct DACVertexOut {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn dac_vertex(input: VInIdxPosUv) -> DACVertexOut {
    let pos = d_viewProjection * instances[input.instanceIndex].transform * vec4f(input.position, 1.0);
    return DACVertexOut(pos, input.uv);
}

@fragment
fn dac_fragment(input: DACVertexOut) {
    let baseColor = m_material.baseFactor.a * textureSample(m_tBase, m_sBase, input.uv).a;

    // clip
    if (baseColor < m_material.alphaCutoff) {
        discard;
    }
}

//#endregion depth alpha clip

//#region depth opaque

@vertex
fn do_vertex(input: VInIdxPosUv) -> @builtin(position) vec4f {
    return d_viewProjection * instances[input.instanceIndex].transform * vec4f(input.position, 1.0);
}

@fragment
fn do_fragment() { }

//#endregion depth opaque

//#region main

@vertex
fn m_vertex(input: VInIdxPosUvNorm) -> VOPosWposUvNorm {
    let mpos = vec4f(input.position, 1.0);
    let transform = m_uni.vp * instances[input.instanceIndex].transform;
    let pos = transform * mpos;
    let wpos = (instances[input.instanceIndex].transform * mpos).xyz;

    let normalMatrix = transpose(mat3x3(instances[input.instanceIndex].invTransform[0].xyz, instances[input.instanceIndex].invTransform[1].xyz, instances[input.instanceIndex].invTransform[2].xyz));
    let normal = normalize(normalMatrix * input.normal);

    return VOPosWposUvNorm(pos, wpos, input.uv, normal);
}

@fragment
fn mo_fragment(input: VOPosWposUvNorm) -> @location(0) vec4f {
    let baseColor = textureSample(m_tBase, m_sBase, input.uv) * m_material.baseFactor;

    return baseColor;
}

@fragment
fn mac_fragment(input: VOPosWposUvNorm) -> @location(0) vec4f {
    let baseColor = textureSample(m_tBase, m_sBase, input.uv) * m_material.baseFactor;

    //TODO: is branching (this approach) faster than switching pipelines (using opaque)?
    if m_material.ignoreAlpha == 0 && baseColor.a < m_material.alphaCutoff {
        discard;
    }

    let metrgh = textureSample(m_tMtlRgh, m_sMtlRgh, input.uv).rg;
    let metallic = metrgh.r * m_material.metalFactor;
    let roughness = metrgh.g * m_material.roughFactor;
    let emission = textureSample(m_tEms, m_sEms, input.uv).rgb * m_material.emissionFactor;

    var v: vec3f;
    let n = input.normal;
    if m_camera_is_ortho {
        v = normalize(m_uni.vInv[2].xyz);
    }
    else {
        v = normalize(m_uni.vInv[3].xyz - input.wpos);
    }

    var lit = vec3f(0.0);

    for (var i = 0u; i < m_uni.nLights; i++) {

        var atten = 1.0;
        var l: vec3f;
        var light = m_lights[i];

        if light.ltype == L_DIR {
            l = normalize(- light.direction);
        }
        else {
            let delta = light.position - input.wpos;
            l = normalize(delta);
            let dist = length(delta);
            atten = 1.0 / max(pow(dist, 2.0), 0.0001);
        }

        if light.ltype == L_SPOT {
            // spotlight cone falloff
            let coneI = cos(light.innerCone);
            let coneO = cos(light.outerCone);

            atten *= clamp((dot(l, normalize(- light.direction)) - coneO) / (coneI - coneO), 0.0, 1.0);
        }

        let h = normalize(l + v);

        // if light.shadowMap >= 0 {
        //     let projected = light.VP * vec4(pos, 1.0);
        //     let ndc = projected.xyz / projected.w;
        //     let texCoords = vec2f(0.5, -0.5) * ndc.xy + 0.5;

        //     let offset = 1.0 / f32(uni.shadowMapSize);
        //     var factor = 0.0;

        //     for (var y = -1 ; y <= 1 ; y++) {
        //         for (var x = -1 ; x <= 1 ; x++) {
        //             factor += textureSampleCompare(
        //                 shadowMaps,
        //                 shadowSampler,
        //                 texCoords + vec2(f32(x) * offset, f32(y) * offset),
        //                 light.shadowMap,
        //                 ndc.z
        //             );
        //         }
        //     }

        //     atten *= factor / 9;
        // }

        let lightContribution = light.color * light.intensity * atten;

        let w = 0.3;
        let diffuseRaw = saturate((dot(n, l) + w) / ((1.0 + w) * (1.0 + w)));
        let stepDiffuse = step(0.1, diffuseRaw);

        let diffuseColor = baseColor.rgb * (1.0 - metallic);

        let specRaw = pow(saturate(dot(n, h)), pow(128.0, 1.0 - max(roughness, 0.05)));
        const steps = 2.0;
        let stepSpecular = round(specRaw * steps) / steps;

        let f0 = mix(0.3 * light.color, baseColor.rgb, metallic);
        let specularColor = f0 * stepSpecular;

        lit += (diffuseColor + specularColor) * stepDiffuse * lightContribution;
    }

    // fresnel + ambient
    const p = 1.0;
    let fresnel = 1 - pow(dot(v, n), p);
    lit += baseColor.rgb * saturate(0.3 + fresnel);

    return vec4f(lit, baseColor.a);
}

@fragment
fn mab_fragment(input: VOPosWposUvNorm) -> @location(0) vec4f {
    let baseColor = textureSample(m_tBase, m_sBase, input.uv) * m_material.baseFactor;

    return baseColor;
}

//#endregion main alpha blend

//#region post

const LINEAR_REC2020_TO_LINEAR_SRGB = mat3x3f(1.6605, - 0.1246, - 0.0182, - 0.5876, 1.1329, - 0.1006, - 0.0728, - 0.0083, 1.1187);

const LINEAR_SRGB_TO_LINEAR_REC2020 = mat3x3f(0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956);

fn agx_default_contrast(x: vec3<f32>) -> vec3<f32> {
    let x2 = x * x;
    let x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

fn agx_look_punchy(c: vec3<f32>) -> vec3<f32> {
    let lw = vec3<f32>(0.2126, 0.7152, 0.0722);
    let luma = dot(c, lw);
    let slope = vec3<f32>(1.0);
    let power = vec3<f32>(1.35);
    let sat = 1.4;
    let col = pow(c * slope, power);
    return luma + sat * (col - luma);
}

fn agx_tonemap_punchy(c: vec3<f32>, exposure: f32) -> vec3<f32> {
    let in_mat = mat3x3f(0.85662717, 0.13731897, 0.11189821, 0.09512124, 0.76124197, 0.07679942, 0.04825161, 0.10143904, 0.81130236);
    let out_mat = mat3x3f(1.1271006, - 0.14132977, - 0.14132977, - 0.11060664, 1.1578237, - 0.11060664, - 0.01649394, - 0.01649394, 1.2519364);

    let min_ev = - 12.47393;
    let max_ev = 4.026069;

    var col = exposure * c;
    col = LINEAR_SRGB_TO_LINEAR_REC2020 * col;
    col = in_mat * col;
    col = log2(max(col, vec3<f32>(1e-10)));
    col = (col - vec3<f32>(min_ev)) / (max_ev - min_ev);
    col = clamp(col, vec3<f32>(0.0), vec3<f32>(1.0));
    col = agx_default_contrast(col);
    col = agx_look_punchy(col);
    col = out_mat * col;
    col = pow(max(col, vec3<f32>(0.0)), vec3<f32>(2.2));
    col = LINEAR_REC2020_TO_LINEAR_SRGB * col;
    return clamp(col, vec3<f32>(0.0), vec3<f32>(1.0));
}

@vertex
fn p_vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(BIG_TRI[index], 0, 1);
}

@fragment
fn pr_fragment(@builtin(position) in: vec4f) -> @location(0) vec4f {
    let s = (textureLoad(pm_shaded, vec2u(in.xy), 0).xyz + textureLoad(pm_shaded, vec2u(in.xy), 1).xyz + textureLoad(pm_shaded, vec2u(in.xy), 2).xyz + textureLoad(pm_shaded, vec2u(in.xy), 3).xyz) * 0.25;

    const exposure = 0.5;
    const gamma = 1.8;

    let col = agx_tonemap_punchy(s.rgb, exposure);

    return vec4f(pow(col, vec3f(1.0 / gamma)), 1.0);
}

@fragment
fn p_fragment(@builtin(position) in: vec4f) -> @location(0) vec4f {
    let s = textureLoad(p_shaded, vec2u(in.xy), 0).xyz;

    const exposure = 0.5;
    const gamma = 1.8;

    let col = agx_tonemap_punchy(s.rgb, exposure);

    return vec4f(pow(col, vec3f(1.0 / gamma)), 1.0);
}

//#endregion post
