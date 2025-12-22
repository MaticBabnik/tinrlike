export abstract class GltfFileBase {
    private static gltfid = 0;
    public readonly id = GltfFileBase.gltfid++;

    constructor(public readonly name = `<unknown glTF ${this.id}>`) {}
}
