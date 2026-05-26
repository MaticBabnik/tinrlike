import { nn } from "@/honda/util";
import type { IComponent } from "./component";
import type { System } from "./system";
import type { HSym } from "../sym";
import type { SceneNode } from "./node";
import type { IService } from "./service";

export class ECS {
    private _nsys: Map<symbol, System> = new Map();
    private _nsrv: Map<symbol, IService> = new Map();

    public registerSystem<T>(key: HSym<T>, system: T & System) {
        this._nsys.set(key, system);
    }

    public registerService<T>(key: HSym<T>, service: T & IService) {
        this._nsrv.set(key, service);
    }

    public $registerComponent(node: SceneNode, component: IComponent) {
        for (const sys of this._nsys.values()) {
            if (component instanceof sys.componentType) {
                // console.log("Registering component", component, "with system", sys);
                sys.componentCreated(node, component);
                return;
            }
        }
        console.warn("Component wasnt matched by any systems: ", component);
    }

    public $destroyComponent(node: SceneNode, component: IComponent) {
        for (const sys of this._nsys.values()) {
            if (component instanceof sys.componentType) {
                // console.log("Destroying component", component, "from system", sys);
                sys.componentDestroyed(node, component);
            }
        }
    }

    public earlyUpdate() {
        this._nsys.values().forEach((x) => {
            x.earlyUpdate();
        });
    }

    public update() {
        this._nsys.values().forEach((x) => {
            x.update();
        });
    }

    public lateUpdate() {
        this._nsys.values().forEach((x) => {
            x.lateUpdate();
        });
    }

    public getSys<T extends System>(key: HSym<T>): T {
        return nn(this._nsys.get(key) as T & System);
    }

    public getSrv<T extends IService>(key: HSym<T>): T {
        return nn(this._nsrv.get(key) as T & IService);
    }

    public getSystem<T extends System>(key: HSym<T>): T {
        return nn(this._nsys.get(key) as T);
    }

    public getService<T extends IService>(key: HSym<T>): T {
        return nn(this._nsrv.get(key) as T);
    }

    public maybeGetSystem<T>(key: HSym<T>): T | undefined {
        return this._nsys.get(key) as T | undefined;
    }

    public maybeGetService<T>(key: HSym<T>): T | undefined {
        return this._nsrv.get(key) as T | undefined;
    }

    public getSystemByKeyName(key: string): System {
        const sym = Symbol.for(key);
        return nn(this._nsys.get(sym));
    }

    public getServiceByKeyName(key: string): IService {
        const sym = Symbol.for(key);
        return nn(this._nsrv.get(sym));
    }

    public getSystemByCtor<T extends System>(
        sysctor: new (...args: never[]) => T,
    ): T {
        return nn(this._nsys.values().find((x) => x instanceof sysctor)) as T;
    }

    public maybeGetSystemByCtor<T extends System>(
        sysctor: new (...args: never[]) => T,
    ): T | undefined {
        return this._nsys.values().find((x) => x instanceof sysctor) as
            | T
            | undefined;
    }
}
