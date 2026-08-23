import type { IService } from "../core/ecs";
import { hsym } from "../core/sym";
import { nn } from "../util";
import type { GltfLoader } from "@/honda/util/gltf";

export class AssetService implements IService {
    public readonly name = "AssetService";

    private _assets: Map<string, GltfLoader> = new Map();

    public registerAsset(name: string, asset: GltfLoader) {
        this._assets.set(name, asset);
    }

    public maybeGetAsset(name: string): GltfLoader | undefined {
        return this._assets.get(name);
    }

    public getAsset(name: string): GltfLoader {
        return nn(this._assets.get(name), `Asset not found: ${name}`);
    }
}

export const AssetSrv = hsym<AssetService>("asset");
