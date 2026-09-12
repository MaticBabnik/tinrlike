import type { AssetService } from "./honda";
import { GltfBinary, GltfLoader } from "./honda/util/gltf";

const GLB_FILES = Object.keys(
    import.meta.glob("./3d/*.glb", {
        eager: false,
        query: "url",
        base: "../public/",
    }),
);

export async function importGltf(assetSrv: AssetService) {
    await Promise.all(
        GLB_FILES.map(async (path) => {
            const key = path.replace("./3d/", "").replace(".glb", "");

            const file = await GltfBinary.fromUrl(path);

            assetSrv.registerAsset(key, new GltfLoader(file));
        }),
    );
}
