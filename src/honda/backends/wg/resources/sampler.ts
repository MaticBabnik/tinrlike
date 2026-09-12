type MostlyReadonlyDescriptor = Readonly<
    Omit<GPUSamplerDescriptor, "maxAnisotropy">
> &
    Pick<GPUSamplerDescriptor, "maxAnisotropy">;

/**
 * Not really a resource, just a way to cache samplers and to
 * be able to change anisotropy on the fly
 */
export class WGSampler {
    public readonly supportsAnisotropy: boolean;

    constructor(
        public sampler: GPUSampler,
        public $descriptor: MostlyReadonlyDescriptor,
        public version: number,
    ) {
        this.supportsAnisotropy =
            $descriptor.minFilter === "linear" &&
            $descriptor.magFilter === "linear" &&
            $descriptor.mipmapFilter === "linear";
    }
}
