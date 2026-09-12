import type { Mat4 } from "wgpu-matrix";
import { CameraSys, LightSys, MeshSys, VisualSrv, type ECS } from "./honda";
import {
    Buffer,
    ShadowMapTexture,
    StructArrayBuffer,
    StructBuffer,
    ViewportMipTexture,
    ViewportTexture,
    type WGpu,
} from "./honda/backends/wg";
import { FunctionPass } from "./honda/backends/wg/rp/common/passes/function.pass";
import { SwitchPass } from "./honda/backends/wg/rp/common/passes/switch.pass";
import { BloomPass } from "./honda/backends/wg/rp/toonf/passes/bloom.pass";
import { DepthPass } from "./honda/backends/wg/rp/toonf/passes/depth.pass";
import {
    GatherDataPass,
    type ToonMeshInstance,
    type MeshDraws2,
    type UniformData,
    type GPUPostCfg,
} from "./honda/backends/wg/rp/toonf/passes/gather.pass";
import { GlitchPass } from "./honda/backends/wg/rp/toonf/passes/glitch.pass";
import { MainPass } from "./honda/backends/wg/rp/toonf/passes/main.pass";
import { PostPass } from "./honda/backends/wg/rp/toonf/passes/post.pass";
import { ResolvePass } from "./honda/backends/wg/rp/toonf/passes/resolve.pass";
import { ShadowPass } from "./honda/backends/wg/rp/toonf/passes/shadow.pass";
import { SwitchbleTView } from "./honda/backends/wg/texture/switch";

export async function createToonRP(gpu: WGpu, ecs: ECS) {
    if (document.location.hash === "#debug") {
        // FIXME: WebGPU devtools blow up when doing multisampling
        gpu.settings.multisample = 1;
    }

    const { multisample, renderScale, shadowMapSize } = gpu.settings;

    console.log(gpu.settings);

    gpu.$rpId = "toonF";


}
