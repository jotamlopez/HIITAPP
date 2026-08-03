/**
 * Manages YouTube IFrame Player
 */
export class YouTubePlayer {
    constructor() {
        this.player = null;
        this.playerReady = false;
        this.pendingPlayerAction = null;
        this.isVideoMuted = true;
        this.currentExercise = null;
    }

    /**
     * Loads a video into the player
     * @param {Object} exercise - Exercise object with videoId, start, end
     * @param {boolean} playOnReady - Whether to auto-play when ready
     * @param {boolean} isGlobalPaused - Global pause state
     * @returns {void}
     */
    loadVideo(exercise, playOnReady = false, isGlobalPaused = false) {
        console.log('DEBUG youtube-player.loadVideo:', { 
            videoId: exercise?.videoId, 
            playOnReady, 
            isGlobalPaused,
            playerExists: !!this.player,
            playerReady: this.playerReady
        });
        
        if (!exercise || !exercise.videoId) {
            console.error('DEBUG: No exercise or videoId provided to youtube-player');
            this.pendingPlayerAction = null;
            return;
        }

        // Check if we need to recreate player due to same video with different times
        const needsRecreate = this.player && this.playerReady && 
                              this.currentExercise && 
                              this.currentExercise.videoId === exercise.videoId &&
                              (this.currentExercise.start !== exercise.start || 
                               this.currentExercise.end !== exercise.end);
        
        if (needsRecreate) {
            console.log('DEBUG: Same video with different times detected, recreating player');
            try {
                this.player.destroy();
            } catch (e) {}
            this.player = null;
            this.playerReady = false;
        }

        // Store the exercise data for later use
        this.currentExercise = exercise;
        this.pendingPlayerAction = (playOnReady && !isGlobalPaused) ? 'play' : null;

        // If player already exists and is ready, just load the new video
        if (this.player && this.playerReady) {
            try {
                const startTime = exercise.start || 0;
                const endTime = exercise.end || null;
                
                console.log('DEBUG: Reusing existing player, loading video:', exercise.videoId, 'start:', startTime, 'end:', endTime);
                
                // Build video options
                const videoOptions = {
                    videoId: exercise.videoId,
                    startSeconds: startTime,
                };
                if (endTime) {
                    videoOptions.endSeconds = endTime;
                }

                // Use loadVideoById to load and potentially play
                if (playOnReady && !isGlobalPaused) {
                    console.log('DEBUG: Loading video with auto-play');
                    this.player.loadVideoById(videoOptions);
                    // Force seek after a small delay to ensure start time is respected
                    setTimeout(() => {
                        if (this.player && typeof this.player.seekTo === 'function') {
                            this.player.seekTo(startTime, true);
                        }
                    }, 300);
                } else {
                    console.log('DEBUG: Cueing video without auto-play');
                    this.player.cueVideoById(videoOptions);
                    // Force seek after a small delay
                    setTimeout(() => {
                        if (this.player && typeof this.player.seekTo === 'function') {
                            this.player.seekTo(startTime, true);
                        }
                    }, 300);
                }
                
                // Sync mute state after a brief delay
                setTimeout(() => this.syncMuteState(), 200);
                return;
            } catch (e) {
                console.error('Error loading video in existing player:', e);
                // If there's an error, destroy and recreate
                try {
                    this.player.destroy();
                } catch (e2) {}
                this.player = null;
                this.playerReady = false;
            }
        }

        // Create new player if it doesn't exist
        console.log('DEBUG: Creating new YouTube player');
        
        // Ensure player container exists
        let playerContainer = document.getElementById('player');
        if (!playerContainer) {
            console.log('DEBUG: Player container not found, creating...');
            const videoContainer = document.getElementById('videoContainer');
            if (videoContainer) {
                videoContainer.innerHTML = '<div id="player"></div>';
                playerContainer = document.getElementById('player');
                console.log('DEBUG: Player container created');
            } else {
                console.error('DEBUG: Video container not found!');
                return;
            }
        }
        
        this.playerReady = false;

        const playerVars = {
            autoplay: 0,
            controls: 0,
            rel: 0,
            showinfo: 0,
            mute: this.isVideoMuted ? 1 : 0
        };

        if (exercise.start) playerVars.start = exercise.start;
        if (exercise.end) playerVars.end = exercise.end;

        try {
            console.log('DEBUG: Calling new YT.Player with videoId:', exercise.videoId);
            this.player = new YT.Player('player', {
                height: '100%',
                width: '100%',
                videoId: exercise.videoId,
                playerVars: playerVars,
                events: {
                    onReady: (event) => {
                        console.log('DEBUG: YouTube Player onReady event fired');
                        this.playerReady = true;
                        this.syncMuteState();
                        if (this.pendingPlayerAction === 'play' && !isGlobalPaused) {
                            const startTime = exercise.start || 0;
                            event.target.seekTo(startTime, true);
                            setTimeout(() => {
                                try {
                                    event.target.playVideo();
                                    console.log('DEBUG: Video auto-playing after onReady');
                                } catch (e) {
                                    console.error('Error auto-playing:', e);
                                }
                            }, 150);
                            this.pendingPlayerAction = null;
                        }
                    },
                    onStateChange: (event) => {
                        console.log('DEBUG: Player state changed:', event.data);
                        if (event.data === YT.PlayerState.ENDED) {
                            const startTime = this.currentExercise?.start || 0;
                            this.player.seekTo(startTime);
                        }
                    },
                    onError: (event) => {
                        console.error('YouTube player error:', event.data);
                    }
                }
            });
            console.log('DEBUG: YT.Player instance created');
        } catch (e) {
            console.error('Error creating YouTube player:', e);
        }
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
            // Always seek to start time if exercise has one defined
            const startTime = this.currentExercise?.start || 0;
            if (typeof this.player.seekTo === 'function') {
                try {
                    this.player.seekTo(startTime, true);
                    console.log('DEBUG: Seeking to start time:', startTime);
                } catch (e) {
                    console.error('Error seeking to start time:', e);
                }
            }
            setTimeout(() => {
                this.player.playVideo();
            }, 100);
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
