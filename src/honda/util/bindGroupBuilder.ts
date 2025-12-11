import { assert } from ".";

type __BGLTypeMap = {
    buffer: GPUBufferBindingLayout;
    sampler: GPUSamplerBindingLayout;
    texture: GPUTextureBindingLayout;
    storageTexture: GPUStorageTextureBindingLayout;
    externalTexture: GPUExternalTextureBindingLayout;
};

interface __IBGLBuilderPrivate extends IBGLBuilder {
    groups: Record<number, GPUBindGroupLayoutEntry>;
}

/**
 * If you need more... you don't.
 */
type BindingIndex =
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15;

/**
 * Used to remove U from T (works atleast when T is union type)
 */
type Remove<T, U> = T extends U ? never : T;

/**
 * BindGroupLayout Builder
 */
export interface IBGLBuilder<
    Name extends string = string,
    Available = BindingIndex,
> {
    /**
     * The name/label of the bind group layout
     */
    readonly name: Name;

    /**
     * Adds a binding to the layout; Returns a new builder.
     * @param id @binding() slot
     * @param visibility Shader stage visibility; (c)ompute, (v)ertex, (f)ragment
     * @param type Binding type
     * @param options More options for the binding
     */
    binding<T extends keyof __BGLTypeMap, TBinding extends Available>(
        id: TBinding,
        visibility: "c" | "v" | "f" | "vf" | "cf" | "cv" | "cvf",
        type: T,
        ...options: __BGLTypeMap[T] extends GPUStorageTextureBindingLayout
            ? [GPUStorageTextureBindingLayout]
            : [] | [__BGLTypeMap[T]]
    ): IBGLBuilder<Name, Remove<Available, TBinding>>;

    /**
     * Creates the layout.
     * @param device WebGPU device
     */
    create(device: GPUDevice): GPUBindGroupLayout;
}

/**
 * BindGroupLayout Builder
 * @param name The name (label) of the bind group layout
 * @param extend A builder to extend (inherit all bindings)
 * @returns the builder
 */
export function bindGroupLayout<Name extends string, T extends IBGLBuilder>(
    name: Name,
    extend?: T,
): IBGLBuilder<
    Name,
    T extends IBGLBuilder<string, infer TAvl> ? TAvl : BindingIndex
> {
    const bg = {
        name,
        groups: (extend as __IBGLBuilderPrivate | undefined)?.groups ?? {},
        binding(id, visStr, type, options) {
            assert(
                !(id in this.groups),
                `Binding ${id} already exists on ${this.name}`,
            );

            const visibility = visStr.split("").reduce(
                (p, c) =>
                    p |
                    ({
                        c: GPUShaderStage.COMPUTE,
                        v: GPUShaderStage.VERTEX,
                        f: GPUShaderStage.FRAGMENT,
                    }[c] ?? 0),
                0,
            );

            return {
                ...this,
                groups: {
                    ...this.groups,
                    [id]: {
                        binding: id,
                        visibility,
                        [type]: options ?? {},
                    },
                },
            };
        },
        create(device) {
            return device.createBindGroupLayout({
                label: name,
                entries: Object.values(this.groups),
            });
        },
    } as __IBGLBuilderPrivate;

    return bg as unknown as IBGLBuilder<Name>;
}

/**
 * @param device WebGPU device
 * @param specs An 'as const' array of IBGLBuilder-s
 * @returns A record of the bind group layouts indexed by their names.
 */
export function createBindGroupLayoutsFromArray<
    T extends readonly IBGLBuilder[],
>(device: GPUDevice, specs: T) {
    return Object.fromEntries(specs.map((x) => [x.name, x.create(device)])) as {
        [K in T[number] as K["name"]]: GPUBindGroupLayout;
    };
}
