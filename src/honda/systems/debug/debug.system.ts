import { System } from "@/honda/core/ecs";

export class DebugSystem extends System {
    public componentType = class {
        public name = "nop";
    };

    public $instColorBuffer: Float32Array;
    public $vertPositionBuffer: Float32Array;
    public $lineCount: number = 0;

    constructor(public readonly maxLines: number = 1000) {
        super();

        this.$vertPositionBuffer = new Float32Array(maxLines * 2 * 4);
        this.$instColorBuffer = new Float32Array(maxLines * 4);
    }

    public earlyUpdate(): void {
        this.$lineCount = 0;
    }

    public line(
        a: ArrayLike<number>,
        b: ArrayLike<number>,
        color: ArrayLike<number>,
    ): void {
        if (this.$lineCount >= this.maxLines) return;

        const vertOffset = this.$lineCount * 2 * 4;

        this.$vertPositionBuffer[vertOffset + 0] = a[0];
        this.$vertPositionBuffer[vertOffset + 1] = a[1];
        this.$vertPositionBuffer[vertOffset + 2] = a[2];

        this.$vertPositionBuffer[vertOffset + 4] = b[0];
        this.$vertPositionBuffer[vertOffset + 5] = b[1];
        this.$vertPositionBuffer[vertOffset + 6] = b[2];

        const instOffset = this.$lineCount * 4;
        this.$instColorBuffer[instOffset + 0] = color[0];
        this.$instColorBuffer[instOffset + 1] = color[1];
        this.$instColorBuffer[instOffset + 2] = color[2];

        this.$lineCount++;
    }

    public circle2d(
        position: ArrayLike<number>,
        radius: number,
        color: ArrayLike<number>,
    ) {
        const height = 0;
        const v1 = [0, height, 0];
        const v2 = [0, height, 0];
        const CSEG = 12;

        for (let i = 0; i < CSEG; i++) {
            const angle1 = (i / CSEG) * Math.PI * 2;
            const angle2 = ((i + 1) / CSEG) * Math.PI * 2;

            v1[0] = position[0] + Math.cos(angle1) * radius;
            v1[2] = position[1] + Math.sin(angle1) * radius;

            v2[0] = position[0] + Math.cos(angle2) * radius;
            v2[2] = position[1] + Math.sin(angle2) * radius;
            this.line(v1, v2, color);
        }
    }

    public rectangle2d(
        position: ArrayLike<number>,
        hax: number,
        hay: number,
        color: ArrayLike<number>,
    ) {
        const height = 0;
        const v1 = [0, height, 0];
        const v2 = [0, height, 0];

        v1[0] = position[0] - hax;
        v1[2] = position[1] - hay;
        v2[0] = position[0] + hax;
        v2[2] = position[1] - hay;
        this.line(v1, v2, color);

        v1[0] = position[0] + hax;
        v1[2] = position[1] - hay;
        v2[0] = position[0] + hax;
        v2[2] = position[1] + hay;
        this.line(v1, v2, color);

        v1[0] = position[0] + hax;
        v1[2] = position[1] + hay;
        v2[0] = position[0] - hax;
        v2[2] = position[1] + hay;
        this.line(v1, v2, color);

        v1[0] = position[0] - hax;
        v1[2] = position[1] + hay;
        v2[0] = position[0] - hax;
        v2[2] = position[1] - hay;
        this.line(v1, v2, color);
    }
}
