
struct PostCfg {
    inverseProjection: mat4x4f,
    camera: mat4x4f,

    fogColor: vec3f,
    fogStart: f32,
    fogEnd: f32,
    fogDensity: f32,

    mode: u32,

    occlusionPower: f32,
    exposure: f32,
    gamma: f32,

    bloom: f32
};

const bigTri = array(
    vec2f(-1, 3),
    vec2f(-1, -1),
    vec2f(3, -1),
);

@group(0) @binding(0) var<uniform> post: PostCfg;
@group(0) @binding(1) var shaded: texture_2d<f32>;
@group(0) @binding(2) var depth: texture_depth_2d;
@group(0) @binding(3) var ssao: texture_2d<f32>;
@group(0) @binding(4) var bloom: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    return vec4f(bigTri[index], 0, 1);
}

fn getWorldDepth(depthValue: f32, p: vec2u) -> f32 {
    let dim = vec2f(textureDimensions(depth).xy);

    let ndc = vec4f(
        (f32(p.x) / dim.x) * 2.0 - 1.0,
        1.0 - (f32(p.y) / dim.y) * 2.0,
        depthValue,
        1.0
    );

    let viewSpacePos = post.inverseProjection * ndc;
    let viewPos = viewSpacePos.xyz / viewSpacePos.w;

    return length(viewPos.xyz) / 10.0;
}


fn reinhardToneMap(color: vec3f, exposure: f32) -> vec3f {
    return color * exposure / (color * exposure + vec3f(1.0));
}

const LINEAR_REC2020_TO_LINEAR_SRGB = mat3x3f(
    1.6605, -0.1246, -0.0182,
    -0.5876, 1.1329, -0.1006,
    -0.0728, -0.0083, 1.1187 
);

const LINEAR_SRGB_TO_LINEAR_REC2020 = mat3x3f(
    0.6274, 0.0691, 0.0164,
    0.3293, 0.9195, 0.0880,
    0.0433, 0.0113, 0.8956
);

fn agx_default_contrast(x: vec3<f32>) -> vec3<f32> {
    let x2 = x * x;
    let x4 = x2 * x2;
    return 15.5 * x4 * x2
        - 40.14 * x4 * x
        + 31.96 * x4
        - 6.868 * x2 * x
        + 0.4298 * x2
        + 0.1191 * x
        - 0.00232;
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
    let in_mat = mat3x3f(
        0.85662717, 0.13731897, 0.11189821,
        0.09512124, 0.76124197, 0.07679942,
        0.04825161, 0.10143904, 0.81130236
    );
    let out_mat = mat3x3f(
        1.1271006, -0.14132977, -0.14132977,
        -0.11060664, 1.1578237, -0.11060664,
        -0.01649394, -0.01649394, 1.2519364
    );

    let min_ev = -12.47393;
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



@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4f {
    let p = vec2<u32>(fragCoord.xy);

    if post.mode == 0 { // Shade + SSAO + Post
        let depthValue = textureLoad(depth, p, 0);
        let d = getWorldDepth(depthValue, p);
        let o = textureLoad(ssao, p, 0).x;
        let shaded = textureLoad(shaded, p, 0) + textureLoad(bloom, p, 0) * post.bloom;

        let fogD = clamp(d - post.fogStart, 0.0, post.fogEnd - post.fogStart);
        let fogFactor = min(fogD * post.fogDensity, 1.0);

        let shadedColor = (shaded.xyz * pow(o, post.occlusionPower)) * (1.0 - fogFactor) + post.fogColor * fogFactor;

        let toneMappedColor = agx_tonemap_punchy(shadedColor, post.exposure);

        let gammaCorrected = pow(toneMappedColor, vec3(1.0 / post.gamma));

        return vec4f(gammaCorrected, 1.0);
    } else if (post.mode == 1) {
        let zzz = (textureLoad(bloom, p, 0) * post.bloom) + textureLoad(shaded, p, 0);
        return vec4f(zzz.xyz, 1.0);
    } else { // Shade only 
        return vec4f(textureLoad(shaded, p, 0).xyz, 1.0);
    }
}
