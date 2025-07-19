const SIDES = array(mat3x3f(0, 0, - 1, 0, - 1, 0, 1, 0, 0), mat3x3f(0, 0, 1, 0, - 1, 0, - 1, 0, 0), mat3x3f(1, 0, 0, 0, 0, 1, 0, 1, 0), mat3x3f(1, 0, 0, 0, 0, - 1, 0, - 1, 0), mat3x3f(1, 0, 0, 0, - 1, 0, 0, 0, 1), mat3x3f(- 1, 0, 0, 0, - 1, 0, 0, 0, - 1));
const SIZE = 16;
const SAMPLE_DELTA = 0.025;
const PI: f32 = 3.14159265358979323846264338327950288;

@group(0) @binding(0)
var env_in: texture_cube<f32>;
@group(0) @binding(1)
var env_out: texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(2)
var smp: sampler;

@compute @workgroup_size(8, 8)
fn irradiance(@builtin(global_invocation_id) gid: vec3<u32>) {
    let uv = vec2((f32(gid.x) + 0.5) / f32(SIZE) * 2.0 - 1.0, (f32(gid.y) + 0.5) / f32(SIZE) * 2.0 - 1.0);
    let normal = normalize(SIDES[gid.z] * vec3(uv, 1.0));
    let right = normalize(cross(select(vec3f(0, 0, 1), vec3f(0, 1, 0), abs(normal.y) < 0.999), normal));
    let up = cross(normal, right);
    let tbn = mat3x3(right, up, normal);

    var val = vec3f(0.0);
    var nrSamples = 1;

    for (var phi = 0.0; phi < 2.0 * PI; phi += SAMPLE_DELTA) {
        for (var theta = 0.0; theta < 0.5 * PI; theta += SAMPLE_DELTA) {
            var n_dir = vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));

            let dir = tbn * n_dir;
            val += textureSampleLevel(env_in, smp, dir, 0).rgb * cos(theta) * sin(theta);
            nrSamples++;
        }
    }
    val = PI * val * (1.0 / f32(nrSamples));

    textureStore(env_out, gid.xy, gid.z, vec4(val, 1.0));
}

@compute @workgroup_size(8, 8)
fn specular(@builtin(global_invocation_id) gid: vec3<u32>) {
    let size = f32(textureDimensions(env_out).x);
    let uv = vec2((f32(gid.x) + 0.5) / size * 2.0 - 1.0, (f32(gid.y) + 0.5) / size * 2.0 - 1.0);
    
    let normal = normalize(SIDES[gid.z] * vec3(uv, 1.0));
    let right = normalize(cross(select(vec3f(0, 0, 1), vec3f(0, 1, 0), abs(normal.y) < 0.999), normal));
    let up = cross(normal, right);
    let tbn = mat3x3(right, up, normal);

    // real and true code; trust me
    let n_mips = log2(f32(textureDimensions(env_in).x)) - 5.0;
    let cur_mip = (5.0 + n_mips) - log2(size);
    let roughness = cur_mip / n_mips;
    let angle = mix(0.0, PI / 2.0, roughness); // this is made up

    var val = vec3f(0.0);
    var nrSamples = 0;

    for (var phi = 0.0; phi < 2.0 * PI; phi += SAMPLE_DELTA) {
        for (var theta = 0.0; theta < angle; theta += SAMPLE_DELTA) {
            var n_dir = vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));

            let dir = tbn * n_dir;
            val += textureSampleLevel(env_in, smp, dir, 0).rgb * sin(theta) * cos(theta); // this too is made up
            nrSamples++;
        }
    }
    val = val / f32(nrSamples);

    textureStore(env_out, gid.xy, gid.z, vec4(val, 1.0));
}
