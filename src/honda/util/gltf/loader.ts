import { assert, nn } from "..";
import type * as TG from "./gltf.types";
import { Game } from "@/honda/state";
import type {
    IDirectionalLight,
    IPointLight,
    ISpotLight,
    THondaLight,
} from "@/honda/systems/light";
import { SceneNode } from "@/honda/core/node";
import { LightComponent } from "@/honda/systems/light";
import {
    AnimInterp,
    type ASampler,
    V4Sampler,
    SSampler,
    V3Sampler,
} from "./animationsampler";
import { HAnimation } from "./animation";
import { MeshComponent, SkinInfo, SkinnedMeshComponent } from "@/honda/";
import {
    GPUBufHint,
    GPUBufUsage,
    GPUTexAddr,
    GPUTexFilter,
    GPUTexFormat,
    GPUTexShape,
    GPUTexUsage,
    type IGPUBuf,
    type IGPUMat,
    type IGPUTex,
    type IGPUTexData,
    type IGPUTexDesc,
} from "@/honda/gpu2";
import type { IGltfFile } from "./file";
import type { GltfAccessor, TTypedArrayCtor, TypedArrays } from "./types";
import {
    ALPHA_MODE_MAP,
    SAMPLER_TO_GPU,
    SCALARS_PER_ELEMENT,
    SUPPORTED_EXTENSIONS,
} from "./constants";
import { SmartWeakCache, TrivialCache, TrivialWeakCache } from "../cache";
import { MeshIndexType, MeshV2 } from "@/honda/gpu2/mesh";

type GltfCache = {
    buffers: SmartWeakCache<number, IGPUBuf>;
    textureData: SmartWeakCache<number, IGPUTexData>;
    textures: SmartWeakCache<number, IGPUTex>;
    meshes: TrivialWeakCache<number, MeshV2>;
    materials: SmartWeakCache<number, IGPUMat>;
};

function convertSamplerFilter(n: TG.TFilterMag | TG.TFilterMin): GPUTexFilter {
    return n & 1 ? GPUTexFilter.Linear : GPUTexFilter.Nearest;
}

function convertSamplerMipMapFilter(n: TG.TFilterMin): GPUTexFilter {
    return n & 2 ? GPUTexFilter.Linear : GPUTexFilter.Nearest;
}

export class GltfLoader {
    protected static caches = new TrivialCache<number, GltfCache>();
    protected cache: GltfCache;

    constructor(public readonly file: IGltfFile) {
        this._checkExtensions();
        this.cache = GltfLoader.caches.getOrCreate(this.file.id, () => ({
            buffers: new SmartWeakCache<number, IGPUBuf>((v) => v.valid),
            textureData: new SmartWeakCache<number, IGPUTexData>(
                (v) => v.valid,
            ),
            textures: new SmartWeakCache<number, IGPUTex>((v) => v.valid),
            meshes: new TrivialWeakCache<number, MeshV2>(), //TODO refcount mesh components
            materials: new SmartWeakCache<number, IGPUMat>((v) => v.valid),
        }));
    }

    private _checkExtensions() {
        const unsupportedRequired =
            this.file.json?.extensionsRequired?.filter(
                (ext) => !SUPPORTED_EXTENSIONS.includes(ext),
            ) ?? [];

        if (unsupportedRequired.length > 0) {
            console.error(
                "Unsupported extensions required:",
                unsupportedRequired.join(", "),
            );
        }

        const unsupportedUsed =
            this.file.json?.extensionsRequired?.filter(
                (ext) => !SUPPORTED_EXTENSIONS.includes(ext),
            ) ?? [];

        if (unsupportedUsed.length > 0) {
            console.warn(
                "Unsupported extensions used:",
                unsupportedUsed.join(", "),
            );
        }
    }

    /**
     * Gets an accessor from the file and asserts its type
     */
    protected assertTypedAccessor<
        Taccessor extends TG.TAccessorType,
        Tbuffer extends TypedArrays,
    >(
        index: number,
        expectedType: Taccessor,
        expectedBufferType: TTypedArrayCtor<Tbuffer>,
    ): GltfAccessor<Tbuffer, Taccessor> {
        const accessor = this.file.getAccessor(index);
        if (accessor.type !== expectedType) {
            throw new Error(
                `Accessor's type (${accessor.type}}) != expected type (${expectedType})`,
            );
        }

        if (!(accessor.accessor instanceof expectedBufferType)) {
            throw new Error(
                `Underlaying buffer doesn't match expected TypedArray (got ${accessor.accessor.constructor.name}, expected ${expectedBufferType.name})`,
            );
        }

        return accessor as unknown as GltfAccessor<Tbuffer, Taccessor>;
    }

