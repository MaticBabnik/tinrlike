/**
 * The main physics layer. Being a member of this layer means the object will
 * receive/apply physics interactions.
 *
 * Listening to this layer will notify about all **physics** interactions.
 */
export const FIZ_LAYER_PHYS = 1 << 0;

/**
 * Generic trigger layer. Being a member of this layer means the
 * object will notify listeners.
 */
export const FIZ_LAYER_TRIGGER = 1 << 1;

/**
 * Custom layers start from here. \
 * First user layer is `1 << (CUSTOM_LAYER_OFFSET)`
 */
export const CUSTOM_LAYER_OFFSET = 2;
