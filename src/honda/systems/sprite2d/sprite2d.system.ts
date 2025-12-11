import { System } from "@/honda/core/ecs";
import type { AtlasSpec } from "./atlas.interface";
import { assert } from "@/honda/util";

type Sprite = {
    atlas: string;
    sid: number;
    x: number;
    y: number;
    scale: number;
    rotate: number;
    z: number;
    multiplyRed: number;
    multiplyGreen: number;
    multiplyBlue: number;
    multiplyAlpha: number;
};

export class Sprite2dSystem extends System {
    public componentType = class {
        public name = "nop";
    };

    public $atlases: Map<string, AtlasSpec> = new Map();
    public $sprites: Sprite[] = [];

    public getBatch(): Sprite[] {
        const sprites = this.$sprites;
        this.$sprites = [];

        return sprites.sort((a, b) => a.z - b.z);
    }

    public registerAtlas(
        name: string,
        texture: GPUTexture,
        spriteSize: number,
    ) {
        assert(
            !this.$atlases.has(name),
            `Atlas with name ${name} already registered`,
        );
        assert(
            texture.width % spriteSize === 0 &&
                texture.height % spriteSize === 0,
            `Texture dimensions must be multiples of spriteSize`,
        );

        const atlas = {
            name,
            texture,
            spriteSize,
            columns: texture.width / spriteSize,
            rows: texture.height / spriteSize,
        };

        console.log(
            `Registered atlas ${name}: ${atlas.columns}x${atlas.rows} sprites`,
            atlas,
        );

        this.$atlases.set(name, atlas);
    }

    public sprite(
        atlas: string,
        sid: number,

        x: number,
        y: number,

        scale: number = 1,

        rotate: number = 0,
        z: number = 0,

        multiplyRed = 1,
        multiplyGreen = 1,
        multiplyBlue = 1,
        multiplyAlpha = 1,
    ): void {
        assert(
            this.$atlases.has(atlas),
            `Atlas with name ${atlas} not registered`,
        );

        this.$sprites.push({
            atlas,
            sid,
            x,
            y,
            scale,
            rotate,
            z,
            multiplyRed,
            multiplyGreen,
            multiplyBlue,
            multiplyAlpha,
        });
    }
}