    private createF32Buf(
        bufIdx: number,
        type: TG.TAccessorType,
        name: string,
    ): IGPUBuf {
        return this.cache.buffers.getOrCreate(bufIdx, () => {
            const accessor = this.assertTypedAccessor(
                bufIdx,
                type,
                Float32Array<ArrayBuffer>,
            );
            return this.createGpuBuffer(accessor, GPUBufUsage.Vertex, name);
        });
    }

    private createU8Buf(
        bufIdx: number,
        type: TG.TAccessorType,
        name: string,
    ): IGPUBuf {
        return this.cache.buffers.getOrCreate(bufIdx, () => {
            const accessor = this.assertTypedAccessor(
                bufIdx,
                type,
                Uint8Array<ArrayBuffer>,
            );
            return this.createGpuBuffer(
                accessor,
                GPUBufUsage.Vertex | GPUBufUsage.CopyDestination,
                name,
            );
        });
    }

    private createIndexBuf(bufIdx: number, name: string): IGPUBuf {
        return this.cache.buffers.getOrCreate(bufIdx, () => {
            const accessor = this.file.getAccessor(bufIdx);
            return this.createGpuBuffer(
                accessor,
                GPUBufUsage.Index | GPUBufUsage.CopyDestination,
                name,
            );
        });
    }

    private createMeshPrimitiveV2(mesh: number, primitive: number): MeshV2 {
        const gMesh = nn(this.file.json.meshes?.[mesh]);
        const gPrimitive = nn(gMesh.primitives[primitive]);

        const name = `${this.file.name}.${gMesh.name ?? mesh}.p${primitive}`;

        const posId = nn(gPrimitive.attributes.POSITION, 'no "POSITION"'),
            norId = nn(gPrimitive.attributes.NORMAL, 'no "NORMAL"'),
            uvIdx = nn(gPrimitive.attributes.TEXCOORD_0, 'no "TEXCOORD_0"'),
            tanId = gPrimitive.attributes.TANGENT,
            wghId = gPrimitive.attributes.WEIGHTS_0,
            jntId = gPrimitive.attributes.JOINTS_0,
            indId = gPrimitive.indices;

        const posBuf = this.createF32Buf(posId, "VEC3", `${name}:position`),
            norBuf = this.createF32Buf(norId, "VEC3", `${name}:normal`),
            uvBuf = this.createF32Buf(uvIdx, "VEC2", `${name}:uv`);
        let tanBuf: IGPUBuf | undefined,
            wghBuf: IGPUBuf | undefined,
            jntBuf: IGPUBuf | undefined;

        if (tanId !== undefined)
            tanBuf = this.createF32Buf(tanId, "VEC4", `${name}:tan`);
        if (wghId !== undefined)
            wghBuf = this.createF32Buf(wghId, "VEC4", `${name}:wgh`);
        if (jntId !== undefined)
            jntBuf = this.createU8Buf(jntId, "VEC4", `${name}:jnt`);

        let indBuf: IGPUBuf | undefined;
        let indexType = MeshIndexType.None;
        let drawCount = 0;

        if (indId !== undefined) {
            const indAcc = this.file.getAccessor(indId!);
            assert(indAcc.type === "SCALAR");
            drawCount = indAcc.count;
            if (indAcc.accessor instanceof Uint16Array) {
                indexType = MeshIndexType.U16;
            } else {
                indexType = MeshIndexType.U32;
            }

            indBuf = this.createIndexBuf(indId!, `${name}:index`);
        } else {
            drawCount = this.file.getAccessor(posId).count;
        }

        return new MeshV2(
            posBuf,
            norBuf,
            uvBuf,
            tanBuf,
            jntBuf,
            wghBuf,
            indBuf,
            indexType,
            drawCount,
        );
    }

    public getMeshPrimitiveV2(mesh: number, primitive: number): MeshV2 {
        const key = (mesh << 3) | primitive;
        return this.cache.meshes.getOrCreate(key, () => {
            const p = this.createMeshPrimitiveV2(mesh, primitive);
            return p;
        });
    }

