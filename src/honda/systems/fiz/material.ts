export class FizMaterial {
    constructor(
        /**
         * How bouncy the material is (0 = no bounce, 1 = perfect bounce)
         * (gets averaged between two colliding materials)
         */
        public readonly bounciness: number,
        public readonly drag: number,
    ) {}

    static restitution(m1: FizMaterial, m2: FizMaterial): number {
        return Math.min(Math.max(0, (m1.bounciness + m2.bounciness) / 2), 1);
    }
}

export const FIZ_DEFAULT_MATERIAL = new FizMaterial(0.1, 0.1);
