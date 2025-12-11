import { Mesh } from "@/honda/gpu/meshes/mesh";
import { assert, nMips, nn } from "..";
import type * as TG from "./gltf.types";
import { Material } from "@/honda/gpu/material/material";
import { Game } from "@/honda/state";
import { generateMipmap } from "webgpu-utils";
import { vec3, vec4 } from "wgpu-matrix";
import { AlphaMode } from "@/honda/gpu/material/material.types";
import type {
    IDirectionalLight,
    IPointLight,
    ISpotLight,
    THondaLight,
} from "@/honda/systems/light";
import { SceneNode } from "@/honda/core/node";
import { MeshComponent } from "@/honda/systems/mesh";
import { LightComponent } from "@/honda/systems/light";
import {
    AnimInterp,
    type ASampler,
    V4Sampler,
    SSampler,
    V3Sampler,
} from "./animationsampler";
import { HAnimation } from "./animation";

export type TTypedArrayCtor<T> = {
    new (buffer: ArrayBufferLike, byteOffset?: number, length?: number): T;
    BYTES_PER_ELEMENT: number;
};
export type TypedArrays =
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Uint32Array
    | Float32Array;

export interface HondaAccesor<
    Tbuffer extends TypedArrays = TypedArrays,
    Taccessor extends TG.TAccessorType = TG.TAccessorType,
> {
    accessor: Tbuffer;
    isElement: boolean;
    normalized: false | undefined;
    type: Taccessor;
    count: number;
}

export interface HondaBufferView {
    buffer: ArrayBuffer;
    isElement: boolean;
    bOffset: number;
    bLength: number;
}

export interface POI {
    position: [number, number, number];
    name: string;
    props: Record<string, unknown>;
}

/**
 * # glTF Binary (glb) parser, loader, utility class and more...
 */
export class GltfBinary {
    private static readonly MAGIC = 0x46546c67;
    private static readonly CHUNKYTPE_JSON = 0x4e4f534a;
    private static readonly CHUNKTYPE_BIN = 0x004e4942;

    public static readonly supportedExtensions: string[] = [
        "EXT_texture_webp",
        "EXT_texture_avif",
        "KHR_lights_punctual",
        "KHR_materials_emissive_strength",
    ];

    static readonly COMP_TYPE_TO_CTOR: Record<
        TG.TComponentType,
        TTypedArrayCtor<TypedArrays>
    > = {
        5120: Int8Array,
        5121: Uint8Array,
        5122: Int16Array,
        5123: Uint16Array,
        5125: Uint32Array,
        5126: Float32Array,
    };

    static readonly SAMPLER_TO_WGPU: Record<TG.TWrap, GPUAddressMode> = {
        33071: "clamp-to-edge",
        33648: "mirror-repeat",
        10497: "repeat",
    };

    static readonly ALPHA_MODE_MAP: Record<TG.TAlphaMode, AlphaMode> = {
        BLEND: AlphaMode.BLEND,
        MASK: AlphaMode.MASK,
        OPAQUE: AlphaMode.OPAQUE,
    };

    static readonly SCALARS_PER_ELEMENT: Record<TG.TAccessorType, number> = {
        SCALAR: 1,
        MAT2: 2 * 2,
        MAT3: 3 * 3,
        MAT4: 4 * 4,
        VEC2: 2,
        VEC3: 3,
        VEC4: 4,
        STRING: -1, // TODO(mbabnik): strings?
    };

    static convertSamplerFilter(
        n: TG.TFilterMag | TG.TFilterMin,
    ): GPUFilterMode {
        return n & 1 ? "linear" : "nearest";
    }

    static convertSamplerMipMapFilter(n: TG.TFilterMin): GPUMipmapFilterMode {
        return n & 2 ? "linear" : "nearest";
    }

