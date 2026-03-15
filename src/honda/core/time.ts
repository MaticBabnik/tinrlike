export const enum TimeType {
    /**
     * We are inside an interpolated frame update.
     */
    Frame,

    /**
     * We are inside a fixed update.
     */
    FixedFuture,

    /**
     * We are not in a time context. Should not really be experienced by game code.
     */
    Invalid,
}

/**
 * Core time management. Handles game time, provides deltas and makes pacing/simulation decisions.
 */
export class Chronos {
    /**
     * Timescale for the game. 1 is normal speed, 0.5 is half speed, etc.
     */
    public $timescale: number = 1;

    /**
     * Fixed update rate in seconds. Default is 1/60 for 60 updates per second.
     */
    public $fixedRate: number = 1 / 60;

    /**
     * Time of the last fixed update. Used to determine when the next fixed update should occur.
     */
    public $lastFixedUpdateTime: number = 0;

    /**
     * Fixed step start time.
     */
    public $fss: number = 0;

    /**
     * Fixed step end time.
     */
    public $fse: number = 0;

    protected _timeType: TimeType = TimeType.Invalid;

    /**
     * Gets the delta time for the current context.
     * In frame update, this is the time since the last frame.
     * In fixed update, this is the fixed update rate.
     */
    public get deltaTime() {
        return 0;
    }

    /**
     * Resets the time to 0. Can be called on scene enter if 0-based time is desired.
     */
    public $zero() {}

    /**
     * Gets the current game time. This is the total time experienced by the curent context (frame/fixed).
     */
    public get time() {
        return 0;
    }

    /**
     * Begins a new frame. Should be called at the start of each frame update.
     */
    public $beginFrame() {
        this._timeType = TimeType.Frame;
    }

    /**
     * Begins a fixed update. Should be called at the start of each fixed update.
     */
    public $beginFixed() {
        this._timeType = TimeType.Frame;
    }

    /**
     * Determines if a fixed update is required based on the elapsed time since the last fixed update.
     */
    public $isFixedUpdateRequired() {
        if (this.time - this.$lastFixedUpdateTime >= this.$fixedRate) {
            this.$lastFixedUpdateTime += this.$fixedRate;
            return true;
        }
    }
}
