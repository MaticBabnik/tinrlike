// import { Game } from "../../../state";
// import { makeStructuredView } from "webgpu-utils";
// import type { IPass } from "./pass.interface";
// import { Sprite2dSystem } from "@/honda/systems/sprite2d";
// import { nn } from "@/honda/util";

// type Run = { atlas: string; start: number; count: number };

// export class SpritePass implements IPass {
//     protected uniforms = makeStructuredView(
//         Game.gpu.shaderModules.devsprite.defs.structs.Uniforms,
//     );

//     protected storageBuffer: Float32Array;

//     protected uniformsGpu: GPUBuffer;
//     protected storageGpu: GPUBuffer;

//     protected bindGroups: Map<string, GPUBindGroup> = new Map();

//     constructor(maxSprites: number = 1024) {
//         this.uniformsGpu = Game.gpu.device.createBuffer({
//             size: this.uniforms.arrayBuffer.byteLength,
//             usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
//         });

//         this.storageBuffer = new Float32Array(maxSprites * 12);

//         this.storageGpu = Game.gpu.device.createBuffer({
//             size: this.storageBuffer.byteLength,
//             usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
//         });
//     }

//     protected getOrCreateBindGroup(atlas: string, forceNew: boolean = true) {
//         const group = this.bindGroups.get(atlas);

//         if (group && !forceNew) {
//             return group;
//         }

//         const atlasSpec = nn(
//             Game.ecs.getSystem(Sprite2dSystem).$atlases.get(atlas),
//         );

//         const newGroup = Game.gpu.device.createBindGroup({
//             layout: Game.gpu.bindGroupLayouts.devsprite,
//             entries: [
//                 {
//                     binding: 0,
//                     resource: {
//                         buffer: this.uniformsGpu,
//                     },
//                 },
//                 {
//                     binding: 1,
//                     resource: {
//                         buffer: this.storageGpu,
//                     },
//                 },
//                 {
//                     binding: 2,
//                     resource: atlasSpec.texture.createView(),
//                 },
//                 {
//                     binding: 3,
//                     resource: Game.gpu.getSampler({
//                         minFilter: "linear",
//                         magFilter: "linear",
//                         mipmapFilter: "linear",
//                     }),
//                 },
//             ],
//         });

//         this.bindGroups.set(atlas, newGroup);

//         return newGroup;
//     }

//     apply() {
//         const spriteSystem = Game.ecs.getSystem(Sprite2dSystem);
//         const sprites = spriteSystem.getBatch();
//         const atlases = spriteSystem.$atlases;

//         if (sprites.length === 0) {
//             return;
//         }

//         const runs: Run[] = [
//             {
//                 atlas: sprites[0].atlas,
//                 start: 0,
//                 count: 0,
//             },
//         ];

//         for (let i = 0; i < sprites.length; i++) {
//             let run = runs[runs.length - 1];

//             if (run.atlas !== sprites[i].atlas) {
//                 run = {
//                     atlas: sprites[i].atlas,
//                     start: i,
//                     count: 0,
//                 };
//                 runs.push(run);
//             }

//             const offset = i * 12;
//             const atlas = nn(atlases.get(sprites[i].atlas));

//             const uvtx = 1 / atlas.columns;
//             const uvty = 1 / atlas.rows;
//             const tx = (sprites[i].sid % atlas.columns) * uvtx;
//             const ty = Math.floor(sprites[i].sid / atlas.columns) * uvty;

//             this.storageBuffer[offset + 0] = sprites[i].x;
//             this.storageBuffer[offset + 1] = sprites[i].y;
//             this.storageBuffer[offset + 2] = sprites[i].scale;
//             this.storageBuffer[offset + 3] = sprites[i].rotate;

//             this.storageBuffer[offset + 4] = tx;
//             this.storageBuffer[offset + 5] = ty;
//             this.storageBuffer[offset + 6] = tx + uvtx;
//             this.storageBuffer[offset + 7] = ty + uvty;

//             this.storageBuffer[offset + 8] = sprites[i].multiplyRed;
//             this.storageBuffer[offset + 9] = sprites[i].multiplyGreen;
//             this.storageBuffer[offset + 10] = sprites[i].multiplyBlue;
//             this.storageBuffer[offset + 11] = sprites[i].multiplyAlpha;

//             run.count++;
//         }

//         const aspect = Game.gpu.aspectRatio;
//         const minRange = 1;
//         let wr = 0,
//             hr = 0;

//         if (aspect >= 1) {
//             // wider than tall
//             hr = minRange;
//             wr = hr * aspect;
//         } else {
//             // taller than wide
//             wr = minRange;
//             hr = wr / aspect;
//         }

//         this.uniforms.set({
//             scale: [wr, hr],
//         });

//         Game.gpu.device.queue.writeBuffer(
//             this.storageGpu,
//             0,
//             this.storageBuffer.buffer,
//             0,
//             sprites.length * 12 * 4,
//         );

//         Game.gpu.device.queue.writeBuffer(
//             this.uniformsGpu,
//             0,
//             this.uniforms.arrayBuffer,
//         );

//         const pass = Game.cmdEncoder.beginRenderPass({
//             colorAttachments: [
//                 {
//                     loadOp: "load",
//                     storeOp: "store",
//                     view: Game.gpu.canvasView,
//                 },
//             ],
//             timestampWrites: Game.gpu.timestamp("Sprite"),
//         });
//         pass.setPipeline(Game.gpu.pipelines.sprite);

//         for (const run of runs) {
//             pass.setBindGroup(0, this.getOrCreateBindGroup(run.atlas, false));
//             pass.draw(4, run.count, 0, run.start);
//         }

//         pass.end();
//     }
// }