    public static async fromUrl(url: string) {
        const start = performance.now();
        console.time(url);
        const f = await fetch(url);
        const buf = await f.arrayBuffer();

        const gltf = new GltfBinary(buf, url);
        await gltf.prepareImages();
        console.log(`[GltfBinary] Loaded ${url} in ${(
            performance.now() - start
        ).toFixed(1)}ms
                Version: ${gltf.json.asset.version}
                Generator: ${gltf.json.asset.generator ?? "unknown"}
                Copyright: ${gltf.json.asset.copyright ?? "unknown"}
                Extensions: ${gltf.json.extensionsUsed?.join(",") ?? ""}
                `);
        return gltf;
    }

    public json: TG.IGltfRoot;

    protected gpuBufferCache = new Map<number, WeakRef<GPUBuffer>>();
    protected meshCache = new Map<number, WeakRef<Mesh>>();
    protected textureCache = new Map<number, WeakRef<GPUTexture>>();
    protected materialCache = new Map<number, WeakRef<Material>>();

    protected static cacheOr<T extends WeakKey>(
        cache: Map<number, WeakRef<T>>,
        key: number,
        fn: () => T,
    ): T {
        const value = cache.get(key)?.deref();

        if (!value) {
            const v = fn();
            const nWeak = new WeakRef(v);
            cache.set(key, nWeak);
            return v;
        }

        return value;
    }

    private bin: ArrayBufferView;
    private imageCache: ImageBitmap[] = [];
    private static gltfid = 0;

    public readonly id = GltfBinary.gltfid++;

    protected constructor(
        buf: ArrayBuffer,
        protected name = `<unknown glTF ${this.id}>`,
    ) {
        const bufU32 = new Uint32Array(buf);

        const [magic, version] = bufU32;

        if (magic !== GltfBinary.MAGIC) {
            throw new Error("Invalid magic, this isn't glTF");
        }

        if (version !== 2) {
            throw new Error("Only version 2 is supported");
        }

        let jsonView: DataView | undefined, binView: DataView | undefined;

        for (let i = 3; i < bufU32.length; ) {
            const cLen = bufU32[i];
            const cType = bufU32[i + 1];
            const dv = new DataView(buf, (i + 2) * 4, cLen);

            if (cType === GltfBinary.CHUNKYTPE_JSON) jsonView = dv;
            else if (cType === GltfBinary.CHUNKTYPE_BIN) binView = dv;

            i += Math.ceil(cLen / 4) + 2;
        }

        this.json = JSON.parse(
            new TextDecoder().decode(nn(jsonView, "Missing JSON chunk")),
        );
        this.bin = nn(binView, "Missing Binary chunk");

        this.checkExt();
    }

    protected async prepareImages(): Promise<void> {
        this.imageCache = await Promise.all(
            (this.json.images ?? []).map((imgDef) => {
                const ibv = this.getBufferView(imgDef.bufferView);

                const base = ibv.bOffset + this.bin.byteOffset;
                const blob = new Blob(
                    [ibv.buffer.slice(base, base + ibv.bLength)],
                    { type: imgDef.mimeType },
                );

                return createImageBitmap(blob);
            }),
        );
    }

    protected checkExt() {
        const unsupportedRequired =
            this.json?.extensionsRequired?.filter(
                (ext) => !GltfBinary.supportedExtensions.includes(ext),
            ) ?? [];
        const unsupportedUsed =
            this.json?.extensionsRequired?.filter(
                (ext) => !GltfBinary.supportedExtensions.includes(ext),
            ) ?? [];

        if (unsupportedRequired.length > 0) {
            console.error(
                "Unsupported extensions required:",
                unsupportedRequired.join(", "),
            );
        }
        if (unsupportedUsed.length > 0) {
            console.warn(
                "Unsupported extensions used:",
                unsupportedUsed.join(", "),
            );
        }
    }

    protected getBuffer(index: number) {
        if (index !== 0) {
            throw new Error(
                `Multiple buffers not supported (requested buffer ${index})!`,
            );
        }

        const gBuffer = nn(this.json.buffers?.[index]);

        if (gBuffer.byteLength !== this.bin.byteLength) {
            console.warn(
                `Buffer size mismatch (JSON: ${gBuffer.byteLength} BIN: ${this.bin.byteLength}) `,
            );
        }
        return this.bin.buffer as ArrayBuffer;
    }