    private createTextureData(imageIdx: number): IGPUTexData {
        const image = this.getTextureImage(imageIdx);

        const data = Game.gpu2.createTextureData({
            label: image.name,
            usage:
                GPUTexUsage.TextureBinding |
                GPUTexUsage.CopyDestination |
                GPUTexUsage.RenderTarget,
            format: GPUTexFormat.RGBA8UNORM,
            viewFormats: [
                GPUTexFormat.RGBA8UNORM,
                GPUTexFormat.RGBA8UNORM_SRGB,
            ],
            shape: GPUTexShape.T2D,
            size: [image.width, image.height, 1],
            mip: true,
        });

        data.uploadExternImage(image.bitmap);
        data.doMips();

        return data;
    }

    public getTextureDataV2(idx: number): IGPUTexData {
        return this.cache.textureData.getOrCreate(idx, () =>
            this.createTextureData(idx),
        );
    }

    private getSamplerParams(idx: number): Partial<IGPUTexDesc> {
        const gSampler = this.file.json.samplers?.[idx];

        const au = gSampler?.wrapS
            ? SAMPLER_TO_GPU[gSampler?.wrapS]
            : GPUTexAddr.Clamp;
        const av = gSampler?.wrapT
            ? SAMPLER_TO_GPU[gSampler?.wrapT]
            : GPUTexAddr.Clamp;

        const filterMin = convertSamplerFilter(gSampler?.minFilter ?? 9729);
        const filterMag = convertSamplerFilter(gSampler?.magFilter ?? 9729);
        const filterMip = convertSamplerMipMapFilter(
            gSampler?.minFilter ?? 9729,
        );

        return {
            address: [au, av, GPUTexAddr.Clamp],
            filterMin,
            filterMag,
            filterMip,
        };
    }

    private createTextureV2(idx: number): IGPUTex {
        const gTexture = nn(this.file.json.textures?.[idx]);

        const name = `${this.file.name}.${gTexture.name ?? idx}`;

        const imageIdx =
            gTexture.extensions?.EXT_texture_avif?.source ??
            gTexture.extensions?.EXT_texture_webp?.source ??
            gTexture.source;

        const data = this.getTextureDataV2(
            nn(imageIdx, "No supported textures"),
        );

        return Game.gpu2.createTexture(
            {
                ...this.getSamplerParams(gTexture.sampler ?? 9999),
                label: name,
            },
            data,
        );
    }

    public getTextureV2(idx: number): IGPUTex {
        return this.cache.textures.getOrCreate(idx, () =>
            this.createTextureV2(idx),
        );
    }

    private createMaterialV2(idx: number): IGPUMat {
        const gMaterial = nn(this.file.json.materials?.[idx]);

        const name = `${this.file.name}.${gMaterial.name ?? idx}`;

        const texBase = gMaterial.pbrMetallicRoughness?.baseColorTexture?.index;
        const texMR =
            gMaterial.pbrMetallicRoughness?.metallicRoughnessTexture?.index;
        const texEms = gMaterial.emissiveTexture?.index;
        const texNor = gMaterial.normalTexture?.index;

        let baseTex: IGPUTex | undefined,
            mrTex: IGPUTex | undefined,
            emsTex: IGPUTex | undefined,
            norTex: IGPUTex | undefined;

        if (texBase !== undefined) baseTex = this.getTextureV2(texBase);
        if (texMR !== undefined) mrTex = this.getTextureV2(texMR);
        if (texEms !== undefined) emsTex = this.getTextureV2(texEms);
        if (texNor !== undefined) norTex = this.getTextureV2(texNor);

        return Game.gpu2.createMaterial({
            label: name,

            baseTexture: baseTex,
            metRhgTexture: mrTex,
            emissionTexture: emsTex,
            normalTexture: norTex,

            colorFactor: gMaterial.pbrMetallicRoughness?.baseColorFactor,
            metallicFactor: gMaterial.pbrMetallicRoughness?.metallicFactor,
            roughnessFactor: gMaterial.pbrMetallicRoughness?.roughnessFactor,
            emissionFactor: gMaterial.emissiveFactor,
            normalScale: gMaterial.normalTexture?.scale,

            alphaCutoff: gMaterial.alphaCutoff,
            alphaMode: ALPHA_MODE_MAP[gMaterial.alphaMode as TG.TAlphaMode],
        });
    }

    public getMaterialV2(idx: number): IGPUMat {
        return this.cache.materials.getOrCreate(idx, () => {
            const m = this.createMaterialV2(idx);
            return m;
        });
    }

