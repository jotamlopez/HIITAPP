/**
 * Controls UI updates and interactions
 */
export class UIController {
    constructor() {
        this.timerDisplay = document.getElementById('timerDisplay');
        this.expandedTimerPhase = document.getElementById('expandedTimerPhase');
        this.timerPhase = document.getElementById('timerPhase');
        this.currentExerciseTitle = document.getElementById('currentExerciseTitle');
        this.trainingPanel = document.getElementById('trainingPanel');
        this.startButton = document.getElementById('startButton');
        this.pauseButton = document.getElementById('pauseButton');
        this.completeSetButton = document.getElementById('completeSetButton');
    }

    /**
     * Updates the timer display
     * @param {number} timeLeft - Remaining time in seconds
     */
    updateTimerDisplay(timeLeft) {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        if (this.timerDisplay) {
            this.timerDisplay.textContent = `${m}:${s}`;
        }
    }

    /**
     * Sets manual timer display for sets-based exercises
     */
    setTimerDisplayManual() {
        if (this.timerDisplay) {
            this.timerDisplay.textContent = '--:--';
        }
        const expandedStatsRemaining = document.getElementById('expandedStatsRemaining');
        if (expandedStatsRemaining) {
            expandedStatsRemaining.textContent = '--:--';
        }
    }

    /**
     * Updates exercise information display
     * @param {Object} exerciseInfo - Exercise information object
     */
    updateExerciseInfo(exerciseInfo) {
        const {
            currentName = 'Sin ejercicio',
            currentPhase = 'Prepárate',
            nextName = '—',
            nextStatus = 'Añade ejercicios'
        } = exerciseInfo;

        const currentNameEl = document.getElementById('exerciseInfoCurrentName');
        const currentPhaseEl = document.getElementById('exerciseInfoCurrentPhase');
        const nextNameEl = document.getElementById('exerciseInfoNextName');
        const nextStatusEl = document.getElementById('exerciseInfoNextStatus');

        if (currentNameEl) currentNameEl.textContent = currentName;
        if (currentPhaseEl) currentPhaseEl.textContent = currentPhase;
        if (nextNameEl) nextNameEl.textContent = nextName;
        if (nextStatusEl) nextStatusEl.textContent = nextStatus;
    }

    /**
     * Updates phase UI (work/rest visual state)
     * @param {string} state - 'work' or 'rest'
     * @param {string} phaseLabel - Phase label text
     */
    updatePhaseUI(state, phaseLabel = '') {
        if (!this.trainingPanel) return;

        if (state === 'work') {
            this.setTimerPhaseLabel(phaseLabel || '¡A TRABAJAR!');
            this.trainingPanel.classList.remove('rest-state');
            this.trainingPanel.classList.add('work-state');
        } else if (state === 'rest') {
            this.setTimerPhaseLabel(phaseLabel || 'DESCANSO');
            this.trainingPanel.classList.remove('work-state');
            this.trainingPanel.classList.add('rest-state');
        } else {
            this.trainingPanel.classList.remove('work-state', 'rest-state');
            this.setTimerPhaseLabel('Prepárate');
        }
    }

    /**
     * Resets phase UI
     */
    resetPhaseUI() {
        if (this.trainingPanel) {
            this.trainingPanel.classList.remove('work-state', 'rest-state');
        }
        this.setTimerPhaseLabel('Prepárate');
    }

    /**
     * Sets timer phase label
     * @param {string} text - Label text
     */
    setTimerPhaseLabel(text) {
        if (this.timerPhase) this.timerPhase.textContent = text;
        if (this.expandedTimerPhase) this.expandedTimerPhase.textContent = text;
    }

    /**
     * Formats duration in seconds to MM:SS
     * @param {number} totalSeconds - Duration in seconds
     * @returns {string} Formatted duration
     */
    formatDuration(totalSeconds) {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    /**
     * Shows alert message
     * @param {string} msg - Message text
     * @param {string} type - 'success' | 'warning' | 'error'
     */
    showAlert(msg, type = 'success') {
        const div = document.createElement('div');
        let bgColor = 'bg-green-500';
        if (type === 'warning') bgColor = 'bg-yellow-500';
        if (type === 'error') bgColor = 'bg-red-500';
        
        div.className = `fixed top-5 right-5 ${bgColor} text-white py-2 px-4 rounded-lg shadow-lg z-50`;
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    }

    /**
     * Updates start button active state
     * @param {boolean} active - Whether button is active
     */
    setStartButtonActive(active) {
        if (!this.startButton) return;

        if (active) {
            this.startButton.classList.add('active-timer');
            this.startButton.style.opacity = '0.6';
        } else {
            this.startButton.classList.remove('active-timer');
            this.startButton.style.opacity = '1';
        }
    }

    /**
     * Updates complete set button visibility
     * @param {boolean} visible - Whether to show button
     */
    updateCompleteSetButtonVisibility(visible) {
        if (this.completeSetButton) {
            this.completeSetButton.style.visibility = visible ? 'visible' : 'hidden';
        }
    }

    // Preparation overlay controls
    showPreparationOverlay(exerciseName, seconds) {
        const overlay = document.getElementById('preparationOverlay');
        const nameEl = document.getElementById('prepExerciseName');
        const secEl = document.getElementById('prepSeconds');
        if (!overlay || !nameEl || !secEl) return;
        nameEl.textContent = exerciseName || 'Prepárate';
        secEl.textContent = String(seconds);
        overlay.style.display = 'block';
    }

    updatePreparationSeconds(seconds) {
        const secEl = document.getElementById('prepSeconds');
        if (secEl) secEl.textContent = String(seconds);
    }

    hidePreparationOverlay() {
        const overlay = document.getElementById('preparationOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    /**
     * Updates exercise title
     * @param {string} title - Exercise title
     */
    updateExerciseTitle(title) {
        if (this.currentExerciseTitle) {
            this.currentExerciseTitle.textContent = title;
        }
    }

    /**
     * Enables/disables start button
     * @param {boolean} disabled - Whether to disable
     */
    setStartButtonDisabled(disabled) {
        if (this.startButton) {
            this.startButton.disabled = disabled;
        }
    }

    /**
     * Enables/disables pause button
     * @param {boolean} disabled - Whether to disable
     */
    setPauseButtonDisabled(disabled) {
        if (this.pauseButton) {
            this.pauseButton.disabled = disabled;
        }
    }
}
