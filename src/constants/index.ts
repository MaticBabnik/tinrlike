import { CUSTOM_LAYER_OFFSET } from "@/honda";

// Physics layers
export const TL_LAYER_PLAYER = 1 << (CUSTOM_LAYER_OFFSET + 0);
export const TL_LAYER_ENEMY = 1 << (CUSTOM_LAYER_OFFSET + 1);
export const TL_LAYER_ENEMY_PROJECTILE = 1 << (CUSTOM_LAYER_OFFSET + 2);
export const TL_LAYER_PLAYER_PROJECTILE = 1 << (CUSTOM_LAYER_OFFSET + 3);
