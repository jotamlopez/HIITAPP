/**
 * Manages workout timer state and progression
 */
export class TimerManager {
    constructor() {
        this.timeLeft = 0;
        this.state = 'work'; // 'work' | 'rest'
        this.timerState = 'stopped'; // 'stopped' | 'running' | 'paused'
        this.timer = null;
        this.currentExerciseIndex = 0;
        this.currentSetIndex = 1;
        this.currentRepeatIndex = 1;
        this.currentCircuitRound = 1;
        this.currentCircuitExerciseIndex = 0;
        this.isInCircuit = false;
        this.isGlobalPaused = false;
        this.previousTimerStateBeforePause = null;
    }

    /**
     * Sanitizes duration value
     * @param {*} value - Value to sanitize
     * @param {number} defaultValue - Default value if invalid
     * @returns {number} Sanitized duration
     */
    static sanitizeDuration(value, defaultValue = 0) {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed < 0) return defaultValue;
        return parsed;
    }

    /**
     * Resets the timer to initial state
     */
    resetTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.timerState = 'stopped';
        this.timeLeft = 0;
        this.state = 'work';
        this.currentExerciseIndex = 0;
        this.currentSetIndex = 1;
        this.currentRepeatIndex = 1;
        this.isInCircuit = false;
        this.currentCircuitRound = 1;
        this.currentCircuitExerciseIndex = 0;
        this.isGlobalPaused = false;
        this.previousTimerStateBeforePause = null;
    }

    /**
     * Clears the timer interval
     */
    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Sets timer interval with callback
     * @param {Function} callback - Function to call every second
     */
    setTimerInterval(callback) {
        this.clearTimer();
        this.timer = setInterval(callback, 1000);
    }

    /**
     * Start a preparation countdown before beginning an exercise.
     * @param {number} seconds - Duration of preparation countdown.
     * @param {Object} deps - Dependencies callbacks.
     * @param {function(number):void} deps.onTick - Called each second with remaining seconds.
     * @param {function():void} deps.onFinish - Called when countdown finishes.
     * @param {function(number):void} deps.playBeep - Called each second with step index (for tone).
     */
    startPreparationCountdown(seconds = 5, deps = {}) {
        const total = Math.max(1, parseInt(seconds, 10) || 5);
        let remaining = total;
        if (typeof deps.onTick === 'function') deps.onTick(remaining);
        if (typeof deps.playBeep === 'function') deps.playBeep(total - remaining);
        this.clearTimer();
        this.timerState = 'running';
        this.timer = setInterval(() => {
            remaining -= 1;
            if (remaining > 0) {
                if (typeof deps.onTick === 'function') deps.onTick(remaining);
                if (typeof deps.playBeep === 'function') deps.playBeep(total - remaining);
            } else {
                this.clearTimer();
                this.timerState = 'stopped';
                if (typeof deps.onFinish === 'function') deps.onFinish();
            }
        }, 1000);
    }
}
