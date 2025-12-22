import { assert, nn } from "../..";
import type { IGltfFile } from "..";
import type * as TG from "../gltf.types";
import type { ABView, GltfAccessor, GltfBufView } from "../types";
import { CTYPE_TO_CTOR, SCALARS_PER_ELEMENT } from "../constants";
import { GltfFileBase } from "./gltfFileBase";

export class GltfBinary extends GltfFileBase implements IGltfFile {
    private static readonly MAGIC = 0x46546c67;
    private static readonly CHUNKYTPE_JSON = 0x4e4f534a;
    private static readonly CHUNKTYPE_BIN = 0x004e4942;
    private static readonly textDecoder = new TextDecoder();

    public bin: ABView;
    public json: TG.IGltfRoot;
    public imageCache: ImageBitmap[] = [];

    protected constructor(buf: ArrayBuffer, name?: string) {
        super(name);
        const bufU32 = new Uint32Array(buf);

        if (bufU32[0] !== GltfBinary.MAGIC) {
            throw new Error("Invalid magic, this isn't glTF");
        }

        if (bufU32[1] !== 2) {
            throw new Error("Only version 2 is supported");
        }

        // find chunks
        let jsonView: ABView | undefined, binView: ABView | undefined;

        for (let i = 3; i < bufU32.length; ) {
            const chunkLength = bufU32[i];
            const chunkType = bufU32[i + 1];

            const view = new DataView(buf, (i + 2) * 4, chunkLength);

            if (chunkType === GltfBinary.CHUNKYTPE_JSON) jsonView = view;
            else if (chunkType === GltfBinary.CHUNKTYPE_BIN) binView = view;

            i += Math.ceil(chunkLength / 4) + 2;
        }

        // decode json string
        const jsonText = GltfBinary.textDecoder.decode(
            nn(jsonView, "Missing JSON chunk"),
        );

        this.json = JSON.parse(jsonText);
        this.bin = nn(binView, "Missing Binary chunk");
    }

    protected async prepareImages(): Promise<void> {
        this.imageCache = await Promise.all(
            (this.json.images ?? []).map((imgDef) => {
                const ibv = this.getBufferView(imgDef.bufferView);
                const data = new Uint8Array(
                    ibv.buffer,
                    ibv.byteOffset,
                    ibv.byteLength,
                );
                const blob = new Blob([data], { type: imgDef.mimeType });

                return createImageBitmap(blob);
            }),
        );
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

    public getBuffer(index: number): ABView {
        if (index !== 0) throw new Error(`Invalid buffer index (glb)`);

        const gBuffer = nn(this.json.buffers?.[index]);

        assert(
            gBuffer.byteLength === this.bin.byteLength,
            "Buffer size mismatch",
        );

        return {
            buffer: this.bin.buffer,
            byteOffset: this.bin.byteOffset,
            byteLength: this.bin.byteLength,
        };
    }

    public getBufferView(index: number): GltfBufView {
        const gBufferView = nn(
            this.json.bufferViews?.[index],
            "bufferView OOB",
        );

        const buf = this.getBuffer(gBufferView.buffer);

        return {
            buffer: buf.buffer,
            byteOffset: buf.byteOffset + (gBufferView.byteOffset ?? 0),
            byteLength: gBufferView.byteLength,
        };
    }

    public getAccessor(index: number): GltfAccessor {
        const gAccessor = nn(this.json.accessors?.[index], "accessor OOB");
        if (
            gAccessor.normalized ||
            gAccessor.sparse ||
            typeof gAccessor.bufferView !== "number"
        ) {
            throw new Error("Unsupported");
        }

        const TypedArrayCtor = CTYPE_TO_CTOR[gAccessor.componentType];
        const bv = this.getBufferView(gAccessor.bufferView);

        const accessor = new TypedArrayCtor(
            bv.buffer,
            bv.byteOffset + (gAccessor.byteOffset ?? 0),
            gAccessor.count * SCALARS_PER_ELEMENT[gAccessor.type],
        );

        return {
            accessor,
            normalized: gAccessor.normalized ?? false,
            type: gAccessor.type,
            count: gAccessor.count,
        };
    }

    public getImageBitmap(index: number): ImageBitmap {
        return nn(this.imageCache[index], "Image index OOB");
    }
}
