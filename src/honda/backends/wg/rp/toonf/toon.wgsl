/*
    Toon Forward RP
*/

//#region common structs

struct Instance {
    transform: mat4x4<f32>,
    invTransform: mat4x4<f32>,
}

struct SkinInstance {
    transform: mat4x4<f32>,
    invTransform: mat4x4<f32>,
    joints: array<mat4x4f, 128>,
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

struct FresnelMaterial {
    color: vec3f,
    power: f32,
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

struct BloomCfg {
    threshold: f32,
    knee: f32,
}

struct BlurUniforms {
    pixelSize: vec2<f32>
}

struct PostCfg {
    colorAdd: vec3f,
    colorMul: vec3f,
    gamma: f32,
    exposure: f32,
    bloomPower: f32,
    saturation: f32,
    vignette: f32,
    grain: f32,
    chromaticAberration: f32,
    time: f32,
    framen: u32
}

struct GlitchConf {
    tileSize: vec2f,
    nbx: u32,
    buf: u32,
    offset: u32,
    probability: f32
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

struct VInIdxPosUvNormJoints {
    @builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec3f,
    @location(1) uv: vec2f,
    @location(2) normal: vec3f,
    @location(3) jointIds: vec4<u32>,
    @location(4) jointWeights: vec4f,
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
    nShadowMaps: u32,
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

@group(0) @binding(1)
var<storage, read> sk_instances: array<SkinInstance>;

// Main shaders get lights
@group(0) @binding(2)
var<uniform> m_lights: array<Light, 128>;

@group(0) @binding(3)
var m_shadowMaps: texture_depth_2d_array;
@group(0) @binding(4)
var m_shadowSampler: sampler_comparison;

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

// Fresnel materials only have their uniforms
@group(1) @binding(0)
var<uniform> mf_material: FresnelMaterial;

@group(0) @binding(0)
var<uniform> bm_cfg: BloomCfg;
@group(0) @binding(1)
var bm_shaded: texture_2d<f32>;

@group(0) @binding(0)
var<uniform> br_uniforms: BlurUniforms;
@group(0) @binding(1)
var br_input: texture_2d<f32>;
@group(0) @binding(2)
var br_smp: sampler;

@group(0) @binding(0)
var<uniform> p_cfg: PostCfg;
@group(0) @binding(1)
var p_shaded: texture_2d<f32>;
@group(0) @binding(2)
var p_bloom: texture_2d<f32>;
@group(0) @binding(3)
var p_sampler: sampler;

@group(0) @binding(0)
var<uniform> pg_cfg: GlitchConf;
@group(0) @binding(1)
var<storage, read> pg_buf: array<f32>; 
@group(0) @binding(2)
var pg_sampler: sampler;
@group(0) @binding(3)
var pg_input: texture_2d<f32>;

//#endregion common bindgroups

//#region skin helpers

fn skin_mat(inst: SkinInstance, jids: vec4u, jw: vec4f) -> mat4x4f {
    return inst.joints[jids.x] * jw.x + inst.joints[jids.y] * jw.y + inst.joints[jids.z] * jw.z + inst.joints[jids.w] * jw.w;
}

//#endregion skin helpers

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

@vertex
fn dac_sk_vertex(input: VInIdxPosUvNormJoints) -> DACVertexOut {
    let instance = sk_instances[input.instanceIndex];

    // Compute skin matrix
    let sm = skin_mat(instance, input.jointIds, input.jointWeights);
    let pos = d_viewProjection * instance.transform * sm * vec4f(input.position, 1.0);
    return DACVertexOut(pos, input.uv);
}

//#endregion depth alpha clip

//#region depth opaque

@vertex
fn do_vertex(input: VInIdxPosUv) -> @builtin(position) vec4f {
    return d_viewProjection * instances[input.instanceIndex].transform * vec4f(input.position, 1.0);
}

@fragment
fn do_fragment() { }

@vertex
fn do_sk_vertex(input: VInIdxPosUvNormJoints) -> @builtin(position) vec4f {
    let instance = sk_instances[input.instanceIndex];
    let sm = skin_mat(instance, input.jointIds, input.jointWeights);
    return d_viewProjection * instance.transform * sm * vec4f(input.position, 1.0);
}

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

@vertex
fn m_sk_vertex(input: VInIdxPosUvNormJoints) -> VOPosWposUvNorm {
    let instance = sk_instances[input.instanceIndex];
    let sm = skin_mat(instance, input.jointIds, input.jointWeights);
    let pos = m_uni.vp * instance.transform * sm * vec4f(input.position, 1.0);
    let wpos = (instance.transform * sm * vec4f(input.position, 1.0)).xyz;

    let normalMatrix = transpose(mat3x3(instance.invTransform[0].xyz, instance.invTransform[1].xyz, instance.invTransform[2].xyz));
    let normal = normalize(normalMatrix * input.normal);

    return VOPosWposUvNorm(pos, wpos, input.uv, normal);
}

// points from the surface towards the camera
fn getViewVector(w: vec3f) -> vec3f {
    if m_camera_is_ortho {
        return m_uni.vInv[2].xyz;
    }
    else {
        return m_uni.vInv[3].xyz - w;
    }
}

fn evalToon(n: vec3f, v: vec3f, wpos: vec3f, baseColor: vec3f, roughness: f32, metallic: f32, emission: vec3f) -> vec3f {
    var lit = vec3f(0.0);

    for (var i = 0u; i < m_uni.nLights; i++) {

        var atten = 1.0;
        var l: vec3f;
        var light = m_lights[i];

        if light.ltype == L_DIR {
            l = normalize(- light.direction);
        }
        else {
            let delta = light.position - wpos;
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

        if light.shadowMap >= 0 {
            let projected = light.VP * vec4(wpos, 1.0);
            let ndc = projected.xyz / projected.w;
            let texCoords = vec2f(0.5, - 0.5) * ndc.xy + 0.5;

            atten *= textureSampleCompare(m_shadowMaps, m_shadowSampler, texCoords, light.shadowMap, ndc.z);
        }

        let h = normalize(l + v);

        const w = 0.3;
        const specThreshold = 0.5;
        const diffSteps = 3.0;

        // push back the diffuse shadows with `w`
        let wrappedNdotL = saturate((dot(n, l) + w) / (1.0 + w));
        let diffuse = wrappedNdotL;

        // do some goofines to get "shininess"
        let shininess = pow(128.0, 1.0 - max(roughness, 0.05));
        let specular = pow(saturate(dot(n, h)), shininess);

        // quantize to make it cinema
        let toonDiffuse = floor(diffuse * diffSteps) / diffSteps;
        let toonSpecular = step(specThreshold, specular);

        // final round of light stuff
        let f0 = mix(vec3(0.04), baseColor, metallic);
        let diffuseColor = baseColor * (1.0 - metallic);
        let lightColor = light.color * light.intensity;

        lit += (diffuseColor * toonDiffuse + f0 * toonSpecular) * lightColor * atten;
    }

    // fresnel, ambient, emission
    const p = 0.3;
    const ambient = 0.3;
    let fresnel = saturate(1 - pow(dot(v, n), p));
    lit += baseColor * (ambient + fresnel) + emission;

    return lit;
}

@fragment
fn mo_fragment(input: VOPosWposUvNorm) -> @location(0) vec4f {
    let baseColor = textureSample(m_tBase, m_sBase, input.uv) * m_material.baseFactor;
    let metrgh = textureSample(m_tMtlRgh, m_sMtlRgh, input.uv);
    let metallic = metrgh.b * m_material.metalFactor;
    let roughness = metrgh.g * m_material.roughFactor;
    let emission = textureSample(m_tEms, m_sEms, input.uv).rgb * m_material.emissionFactor;

    let v = getViewVector(input.wpos);
    let n = input.normal;

    return vec4f(evalToon(n, v, input.wpos, baseColor.rgb, roughness, metallic, emission), baseColor.a);
}

@fragment
fn mac_fragment(input: VOPosWposUvNorm) -> @location(0) vec4f {
    let baseColor = textureSample(m_tBase, m_sBase, input.uv) * m_material.baseFactor;

    //TODO: is branching (this approach) faster than switching pipelines (using opaque)?
    if m_material.ignoreAlpha == 0 && baseColor.a < m_material.alphaCutoff {
        discard;
    }

    let metrgh = textureSample(m_tMtlRgh, m_sMtlRgh, input.uv);
    let metallic = metrgh.b * m_material.metalFactor;
    let roughness = metrgh.g * m_material.roughFactor;
    let emission = textureSample(m_tEms, m_sEms, input.uv).rgb * m_material.emissionFactor;

    let v = getViewVector(input.wpos);
    let n = input.normal;

    return vec4f(evalToon(n, v, input.wpos, baseColor.rgb, roughness, metallic, emission), baseColor.a);
}

@fragment
fn mab_fragment(input: VOPosWposUvNorm) -> @location(0) vec4f {
    let baseColor = textureSample(m_tBase, m_sBase, input.uv) * m_material.baseFactor;
    let metrgh = textureSample(m_tMtlRgh, m_sMtlRgh, input.uv);
    let metallic = metrgh.b * m_material.metalFactor;
    let roughness = metrgh.g * m_material.roughFactor;
    let emission = textureSample(m_tEms, m_sEms, input.uv).rgb * m_material.emissionFactor;

    let v = getViewVector(input.wpos);
    let n = input.normal;

    return vec4f(evalToon(n, v, input.wpos, baseColor.rgb, roughness, metallic, emission), baseColor.a);
}

//#endregion main

//#region main fresnel

@fragment
fn mf_fragment(input: VOPosWposUvNorm) -> @location(0) vec4f {
    let v = normalize(getViewVector(input.wpos));
    let n = normalize(input.normal);

    let fresnel = pow(1.0 - saturate(dot(v, n)), mf_material.power);

    return vec4f(mf_material.color * fresnel, 0.0);
}

//#endregion main fresnel

//#region bloom

@vertex
fn bm_vertex(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4<f32> {
    return vec4<f32>(BIG_TRI[idx], 0.0, 1.0);
}

@fragment
fn bm_fragment(@builtin(position) pos: vec4<f32>) -> @location(0) vec4f {
    let c = textureLoad(p_shaded, vec2u(pos.xy), 0);
    let b = max(c.r, max(c.g, c.b));

    let contrib = max(0, b - bm_cfg.threshold) / max(bm_cfg.knee, 0.00001);

    return c * contrib;
}

//#endregion bloom

//#region blur

fn sampleBox(uv: vec2<f32>) -> vec3<f32> {
    let a = uv.xyxy + br_uniforms.pixelSize.xyxy * vec2(1.0, - 1.0).xxyy;

    return (textureSample(br_input, br_smp, a.xy).rgb + textureSample(br_input, br_smp, a.zy).rgb + textureSample(br_input, br_smp, a.xw).rgb + textureSample(br_input, br_smp, a.zw).rgb) * 0.25;
}

@vertex
fn br_vertex(@builtin(vertex_index) index: u32) -> VOPosUv {
    let pos = BIG_TRI[index];

    return VOPosUv(vec4f(pos, 0, 1), vec2f(pos.x * 0.5 + 0.5, pos.y * - 0.5 + 0.5));
}

@fragment
fn br_fragment(v: VOPosUv) -> @location(0) vec4f {
    let c = sampleBox(v.uv);
    return vec4f(c, 1.0);
}

//#endregion blur

//#region post

const LINEAR_REC2020_TO_LINEAR_SRGB = mat3x3f(1.6605, - 0.1246, - 0.0182, - 0.5876, 1.1329, - 0.1006, - 0.0728, - 0.0083, 1.1187);

const LINEAR_SRGB_TO_LINEAR_REC2020 = mat3x3f(0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956);

fn agx_default_contrast(x: vec3<f32>) -> vec3<f32> {
    let x2 = x * x;
    let x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

fn agx_look_punchy(c: vec3<f32>) -> vec3<f32> {
    const lw = vec3<f32>(0.2126, 0.7152, 0.0722);
    let luma = dot(c, lw);
    const slope = vec3<f32>(1.0);
    const power = vec3<f32>(1.35);
    const sat = 1.4;
    let col = pow(c * slope, power);
    return luma + sat * (col - luma);
}

fn agx_tonemap_punchy(c: vec3<f32>) -> vec3<f32> {
    const in_mat = mat3x3f(0.85662717, 0.13731897, 0.11189821, 0.09512124, 0.76124197, 0.07679942, 0.04825161, 0.10143904, 0.81130236);
    const out_mat = mat3x3f(1.1271006, - 0.14132977, - 0.14132977, - 0.11060664, 1.1578237, - 0.11060664, - 0.01649394, - 0.01649394, 1.2519364);

    const min_ev = - 12.47393;
    const max_ev = 4.026069;

    var col = c;
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

fn saturation(c: vec3f, s: f32) -> vec3f {
    let luma = dot(c, vec3f(0.2126, 0.7152, 0.0722));
    return mix(vec3f(luma), c, s);
}

fn noise(uv: vec2f, t: f32) -> f32 {
    let seed = dot(uv, vec2f(12.9898, 78.233)) + t;
    return fract(sin(seed) * 43758.5453);
}

fn inoise(uv: vec2u, framen: u32) -> f32 {
    var v = uv.x * 1664525u + uv.y * 1013904223u + framen * 2654435761u;
    v ^= v >> 16u;
    v *= 0x45d9f3bu;
    v ^= v >> 16u;
    return f32(v) / 4294967295.0;
}

@vertex
fn p_vertex(@builtin(vertex_index) index: u32) -> VOPosUv {
    let pos = BIG_TRI[index];

    return VOPosUv(vec4f(pos, 0, 1), vec2f(pos.x * 0.5 + 0.5, pos.y * - 0.5 + 0.5));
}

@fragment
fn p_fragment(in: VOPosUv) -> @location(0) vec4f {
    let l = vec2u(in.pos.xy);

    let dist = distance(in.uv, vec2f(0.5));

    var c: vec3f;

    if p_cfg.chromaticAberration == 0 {
        c = textureLoad(p_shaded, l, 0).rgb;
    }
    else {
        let caOffset = p_cfg.chromaticAberration * dist * 0.01;
        c = vec3f(textureSample(p_shaded, p_sampler, in.uv + vec2f(caOffset, 0.0)).r, textureSample(p_shaded, p_sampler, in.uv).g, textureSample(p_shaded, p_sampler, in.uv + vec2f(caOffset, 0.0)).b);
    }
    c += textureLoad(p_bloom, l, 0).rgb * p_cfg.bloomPower;

    // color multiply
    c *= p_cfg.colorMul;
    // exposure and tonemapping
    c = agx_tonemap_punchy(c * p_cfg.exposure);
    // saturation
    c = saturation(c, p_cfg.saturation);
    // gamma correction
    c = pow(c, vec3f(1.0 / p_cfg.gamma));
    // color add
    c += p_cfg.colorAdd;
    // vignette
    let vign = smoothstep(0.8, 0.2, dist * p_cfg.vignette);
    c *= vign;
    // grain
    if p_cfg.grain > 0 {
        // c += (noise(in.uv, p_cfg.time) - 0.5) * p_cfg.grain;
        c += (inoise(l, p_cfg.framen) - 0.5) * p_cfg.grain;
    }

    return vec4f(c, 1.0);
}

//#endregion post

//#region glitch

const PG_TRIQUAD = array(vec2f(0,0), vec2f(1,0), vec2f(0,1), vec2f(1,1));
const PG_DIR = array(vec2f(-1,0), vec2f(0,-1), vec2f(1,0), vec2f(0,1));

@vertex
fn pg_vertex(@builtin(instance_index) bidx: u32, @builtin(vertex_index) vidx: u32) -> VOPosUv {
    let gy = bidx / pg_cfg.nbx;
    let gx = bidx - gy * pg_cfg.nbx;

    let uvTopleft = vec2f(f32(gx) * pg_cfg.tileSize.x, f32(gy) * pg_cfg.tileSize.y);
    let uvBase = uvTopleft + PG_TRIQUAD[vidx] * pg_cfg.tileSize;
    let pos = vec2f(uvBase.x * 2.0 - 1.0, uvBase.y * - 2.0 + 1.0);

    var uv = uvBase;

    let rand = pg_buf[(bidx + pg_cfg.offset) % pg_cfg.buf];

    if (rand < pg_cfg.probability) {
        let dir = PG_DIR[bidx + u32(rand * 11) % 4];
        uv += dir * pg_cfg.tileSize;
    }

    return VOPosUv(vec4f(pos, 0, 1), uv);
}

@fragment
fn pg_fragment(int: VOPosUv) -> @location(0) vec4f {
    return textureSample(pg_input, pg_sampler, int.uv);
}

//#endregion glitch