    protected getBufferView(index: number): HondaBufferView {
        const gBufferView = nn(
            this.json.bufferViews?.[index],
            "bufferView OOB",
        );

        return {
            buffer: this.getBuffer(gBufferView.buffer),
            isElement: !!((gBufferView.target ?? 0) & 1),
            bOffset: gBufferView.byteOffset ?? 0,
            bLength: gBufferView.byteLength,
        };
    }

    protected getAccessor(index: number): HondaAccesor {
        const gAccessor = nn(this.json.accessors?.[index], "accessor OOB");
        if (
            gAccessor.normalized ||
            gAccessor.sparse ||
            typeof gAccessor.bufferView !== "number"
        ) {
            throw new Error("Unsupported");
        }

        const TypedArrayCtor =
            GltfBinary.COMP_TYPE_TO_CTOR[gAccessor.componentType];
        const bv = this.getBufferView(gAccessor.bufferView);

        const accessor = new TypedArrayCtor(
            bv.buffer,
            bv.bOffset + this.bin.byteOffset + (gAccessor.byteOffset ?? 0),
            gAccessor.count * GltfBinary.SCALARS_PER_ELEMENT[gAccessor.type],
        );

        return {
            accessor,
            isElement: bv.isElement,
            normalized: gAccessor.normalized ?? false,
            type: gAccessor.type,
            count: gAccessor.count,
        };
    }

    protected getAccessorAndAssertType<
        Taccessor extends TG.TAccessorType,
        Tbuffer extends TypedArrays,
    >(
        index: number,
        expectedType: Taccessor,
        expectedBufferType: TTypedArrayCtor<Tbuffer>,
    ): HondaAccesor<Tbuffer, Taccessor> {
        const accessor = this.getAccessor(index);
        if (accessor.type !== expectedType) {
            throw new Error(
                `Accessor's type (${accessor.type}}) != expected type (${expectedType})`,
            );
        }

        if (!(accessor.accessor instanceof expectedBufferType)) {
            throw new Error(
                `Underlaying buffer doesn't match expected TypedArray`,
            );
        }

        return accessor as unknown as HondaAccesor<Tbuffer, Taccessor>;
    }

    protected uploadAccesorToGpuWithAssertType<
        Taccessor extends TG.TAccessorType,
        Tbuffer extends TypedArrays,
    >(
        index: number,
        expectedType: Taccessor,
        expectedBufferType: TTypedArrayCtor<Tbuffer>,
        usage: GPUBufferUsageFlags,
        label?: string,
    ) {
        const accessor = this.getAccessorAndAssertType(
            index,
            expectedType,
            expectedBufferType,
        );

        const b = Game.gpu.device.createBuffer({
            label,
            size: (accessor.accessor.byteLength + 3) & ~3, // make size a multiple of 4
            usage: usage | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });

        //@ts-expect-error "God, I wish there was an easier way to do this"
        const dst = new accessor.accessor.constructor(
            b.getMappedRange(),
        ) as TypedArrays;
        dst.set(accessor.accessor);
        b.unmap();

        return b;
    }

    /**
     * @deprecated
     */
    protected getMeshPrimitive(index: number) {
        const gMesh = nn(this.json.meshes?.[index], "mesh OOB");

        if (gMesh.primitives.length > 1) {
            console.warn(
                `Unsupported: multiple primitives in mesh (index: ${index}, name: ${
                    gMesh.name || "<none>"
                })`,
            );
        }

        return nn(gMesh.primitives[0], `Mesh ${index} has no primitives`);
    }

    protected getTextureImage(texId: number) {
        const gTexture = this.json.textures?.[texId];
        if (!gTexture) throw new Error("Texture index OOB");

        const source =
            gTexture?.extensions?.EXT_texture_webp?.source ??
            gTexture?.extensions?.EXT_texture_avif?.source ??
            gTexture.source;

        return this.getImage(nn(source, "no supported textures found"));
    }

