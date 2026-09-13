import type { IGPUResourceLayer } from "./interface";
import { GPUBufUsage } from "./interface";
import { MeshIndexType, MeshV2 } from "./mesh";

export interface SphereOpts {
    radius?: number;
    /** vertical subdivisions (pole to pole) */
    rings?: number;
    /** horizontal subdivisions (around Y) */
    segments?: number;
    label?: string;
}

function createBuf(
    gpu: IGPUResourceLayer,
    data: Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>,
    usage: GPUBufUsage,
    label: string,
) {
    const buf = gpu.createBuffer({
        size: data.byteLength,
        usage: usage | GPUBufUsage.CopyDestination,
        label,
    });
    buf.upload(data, 0, data.length);
    return buf;
}

/**
 * UV sphere centered on the origin, Y up, CCW outward facing triangles.
 */
export function createSphereMesh(gpu: IGPUResourceLayer, opts: SphereOpts = {}): MeshV2 {
    const radius = opts.radius ?? 1;
    const rings = Math.max(2, opts.rings ?? 16);
    const segments = Math.max(3, opts.segments ?? 32);
    const label = opts.label ?? "sphere";

    // seam vertices are duplicated so the uvs wrap cleanly
    const nVerts = (rings + 1) * (segments + 1);
    const position = new Float32Array(nVerts * 3);
    const normal = new Float32Array(nVerts * 3);
    const texCoord = new Float32Array(nVerts * 2);

    for (let r = 0, v = 0; r <= rings; r++) {
        const theta = (r / rings) * Math.PI;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);

        for (let s = 0; s <= segments; s++, v++) {
            const phi = (s / segments) * 2 * Math.PI;

            const nx = sinT * Math.cos(phi);
            const ny = cosT;
            const nz = sinT * Math.sin(phi);

            normal.set([nx, ny, nz], v * 3);
            position.set([nx * radius, ny * radius, nz * radius], v * 3);
            texCoord.set([s / segments, r / rings], v * 2);
        }
    }

    // the pole rows would each produce a degenerate triangle per quad, skip those
    const index = new Uint32Array((rings - 1) * segments * 6);
    let i = 0;

    for (let r = 0; r < rings; r++) {
        for (let s = 0; s < segments; s++) {
            const a = r * (segments + 1) + s; // this ring
            const b = a + segments + 1; // next ring (further from the top)
            const c = a + 1;
            const d = b + 1;

            if (r !== 0) {
                index.set([a, c, b], i);
                i += 3;
            }

            if (r !== rings - 1) {
                index.set([b, c, d], i);
                i += 3;
            }
        }
    }

    return new MeshV2(
        createBuf(gpu, position, GPUBufUsage.Vertex, `${label}:position`),
        createBuf(gpu, normal, GPUBufUsage.Vertex, `${label}:normal`),
        createBuf(gpu, texCoord, GPUBufUsage.Vertex, `${label}:uv`),
        undefined,
        undefined,
        undefined,
        createBuf(gpu, index, GPUBufUsage.Index, `${label}:index`),
        MeshIndexType.U32,
        index.length,
        [radius, radius, radius],
    );
}
