import z from "zod";
import { HStorage } from "./honda/storage";


export const GameStorage = new HStorage({
    settings: z.object({
        version: z.literal(2),
        anisotropy: z.union([z.literal(1), z.literal(4)]),
        multisample: z.union([z.literal(1), z.literal(4)]),
        renderScale: z.number(),
        shadowMapSize: z.number(),
        debugRenderers: z.boolean(),
    })
});