    protected getTextureSamplerDescriptor(texId: number): GPUSamplerDescriptor {
        const gTexture = nn(this.json.textures?.[texId], "Texture index OOB");

        return this.getWebgpuSamplerDescriptor(
            nn(gTexture.sampler, "NO SAMPLER! Missing default?"),
        );
    }

    protected getTextureData(texId: number) {
        const gTexture = nn(this.json.textures?.[texId], "Texture index OOB");
        if (!gTexture) throw new Error("Texture index OOB");

        const source =
            gTexture?.extensions?.EXT_texture_webp?.source ??
            gTexture?.extensions?.EXT_texture_avif?.source ??
            gTexture.source;

        if (source === undefined) {
            throw new Error("No supported textures found.");
        }

        return {
            samplerDescriptor: this.getWebgpuSamplerDescriptor(
                nn(gTexture.sampler, "NO SAMPLER! Missing default?"),
            ),
            image: this.getImage(source),
        };
    }

    protected getWebgpuSamplerDescriptor(
        samplerIdx: number,
    ): GPUSamplerDescriptor {
        const gSampler = nn(
            this.json.samplers?.[samplerIdx],
            "Sampler idx OOB",
        );

        return {
            addressModeU: GltfBinary.SAMPLER_TO_WGPU[gSampler.wrapS ?? 10497],
            addressModeV: GltfBinary.SAMPLER_TO_WGPU[gSampler.wrapT ?? 10497],
            minFilter: GltfBinary.convertSamplerFilter(
                gSampler.minFilter ?? 9728,
            ),
            magFilter: GltfBinary.convertSamplerFilter(
                gSampler.magFilter ?? 9728,
            ),
            mipmapFilter: GltfBinary.convertSamplerMipMapFilter(
                gSampler.magFilter ?? 9728,
            ),
        };
    }

    protected getImage(imageIdx: number) {
        return nn(
            this.imageCache[imageIdx],
            "image OOB, did you forget to call prepareImages()",
        );
    }

    protected getMeshNoCache(mesh: number, primitive: number): Mesh {
        const gm = nn(this.json.meshes?.[mesh]);
        const gPrimitive = gm.primitives[primitive];
        const name = `mp:${gm.name ?? mesh}.p${primitive}`;

        const position = nn(
                gPrimitive.attributes.POSITION,
                "Position is required!",
            ),
            normal = nn(gPrimitive.attributes.NORMAL, "Normals are required!"),
            texCoord = nn(
                gPrimitive.attributes.TEXCOORD_0,
                "TexCoord is required!",
            ),
            indices = nn(
                gPrimitive.indices,
                "Non indexed geometry is not supported, unlucky.",
            ),
            tangent = gPrimitive.attributes.TANGENT;

        if (gPrimitive.mode !== undefined && gPrimitive.mode !== 4) {
            throw new Error("Unsupported: non-triagle-list geometry");
        }

        const indexBuffer = GltfBinary.cacheOr(
                this.gpuBufferCache,
                indices,
                () =>
                    this.uploadAccesorToGpuWithAssertType(
                        indices,
                        "SCALAR",
                        Uint16Array,
                        GPUBufferUsage.INDEX,
                        `${name}:index`,
                    ),
            ),
            posBuffer = GltfBinary.cacheOr(this.gpuBufferCache, position, () =>
                this.uploadAccesorToGpuWithAssertType(
                    position,
                    "VEC3",
                    Float32Array,
                    GPUBufferUsage.VERTEX,
                    `${name}:position`,
                ),
            ),
            normBuffer = GltfBinary.cacheOr(this.gpuBufferCache, normal, () =>
                this.uploadAccesorToGpuWithAssertType(
                    normal,
                    "VEC3",
                    Float32Array,
                    GPUBufferUsage.VERTEX,
                    `${name}:normal`,
                ),
            ),
            texCoordBuffer = GltfBinary.cacheOr(
                this.gpuBufferCache,
                texCoord,
                () =>
                    this.uploadAccesorToGpuWithAssertType(
                        texCoord,
                        "VEC2",
                        Float32Array,
                        GPUBufferUsage.VERTEX,
                        `${name}:texCoord`,
                    ),
            ),
            tangentBuffer =
                tangent === undefined
                    ? undefined
                    : GltfBinary.cacheOr(this.gpuBufferCache, tangent, () =>
                          this.uploadAccesorToGpuWithAssertType(
                              tangent,
                              "VEC4",
                              Float32Array,
                              GPUBufferUsage.VERTEX,
                              `${name}:tangent`,
                          ),
                      );

        return new Mesh(
            posBuffer,
            normBuffer,
            texCoordBuffer,
            tangentBuffer,
            indexBuffer,
            nn(nn(this.json.accessors)[nn(gPrimitive.indices)].count),
        );
    }