    private createGpuBuffer(
        accessor: GltfAccessor,
        usage: GPUBufUsage,
        label?: string,
        hint: GPUBufHint = GPUBufHint.None,
    ): IGPUBuf {
        const size = accessor.accessor.byteLength;
        const gpuBuf = Game.gpu2.createBuffer({
            size,
            usage: usage | GPUBufUsage.CopyDestination,
            label,
            hint,
        });

        gpuBuf.upload(
            accessor.accessor,
            0,
            accessor.count * SCALARS_PER_ELEMENT[accessor.type],
        );

        return gpuBuf;
    }

    protected _getImage(imageIdx: number) {
        const bitmap = nn(
            this.file.getImageBitmap(imageIdx),
            "image OOB, did you forget to call prepareImages()",
        );

        const gImage = nn(this.file.json.images?.[imageIdx], "image OOB");

        return {
            bitmap,
            name: gImage.name ?? `gltf${this.file.id}_image${imageIdx}`,
            width: bitmap.width,
            height: bitmap.height,
        };
    }

    protected getTextureImage(texId: number) {
        const gTexture = this.file.json.textures?.[texId];
        if (!gTexture) throw new Error("Texture index OOB");

        const source =
            gTexture?.extensions?.EXT_texture_webp?.source ??
            gTexture?.extensions?.EXT_texture_avif?.source ??
            gTexture.source;

        return this._getImage(nn(source, "no supported textures found"));
    }

    public loadMeshToNode(node: SceneNode, idx: number) {
        const gMesh = nn(this.file.json.meshes?.[idx]);

        gMesh.primitives.forEach((p, i) => {
            if (p.material === undefined) return;

            const mp = this.getMeshPrimitiveV2(idx, i);
            const mm = this.getMaterialV2(p.material);

            node.addComponent(new MeshComponent(mp, mm, `mesh${idx}.prim${i}`));
        });
    }

    public loadSkinnedMeshToNode(
        node: SceneNode,
        meshIdx: number,
        skinIdx: number,
    ) {
        const gMesh = nn(this.file.json.meshes?.[meshIdx]);
        const gSkin = nn(this.file.json.skins?.[skinIdx]);

        const invBindMat = this.assertTypedAccessor(
            nn(gSkin.inverseBindMatrices),
            "MAT4",
            Float32Array<ArrayBuffer>,
        );

        const skin = new SkinInfo(
            this.file.id,
            gSkin.joints,
            invBindMat.accessor,
        );

        gMesh.primitives.forEach((p, i) => {
            if (p.material === undefined) return;

            const mp = this.getMeshPrimitiveV2(meshIdx, i);
            const mm = this.getMaterialV2(p.material);

            mm.rcUse();

            if (!mp.joints || !mp.weights) {
                throw new Error(
                    `Skinning data missing in mesh primitive (${meshIdx}-${i})!`,
                );
            }

            node.addComponent(
                new SkinnedMeshComponent(
                    mp,
                    mm,
                    skin,
                    `skinnedMesh${meshIdx}.prim${i}`,
                ),
            );
        });
    }

    //#region KHR_lights_punctual

    public getLight(id: number): THondaLight {
        const gLight = nn(
            this.file.json.extensions?.KHR_lights_punctual?.lights[id],
            "Light ID OOB",
        );

        const color = gLight.color ?? [1, 1, 1],
            intensity = gLight.intensity ?? 1,
            maxRange = gLight.range ?? 100,
            castShadows = !gLight.extras?._noshadow;

        switch (gLight.type) {
            case "spot":
                return {
                    type: "spot",
                    color,
                    intensity,
                    maxRange,
                    castShadows,
                    innerCone: gLight.spot?.innerConeAngle ?? 0,
                    outerCone: gLight.spot?.outerConeAngle ?? Math.PI / 4,
                } satisfies ISpotLight;

            case "point":
                return {
                    type: "point",
                    color,
                    intensity,
                    maxRange,
                    castShadows,
                } satisfies IPointLight;

            case "directional":
                return {
                    type: "directional",
                    color,
                    intensity,
                    castShadows,
                    maxRange,
                } satisfies IDirectionalLight;

            default:
                throw new Error(`Unknown light type ${gLight.type}`);
        }
    }

    //#endregion KHR_lights_punctual

    //#region Nodes & Scene Handling

