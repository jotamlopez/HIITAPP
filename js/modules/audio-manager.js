/**
 * Manages audio cues and sound effects
 */
export class AudioManager {
    constructor() {
        this.audioContext = null;
        this.countdownSynth = null;
        this.finishSynth = null;
        this.countdownGainNode = null;
        this.finishGainNode = null;
    }

    /**
     * Sets up audio context and synthesizers
     * @returns {void}
     */
    setupAudio() {
        // Try Tone.js first
        if (typeof Tone !== 'undefined') {
            if (!this.countdownSynth) {
                this.countdownSynth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.005, decay: 0.1, sustain: 0.2, release: 0.1 }
                }).toDestination();
            }
            if (!this.finishSynth) {
                this.finishSynth = new Tone.Synth({
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }
                }).toDestination();
            }
            return;
        }

        // Fallback to Web Audio API
        if (!this.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            this.audioContext = new AudioContextClass();
        }

        if (!this.countdownGainNode && this.audioContext) {
            this.countdownGainNode = this.audioContext.createGain();
            this.countdownGainNode.gain.value = 0.15;
            this.countdownGainNode.connect(this.audioContext.destination);
        }

        if (!this.finishGainNode && this.audioContext) {
            this.finishGainNode = this.audioContext.createGain();
            this.finishGainNode.gain.value = 0.2;
            this.finishGainNode.connect(this.audioContext.destination);
        }
    }

    /**
     * Primes audio engines (required for user interaction)
     * @returns {Promise<void>}
     */
    async primeAudioEngines() {
        if (typeof Tone !== 'undefined') {
            try {
                if (Tone.context.state !== 'running') await Tone.start();
                return;
            } catch (error) {
                console.warn('No se pudo inicializar el audio de Tone.js', error);
            }
        }

        if (this.audioContext) {
            try {
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
            } catch (error) {
                console.warn('No se pudo reanudar el contexto de audio', error);
            }
        }
    }

    /**
     * Plays countdown beep (last 4 seconds)
     */
    playCountdown() {
        if (this.countdownSynth) {
            this.countdownSynth.triggerAttackRelease('C5', '8n');
            return;
        }
        this.playFallbackBeep(880, 0.18, this.countdownGainNode);
    }

    /**
     * Plays finish cue (phase completion)
     */
    playFinish() {
        if (this.finishSynth) {
            this.finishSynth.triggerAttackRelease('G5', '4n');
            return;
        }
        this.playFallbackBeep(660, 0.3, this.finishGainNode);
    }

    /**
     * Plays fallback beep using Web Audio API
     * @param {number} frequency - Frequency in Hz
     * @param {number} durationSeconds - Duration in seconds
     * @param {GainNode} gainNode - Gain node for volume control
     * @private
     */
    playFallbackBeep(frequency, durationSeconds, gainNode) {
        if (!this.audioContext) return;
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        const oscillator = this.audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        if (gainNode) {
            oscillator.connect(gainNode);
        } else {
            oscillator.connect(this.audioContext.destination);
        }
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + durationSeconds);
    }
}