    public getMeshP(mesh: number, primitive: number) {
        //FIXME(mbabnik): fix caching bullshit
        return GltfBinary.cacheOr(this.meshCache, (mesh << 4) | primitive, () =>
            this.getMeshNoCache(mesh, primitive),
        );
    }

    protected uploadTexture(index: number) {
        const image = this.getTextureImage(index);

        const texture = Game.gpu.device.createTexture({
            //TODO(mbabnik): Grab a label
            format: "rgba8unorm",
            viewFormats: ["rgba8unorm", "rgba8unorm-srgb"],
            size: [image.width, image.height],
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
            mipLevelCount: nMips(image.width, image.height),
        });

        Game.gpu.device.queue.copyExternalImageToTexture(
            { source: image },
            { texture },
            [image.width, image.height, 1],
        );

        generateMipmap(Game.gpu.device, texture);

        return texture;
    }

    protected getGpuTexture(index: number) {
        return GltfBinary.cacheOr(this.textureCache, index, () =>
            this.uploadTexture(index),
        );
    }

    protected getMaterialNoCache(idx: number): Material {
        const gMat = nn(this.json.materials?.[idx], "Mat IDX OOB");

        const pbr = nn(gMat.pbrMetallicRoughness, "Missing PBR component");

        const baseTex = pbr.baseColorTexture
            ? this.getGpuTexture(pbr.baseColorTexture.index)
            : undefined;
        const baseSampler = pbr.baseColorTexture
            ? Game.gpu.getSampler(
                  this.getTextureSamplerDescriptor(pbr.baseColorTexture.index),
              )
            : undefined;
        const baseFactor = pbr.baseColorFactor
            ? vec4.create(...pbr.baseColorFactor)
            : undefined;

        const mrTex = pbr.metallicRoughnessTexture
            ? this.getGpuTexture(pbr.metallicRoughnessTexture.index)
            : undefined;
        const mrSampler = pbr.metallicRoughnessTexture
            ? Game.gpu.getSampler(
                  this.getTextureSamplerDescriptor(
                      pbr.metallicRoughnessTexture.index,
                  ),
              )
            : undefined;
        const metalFactor = pbr.metallicFactor;
        const roughFactor = pbr.roughnessFactor;

        const emTex = gMat.emissiveTexture
            ? this.getGpuTexture(gMat.emissiveTexture.index)
            : undefined;
        const emSampler = gMat.emissiveTexture
            ? Game.gpu.getSampler(
                  this.getTextureSamplerDescriptor(gMat.emissiveTexture.index),
              )
            : undefined;
        const emFactor = gMat.emissiveFactor
            ? vec3.create(...gMat.emissiveFactor)
            : undefined;

        return new Material(
            {
                texture: baseTex,
                sampler: baseSampler,
                factor: baseFactor,
            },
            {
                texture: mrTex,
                sampler: mrSampler,
                metalFactor,
                roughFactor,
            },
            gMat.normalTexture
                ? {
                      texture: this.getGpuTexture(gMat.normalTexture.index),
                      sampler: Game.gpu.getSampler(
                          this.getTextureSamplerDescriptor(
                              gMat.normalTexture.index,
                          ),
                      ),
                      scale: gMat.normalTexture.scale ?? 1,
                  }
                : undefined,
            {
                factor: emFactor,
                sampler: emSampler,
                texture: emTex,
            },
            {
                alphaCutoff: gMat.alphaCutoff,
                mode: GltfBinary.ALPHA_MODE_MAP[gMat.alphaMode ?? "OPAQUE"],
            },
            gMat.name ?? "unknown",
        );
    }

