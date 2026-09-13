import { RefCntBase } from "../../util/refCountBase";
import type {
    TMaterialInit,
    TParamSet,
    TParamView,
    TTextureKeys,
} from "./params";
import type { AnyMatType, TOverridable, UntypedMatType } from "./materialType";
import type { RenderStateView } from "./renderState";
import { Game } from "@/honda/state";
import { isRefCountable } from "@/honda/util/managedResource";

/** what the backend gets when a material is destroyed */
export interface IMatHandle {
    readonly type: AnyMatType;
    readonly label: string;
    $backendData: unknown;
}

export type AnyMaterial = Material<AnyMatType>;

export class Material<
    T extends AnyMatType = UntypedMatType,
> extends RefCntBase {
    private readonly _params: T["__p"];

    public readonly params: TParamView<T["__p"]>;
    public readonly render: RenderStateView<TOverridable<T>>;

    /** opaque, backend owned; whatever it needs to find its data for us */
    public $backendData: unknown = null;
    public $alloced = false;
    public $uniformsDirty = true;
    public $texturesDirty = true;

    public constructor(
        public readonly type: T,
        init: TMaterialInit<T["__p"], T["__d"]>,
        public readonly label: string = type.name,
    ) {
        super(label);

        const params = { ...type.defaults, ...init } as TParamSet;

        for (const k in params) {
            const v = params[k];
            // never alias the type's defaults or the caller's arrays
            if (Array.isArray(v)) params[k] = v.slice() as typeof v;
            else if (isRefCountable(v)) v.rcUse();
        }

        this._params = params as T["__p"];
        this.params = params as TParamView<T["__p"]>;
        this.render = { ...type.render } as RenderStateView<TOverridable<T>>;
    }

    public push(): void {
        this.$uniformsDirty = true;
    }

    public setTexture<K extends TTextureKeys<T["__p"]>>(
        key: K,
        tex: T["__p"][K],
    ): void {
        const old = this._params[key];
        if (old === tex) return;

        // use before release, or a self swap would destroy the texture
        if (isRefCountable(tex)) tex.rcUse();
        if (isRefCountable(old)) old.rcRelease();

        this._params[key] = tex;
        this.$texturesDirty = true;
    }

    public clone(label: string = this.label): Material<T> {
        const copy = new Material(
            this.type,
            this._params as TMaterialInit<T["__p"], T["__d"]>,
            label,
        );
        Object.assign(copy.render, this.render);
        return copy;
    }

    public isType<T2 extends AnyMatType>(type: T2): this is Material<T2> {
        return (this.type as AnyMatType) === (type as AnyMatType);
    }

    public asType<T2 extends AnyMatType>(type: T2): Material<T2> {
        if (!this.isType(type)) {
            throw new Error(
                `Material '${this.label}' is not of type '${type.name}' (is '${this.type.name}')`,
            );
        }

        return this;
    }

    protected _rcDestroy(): void {
        for (const k in this._params) {
            const v = this._params[k];
            if (isRefCountable(v)) v.rcRelease();
        }

        if (this.$alloced) {
            Game.gpu.$freeMaterial(this);
        }
    }
}
