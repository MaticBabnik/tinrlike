import { Game } from "../state";
import type { IComponent } from "./ecs";
import { Transform } from "./transform";
import { nn } from "../util";

export class SceneNode {
    public name: string = "<unnammed>";
    public transform = new Transform();
    public children = new Set<SceneNode>();
    public parent?: SceneNode = undefined;
    public dynamic = true;
    public components: IComponent[] = [];

    public meta: Record<string, unknown> = {};

    protected _pendAttach = false;

    protected isNodeInScene(): boolean {
        const scene = Game.sceneManager.scene;
        if ((this as SceneNode) === scene) return true;
        if (this.parent === scene) return true;

        return this.parent?.isNodeInScene() ?? false;
    }

    public addChild(c: SceneNode) {
        if (c.parent) {
            console.warn(
                "replacing parent of",
                c,
                "from",
                c.parent,
                "to",
                this,
            );
            c.parent.removeChild(c);
        }

        // console.log(this, "adding child", c);

        this.children.add(c);
        c.parent = this;
        if (this.isNodeInScene()) c.attachComponents();
    }

    public removeChild(c: SceneNode) {
        // console.log(this, "removing child", c);

        if (this.children.delete(c)) {
            c.detachComponents();
            c.parent = undefined;
        } else {
            // the show must go on
            console.warn("attempt to remove non-child", c, "from", this);
        }
        return c;
    }

    public addComponent<T extends IComponent>(c: T) {
        // console.log(this, "adding component", c);

        if (this.isNodeInScene()) {
            // console.log("registering component immediately");
            Game.ecs.registerComponent(this, c);
        } else {
            // console.log("deferring component registration");
            this._pendAttach = true;
        }

        this.components.push(c);
    }

    public removeComponent<T extends IComponent>(c: T) {
        // console.log(this, "removing component", c);
        Game.ecs.destroyComponent(this, c);
        this.components = this.components.filter((x) => x !== c);
        if (this.components.length === 0) this._pendAttach = false;
    }

    protected attachComponents() {
        // console.log(this, "attachComponents()");
        this.children.forEach((x) => {
            x.attachComponents();
        });

        if (!this._pendAttach) return;
        // console.log("registering deferred components");
        this.components.forEach((x) => {
            Game.ecs.registerComponent(this, x);
        });
        this._pendAttach = false;
    }

    protected detachComponents() {
        // console.log(this, "detachComponents()");
        this.children.forEach((x) => {
            x.detachComponents();
        });
        this.components.forEach((x) => {
            Game.ecs.destroyComponent(this, x);
        });
        this._pendAttach = true;
    }

    // Destroys self and all remaining children
    public destroy() {
        // help out GC by removing all possible references
        this.parent?.removeChild(this);
        this.children.forEach((x) => {
            x.destroy();
        });
        this.children.clear();
        this.components.forEach((x) => {
            x.destroy?.();
        });
        this.components.length = 0;
    }

    public tree(l = 0): string {
        return [
            `${" ┃".repeat(Math.max(l - 1, 0))}${l ? " ┣" : ""} N:${this.name}`,
            ...this.components.map((x) => `${" ┃".repeat(l)} ┠${x.name}`),
            ...(this.components.length && this.children.size
                ? [" ┃".repeat(l + 1)]
                : []),
            ...this.children.values().map((x) => x.tree(l + 1)),
            " ┃".repeat(l),
        ].join("\n");
    }

    public assertComponent<T extends IComponent>(
        ctor: new (...args: never) => T,
    ): T {
        return nn(
            this.components.find((x) => x instanceof ctor),
            "component isn't",
        ) as T;
    }

    public assertChildComponent<T extends IComponent>(
        ctor: new (...args: never) => T,
        maxDepth = 127,
    ): T {
        return nn(
            this.findChild(
                (x) => x.components.values().some((y) => y instanceof ctor),
                maxDepth,
            )?.components.find((y) => y instanceof ctor),
            "child isn't",
        ) as T;
    }

    public assertChildWithName(name: string, maxDepth = 127) {
        return nn(
            this.findChild((x) => x.name === name, maxDepth),
            "child isn't",
        );
    }

    /**
     * Uoooh 😭💢
     * btw this is breath first first, depth first second
     */
    public findChild(
        cond: (child: SceneNode) => boolean,
        maxDepth = 127,
    ): SceneNode | undefined {
        const direct = this.children.values().find(cond);
        if (direct) return direct;

        if (maxDepth <= 1) return undefined;

        for (const child of this.children) {
            const f = child.findChild(cond, maxDepth - 1);
            if (f) return f;
        }
        return undefined;
    }
}