    public getMaterial(idx: number): Material {
        return GltfBinary.cacheOr(this.materialCache, idx, () =>
            this.getMaterialNoCache(idx),
        );
    }

    public defaultScene(): TG.IScene {
        return nn(
            this.json.scenes?.[nn(this.json.scene, "No default scene")],
            "Default scene OOB",
        );
    }

    public getScene(id: number): TG.IScene;
    public getScene(name: string): TG.IScene;
    public getScene(arg: string | number) {
        if (typeof arg === "string") {
            return nn(
                this.json.scenes?.find((x) => x.name === arg),
                "No matching scene",
            );
        }

        return nn(this.json.scenes?.[arg], "Scene idx OOB");
    }

    public loadMeshToNode(node: SceneNode, idx: number) {
        const gMesh = nn(this.json.meshes?.[idx]);

        gMesh.primitives.forEach((p, i) => {
            const mp = this.getMeshP(idx, i);
            const mm = this.getMaterial(nn(p.material, "no material!"));
            node.addComponent(new MeshComponent(mp, mm, `mesh:${idx}-${i}`));
        });
    }

    public nodeConvert(index: number): SceneNode | undefined {
        const gNode = nn(this.json.nodes?.[index]);
        const node = new SceneNode();
        node.meta.gltfId = this.id;
        node.meta.gltfNodeId = index;
        node.name = gNode.name ?? `${this.name}.nodes.${index}`;

        if (gNode.matrix) console.warn("glTF Matrices unsupported");

        if (gNode.extras) {
            // Don't load non-visual objects into scene
            if (gNode.extras.poi) return undefined;
            if (gNode.extras.colider) return undefined;
            if (gNode.extras.navmesh) return undefined;
        }

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
            this.loadMeshToNode(node, gNode.mesh);
        }