    public nodeConvert(index: number): SceneNode | undefined {
        const gNode = nn(this.file.json.nodes?.[index]);
        const node = new SceneNode();
        node.meta.gltfId = this.file.id;
        node.meta.gltfNodeId = index;
        node.name = gNode.name ?? `${this.file.name}.nodes.${index}`;

        if (gNode.matrix) console.warn("glTF Matrices unsupported");

        // transform
        if (gNode.translation) {
            node.transform.translation.set(gNode.translation);
        }
        if (gNode.rotation) {
            node.transform.rotation.set(gNode.rotation);
        }
        if (gNode.scale) {
            node.transform.scale.set(gNode.scale);
        }
        node.transform.update();

        // meshes
        if (typeof gNode.mesh === "number") {
            if (typeof gNode.skin === "number") {
                // fuck...
                this.loadSkinnedMeshToNode(node, gNode.mesh, gNode.skin);
            } else this.loadMeshToNode(node, gNode.mesh);
        }

        // light
        const lightId = gNode.extensions?.KHR_lights_punctual?.light;
        if (typeof lightId === "number") {
            node.addComponent(
                new LightComponent(
                    this.getLight(lightId),
                    this.file.json.extensions?.KHR_lights_punctual?.lights[
                        lightId
                    ]?.name ?? `Light${lightId}`,
                ),
            );
        }

        // children
        gNode.children?.forEach((c) => {
            const newNode = this.nodeConvert(c);
            if (newNode) node.addChild(newNode);
        });

        return node;
    }

    public defaultScene(): TG.IScene {
        return nn(
            this.file.json.scenes?.[
                nn(this.file.json.scene, "No default scene")
            ],
            "Default scene OOB",
        );
    }

    public getScene(id: number): TG.IScene;
    public getScene(name: string): TG.IScene;
    public getScene(arg: string | number) {
        if (typeof arg === "string") {
            return nn(
                this.file.json.scenes?.find((x) => x.name === arg),
                "No matching scene",
            );
        }

        return nn(this.file.json.scenes?.[arg], "Scene idx OOB");
    }

    public sceneAsNode(index = 0): SceneNode {
        const scene = nn(this.file.json.scenes?.[index], "Scene idx OOB");
        const node = new SceneNode();
        node.name = scene.name ?? `${this.file.name}.scenes.${index}`;

        scene.nodes?.forEach((c) => {
            const newNode = this.nodeConvert(c);
            if (newNode) node.addChild(newNode);
        });

        return node;
    }

    //#endregion Nodes & Scene Handling

    //#region Animations

    public convertAnimationSampler(gas: TG.IAnimationSampler): ASampler {
        if (gas.interpolation && !(gas.interpolation in AnimInterp)) {
            throw new Error(`Unknown Interpolation type ${gas.interpolation}`);
        }

        const interp = (gas.interpolation ?? AnimInterp.LINEAR) as AnimInterp;

        const inAcc = this.assertTypedAccessor(
            gas.input,
            "SCALAR",
            Float32Array<ArrayBuffer>,
        );
        const outAcc = this.file.getAccessor(gas.output);

        if (!(outAcc.accessor instanceof Float32Array)) {
            throw new Error("Refusing to sample non-float accessor");
        }

        switch (outAcc.type) {
            case "SCALAR":
                return new SSampler(
                    interp,
                    inAcc,
                    outAcc as GltfAccessor<Float32Array<ArrayBuffer>, "SCALAR">,
                );
            case "VEC3":
                return new V3Sampler(
                    interp,
                    inAcc,
                    outAcc as GltfAccessor<Float32Array<ArrayBuffer>, "VEC3">,
                );
            case "VEC4":
                return new V4Sampler(
                    interp,
                    inAcc,
                    outAcc as GltfAccessor<Float32Array<ArrayBuffer>, "VEC4">,
                );
            default:
                throw new Error(`Cannot animate ${outAcc.type}`);
        }
    }

    /**
     * Converts an animation.
     * The animation is a no-op by default
     * call .attach() first
     */
    public getAnimation(index: number): HAnimation {
        const gAnimation = nn(
            this.file.json.animations[index],
            "Animation not found",
        );

        return new HAnimation(
            gAnimation.samplers.map((x) => this.convertAnimationSampler(x)),
            gAnimation.channels,
            this.file.id,
            gAnimation.name ?? `${this.file.name}>anim>${index}`,
        );
    }

    /**
     * Converts an animation.
     * The animation is a no-op by default
     * call .attach() first
     */
    public getAnimationByName(name: string): HAnimation {
        const index = this.file.json.animations.findIndex(
            (x) => x.name === name,
        );
        return this.getAnimation(index);
    }

    //#endregion Animations
}
