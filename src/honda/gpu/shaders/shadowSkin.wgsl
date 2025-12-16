struct Instance {
    transform: mat4x4<f32>,
    invTransform: mat4x4<f32>,
    joints: array<mat4x4f, 128>,
}

struct VertexIn {
    @builtin(instance_index) instanceIndex: u32,
    @location(0) position: vec3f,
    @location(1) jointIds: vec4<u32>,
    @location(2) jointWeights: vec4f,
}

@group(0) @binding(0)
var<uniform> vp: mat4x4<f32>;
@group(0) @binding(1)
var<storage, read> instances: array<Instance>;

@vertex
fn vertex_main(v: VertexIn) -> @builtin(position) vec4f {
    let instance = instances[v.instanceIndex];
    // Compute skin matrix
    let sm = instance.joints[v.jointIds[0]] * v.jointWeights[0] + instance.joints[v.jointIds[1]] * v.jointWeights[1] + instance.joints[v.jointIds[2]] * v.jointWeights[2] + instance.joints[v.jointIds[3]] * v.jointWeights[3];

    // Project to world
    let wPos = instance.transform * sm * vec4f(v.position, 1.0);
    
    // project position
    return vp * wPos;
}

@fragment
fn fragment_main() { }