        // light
        const lightId = gNode.extensions?.KHR_lights_punctual?.light;
        if (typeof lightId === "number") {
            node.addComponent(
                new LightComponent(
                    this.getLight(lightId),
                    this.json.extensions?.KHR_lights_punctual?.lights[lightId]
                        ?.name ?? `Light${lightId}`,
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

    public sceneAsNode(index = 0): SceneNode {
        const scene = nn(this.json.scenes?.[index], "Scene idx OOB");
        const node = new SceneNode();
        node.name = scene.name ?? `${this.name}.scenes.${index}`;

        scene.nodes?.forEach((c) => {
            const newNode = this.nodeConvert(c);
            if (newNode) node.addChild(newNode);
        });

        return node;
    }

    public getLight(id: number): THondaLight {
        const gLight = nn(
            this.json.extensions?.KHR_lights_punctual?.lights[id],
            "Light ID OOB",
        );

        const color = gLight.color ?? [1, 1, 1],
            intensity = gLight.intensity ?? 1,
            maxRange = gLight.range ?? 100000,
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
                } satisfies IDirectionalLight;

            default:
                throw new Error(`Unknown light type ${gLight.type}`);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    protected tryToPoi(node: TG.TNode): POI | undefined {
        if (
            !node.translation ||
            !node.name ||
            !node.extras ||
            !node.extras.poi
        ) {
            return undefined;
        }

        return {
            name: node.name,
            position: node.translation,
            props: node.extras,
        };
    }

    public getPOIByName(name: string): POI | undefined {
        const potentialPoiNode = this.json.nodes?.find((x) => x.name === name);
        return potentialPoiNode && this.tryToPoi(potentialPoiNode);
    }

    public getAllPOIs(): POI[] {
        return (
            this.json.nodes
                ?.filter((x) => !!x.extras?.poi)
                .map((x) => this.tryToPoi(x))
                .filter<POI>((x) => !!x) ?? []
        );
    }

    // eslint-disable-next-line class-methods-use-this
    protected convertNavmesh(
        idxAcc: HondaAccesor<Uint16Array, "SCALAR">,
        posAcc: HondaAccesor<Float32Array, "VEC3">,
    ): [number, number][][] {
        const idx = idxAcc.accessor,
            pos = posAcc.accessor;

        const polygons = [] as [number, number][][];

        for (let i = 0; i + 2 < idx.length; i += 3) {
            const ia = idx[i],
                ib = idx[i + 1],
                ic = idx[i + 2];

            polygons.push([
                [pos[3 * ia + 0], pos[3 * ia + 2]],
                [pos[3 * ib + 0], pos[3 * ib + 2]],
                [pos[3 * ic + 0], pos[3 * ic + 2]],
            ]);
        }

        return polygons;
    }

    public getNavmesh(scene: number = 0) {
        const navMesh = nn(
            this.json.meshes?.[
                this.json.scenes?.[0]?.nodes
                    ?.map((x) => this.json?.nodes?.[x])
                    .filter((x) => x)
                    .find((x) => x?.extras?.navmesh)?.mesh ?? -1
            ],
            `No navmesh nodes for scene ${scene}`,
        );

        assert(
            navMesh.primitives.length === 1,
            "MULTIPLE PRIMITIVES IN NAVMESH!",
        );
        const prim = navMesh.primitives[0];

        const idxAccessor = this.getAccessorAndAssertType(
                nn(prim.indices, "namvesh indices missing"),
                "SCALAR",
                Uint16Array,
            ),
            posAccessor = this.getAccessorAndAssertType(
                nn(prim.attributes.POSITION, "namvesh indices missing"),
                "VEC3",
                Float32Array,
            );

        return this.convertNavmesh(idxAccessor, posAccessor);
    }

    public convertAnimationSampler(gas: TG.IAnimationSampler): ASampler {
        if (gas.interpolation && !(gas.interpolation in AnimInterp)) {
            throw new Error(`Unknown Interpolation type ${gas.interpolation}`);
        }

        const interp = (gas.interpolation ?? AnimInterp.LINEAR) as AnimInterp;

        const inAcc = this.getAccessorAndAssertType(
            gas.input,
            "SCALAR",
            Float32Array,
        );
        const outAcc = this.getAccessor(gas.output);

        if (!(outAcc.accessor instanceof Float32Array)) {
            throw new Error("Refusing to sample non-float accessor");
        }

        switch (outAcc.type) {
            case "SCALAR":
                return new SSampler(
                    interp,
                    inAcc,
                    outAcc as HondaAccesor<Float32Array, "SCALAR">,
                );
            case "VEC3":
                return new V3Sampler(
                    interp,
                    inAcc,
                    outAcc as HondaAccesor<Float32Array, "VEC3">,
                );
            case "VEC4":
                return new V4Sampler(
                    interp,
                    inAcc,
                    outAcc as HondaAccesor<Float32Array, "VEC4">,
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
            this.json.animations[index],
            "Animation not found",
        );

        return new HAnimation(
            gAnimation.samplers.map((x) => this.convertAnimationSampler(x)),
            gAnimation.channels,
            this.id,
            gAnimation.name ?? `${this.name}>anim>${index}`,
        );
    }

    /**
     * Converts an animation.
     * The animation is a no-op by default
     * call .attach() first
     */
    public getAnimationByName(name: string): HAnimation {
        const index = this.json.animations.findIndex((x) => x.name === name);
        return this.getAnimation(index);
    }
}
