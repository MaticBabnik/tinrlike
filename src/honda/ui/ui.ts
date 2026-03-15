import {
    type App,
    type Component,
    type ComponentPublicInstance,
    createApp,
    type Ref,
} from "vue";
import TopLevel from "./TopLevel.vue";

/**
 * TopLevel.vue's exposed interface
 */
interface Expose {
    /**
     * Component constructor for the current view
     */
    currentViewComponent: Ref<Component | undefined>;

    /**
     * Sends a message to the currently mounted view component 
     */
    sendMessageToView(message: unknown): void;

    /**
     * Returns whether the child view component is mounted
     */
    isChildMounted(): boolean;

    /**
     * Queue of messages for the game logic
     */
    gameQueue: unknown[];
}

export class UIManager {
    private app: App<Element>;
    private expose: Expose;
    private instance: ComponentPublicInstance;
    
    /**
     * Queue of messages to send to the Vue components
     */
    private vueQueue: unknown[] = [];

    public constructor(private root: HTMLElement) {
        this.app = createApp(TopLevel);
        this.instance = this.app.mount(root);
        this.expose = this.instance.$.exposed! as Expose;
    }

    public setView(t: Component | undefined, stealPointer: boolean = true) {
        // Clear any queued messages (from both sides)

        if (this.expose.gameQueue) {
            this.expose.gameQueue.length = 0;
        }
        this.vueQueue.length = 0;


        // Set the new view
        this.expose.currentViewComponent.value = t;
        
        // Configure pointer events
        if (t && stealPointer) {
            this.root.classList.remove("no-pointer-events");
        } else {
            this.root.classList.add("no-pointer-events");
        }
    }

    public sendMessage(message: unknown) {
        if (
            this.instance.$.isMounted &&
            this.expose.isChildMounted() &&
            this.vueQueue.length > 0
        ) {
            // if everything is mounted, send directly
            this.expose.sendMessageToView(message);
        } else {
            // otherwise queue it
            this.vueQueue.push(message);
        }
    }

    public frame() {
        // flush queued messages when possible
        if (
            this.instance.$.isMounted &&
            this.expose.isChildMounted() &&
            this.vueQueue.length > 0
        ) {
            for (const msg of this.vueQueue) {
                this.expose.sendMessageToView(msg);
            }
            this.vueQueue.length = 0;
        }
    }

    public getMessage(): unknown | undefined {
        return this.expose.gameQueue.shift();
    }
}
