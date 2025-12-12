/**
 * Manages YouTube IFrame Player
 */
export class YouTubePlayer {
    constructor() {
        this.player = null;
        this.playerReady = false;
        this.pendingPlayerAction = null;
        this.isVideoMuted = true;
    }

    /**
     * Loads a video into the player
     * @param {Object} exercise - Exercise object with videoId, start, end
     * @param {boolean} playOnReady - Whether to auto-play when ready
     * @param {boolean} isGlobalPaused - Global pause state
     * @returns {void}
     */
    loadVideo(exercise, playOnReady = false, isGlobalPaused = false) {
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        this.playerReady = false;
        this.pendingPlayerAction = (playOnReady && !isGlobalPaused) ? 'play' : null;

        if (!exercise || !exercise.videoId) {
            this.pendingPlayerAction = null;
            return;
        }

        const playerVars = {
            autoplay: 0,
            controls: 0,
            rel: 0,
            showinfo: 0,
            mute: this.isVideoMuted ? 1 : 0,
            loop: 1,
            playlist: exercise.videoId
        };

        if (exercise.start) playerVars.start = exercise.start;
        if (exercise.end) playerVars.end = exercise.end;

        this.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: exercise.videoId,
            playerVars: playerVars,
            events: {
                onReady: (event) => {
                    this.playerReady = true;
                    this.syncMuteState();
                    if (this.pendingPlayerAction === 'play' && !isGlobalPaused) {
                        const startTime = exercise.start || 0;
                        event.target.seekTo(startTime, true);
                        setTimeout(() => event.target.playVideo(), 100);
                        this.pendingPlayerAction = null;
                    }
                },
                onStateChange: (event) => {
                    if (event.data === YT.PlayerState.ENDED) {
                        this.player.seekTo(exercise.start || 0);
                    }
                }
            }
        });
    }

    /**
     * Plays the current video
     * @param {boolean} isGlobalPaused - Global pause state
     */
    playVideo(isGlobalPaused = false) {
        if (isGlobalPaused) return;
        if (!this.player) {
            this.pendingPlayerAction = 'play';
            return;
        }
        if (this.playerReady && typeof this.player.playVideo === 'function') {
            this.player.playVideo();
            this.pendingPlayerAction = null;
        } else {
            this.pendingPlayerAction = 'play';
        }
    }

    /**
     * Pauses the current video
     */
    pauseVideo() {
        if (this.player && typeof this.player.pauseVideo === 'function') {
            this.player.pauseVideo();
        }
        this.pendingPlayerAction = null;
    }

    /**
     * Resumes the current video
     * @param {boolean} isGlobalPaused - Global pause state
     */
    resumeVideo(isGlobalPaused = false) {
        if (isGlobalPaused) return;
        if (!this.player) {
            this.pendingPlayerAction = 'play';
            return;
        }
        if (this.playerReady && typeof this.player.playVideo === 'function') {
            this.player.playVideo();
            this.pendingPlayerAction = null;
        } else {
            this.pendingPlayerAction = 'play';
        }
    }

    /**
     * Stops/pauses the video
     */
    stopVideo() {
        if (this.player && typeof this.player.pauseVideo === 'function') {
            this.player.pauseVideo();
        }
        this.pendingPlayerAction = null;
    }

    /**
     * Seeks to a specific time and optionally plays
     * @param {number} startTime - Time in seconds
     * @param {boolean} isGlobalPaused - Global pause state
     */
    resetToStart(startTime, isGlobalPaused = false) {
        if (!this.player) return;
        
        if (this.playerReady && typeof this.player.seekTo === 'function') {
            if (typeof this.player.pauseVideo === 'function') {
                this.player.pauseVideo();
            }
            setTimeout(() => {
                try {
                    this.player.seekTo(startTime, true);
                } catch {}
                setTimeout(() => {
                    if (!isGlobalPaused && this.playerReady && typeof this.player.playVideo === 'function') {
                        this.player.playVideo();
                    }
                }, 180);
            }, 50);
        } else {
            if (!isGlobalPaused) this.pendingPlayerAction = 'play';
        }
    }

    /**
     * Synchronizes mute state with player
     */
    syncMuteState() {
        if (!this.player || !this.playerReady) return;
        
        if (this.isVideoMuted) {
            if (typeof this.player.mute === 'function') this.player.mute();
        } else {
            if (typeof this.player.unMute === 'function') this.player.unMute();
        }
    }

    /**
     * Checks if player is currently playing
     * @returns {boolean}
     */
    isPlaying() {
        if (!this.player || typeof this.player.getPlayerState !== 'function' || typeof YT === 'undefined') {
            return this.pendingPlayerAction === 'play';
        }
        const state = this.player.getPlayerState();
        return state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
    }

    /**
     * Gets video duration
     * @returns {number|null} Duration in seconds or null
     */
    getDuration() {
        if (!this.player || !this.playerReady || typeof this.player.getDuration !== 'function') {
            return null;
        }
        return Math.floor(this.player.getDuration());
    }

    /**
     * Destroys the player instance
     */
    destroy() {
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        this.playerReady = false;
        this.pendingPlayerAction = null;
    }
}
