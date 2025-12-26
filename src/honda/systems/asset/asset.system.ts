import { System } from "@/honda/core/ecs";
import { nn } from "@/honda/util";
import type { GltfLoader } from "@/honda/util/gltf";

export class AssetSystem extends System {
    public componentType = class {
        constructor(public name: string) {}
    };

    private _assets: Map<string, GltfLoader> = new Map();

    public registerAsset(name: string, asset: GltfLoader) {
        this._assets.set(name, asset);
    }

    public maybeGetAsset(name: string): GltfLoader | undefined {
        return this._assets.get(name);
    }

    public getAsset(name: string): GltfLoader {
        return nn(this._assets.get(name));
    }
}
