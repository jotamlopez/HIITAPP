window.addEventListener('load', () => {
    const LOCAL_STORAGE_KEY = 'hiitTrainerData';
    const LOCAL_STORAGE_MUTE_KEY = 'hiitVideoMuted';
    let exercises = {}, routines = [];
    let player, playerReady = false, pendingPlayerAction = null;

    const timerDisplay = document.getElementById('timerDisplay'), trainingPanel = document.getElementById('trainingPanel'), timerPhase = document.getElementById('timerPhase'), expandedTimerPhase = document.getElementById('expandedTimerPhase'), currentExerciseTitle = document.getElementById('currentExerciseTitle'), startButton = document.getElementById('startButton'), pauseButton = document.getElementById('pauseButton'), resetExerciseButton = document.getElementById('resetExerciseButton'), resetRoutineButton = document.getElementById('resetRoutineButton'), routineSelect = document.getElementById('routineSelect'), routineModal = document.getElementById('routineModal'), exerciseModal = document.getElementById('exerciseModal'), editRoutineSelect = document.getElementById('editRoutineSelect'), routineNameInput = document.getElementById('routineNameInput'), exerciseSelect = document.getElementById('exerciseSelect'), routineExercisesList = document.getElementById('routineExercisesList'), deleteRoutineBtn = document.getElementById('deleteRoutineBtn'), exerciseLibraryList = document.getElementById('exerciseLibraryList'), exerciseIdInput = document.getElementById('exerciseIdInput'), exerciseNameInput = document.getElementById('exerciseNameInput'), exerciseVideoIdInput = document.getElementById('exerciseVideoIdInput'), videoStartInput = document.getElementById('videoStartInput'), videoEndInput = document.getElementById('videoEndInput'), audioToggle = document.getElementById('audioToggle'), importBtn = document.getElementById('importBtn'), exportBtn = document.getElementById('exportBtn'), importFile = document.getElementById('importFile'), importModal = document.getElementById('importModal'), mergeBtn = document.getElementById('mergeBtn'), replaceBtn = document.getElementById('replaceBtn'), maximizeVideoButton = document.getElementById('maximizeVideoBtn'), appLayout = document.getElementById('appLayout'), videoContainer = document.getElementById('videoContainer'), controlButtonsContainer = document.querySelector('.bottom-controls'), exerciseInfoCurrentName = document.getElementById('exerciseInfoCurrentName'), exerciseInfoCurrentPhase = document.getElementById('exerciseInfoCurrentPhase'), exerciseInfoNextName = document.getElementById('exerciseInfoNextName'), exerciseInfoNextStatus = document.getElementById('exerciseInfoNextStatus'), expandedStatsProgress = document.getElementById('expandedStatsProgress'), expandedStatsProgressBar = document.getElementById('expandedStatsProgressBar'), expandedStatsRemaining = document.getElementById('expandedStatsRemaining'), expandedStatsDetails = document.getElementById('expandedStatsDetails');
    let currentRoutine = null, currentExerciseIndex = 0, currentSetIndex = 1, currentRepeatIndex = 1, currentCircuitRound = 1, currentCircuitExerciseIndex = 0, isInCircuit = false, timeLeft, timer, timerState = 'stopped', state = 'work', tempExercises = [], tempCircuitExercises = [], countdownSynth, finishSynth, isVideoMuted = true, importedData = null, audioContext = null, countdownGainNode = null, finishGainNode = null, isSidebarHidden = false, isFallbackFullscreen = false, previousSidebarHidden = false, layoutRaf = null;

    async function initializeAppData() {
        const savedMuteSetting = localStorage.getItem(LOCAL_STORAGE_MUTE_KEY);
        isVideoMuted = savedMuteSetting !== null ? JSON.parse(savedMuteSetting) : true;
        audioToggle.checked = !isVideoMuted;

        const fileData = await loadDataFromFile();
        const persistedData = loadDataFromLocalStorage();

        if (persistedData) {
            exercises = persistedData.exercises;
            routines = persistedData.routines;
        } else if (fileData) {
            exercises = fileData.exercises;
            routines = fileData.routines;
            persistDataLocally();
        } else {
            exercises = {};
            routines = [];
        }

        populateAllSelects();
        resetWorkout('no_routine');
    }

    async function loadDataFromFile() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
                console.error("Could not load data.json. Make sure the file exists and the server is running.");
                alertMessage("No se pudo cargar el archivo de datos (data.json).", "warning");
                return null;
            }
            const data = await response.json();
            if (!isValidDataShape(data)) {
                alertMessage("El formato de data.json no es válido.", "error");
                return null;
            }
            return normalizeDataPayload(data);
        } catch (e) {
            console.error("Error fetching or parsing data.json:", e);
            alertMessage("Error al leer data.json. Revisa el formato del archivo.", "error");
            return null;
        }
    }

    function loadDataFromLocalStorage() {
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!isValidDataShape(parsed)) {
                console.warn('Persisted HIIT data had invalid format. Ignoring.');
                return null;
            }
            return normalizeDataPayload(parsed);
        } catch (error) {
            console.error('Error reading persisted HIIT data:', error);
            return null;
        }
    }

    function normalizeDataPayload(data) {
        // Ensure older shape (work/rest) is converted to explicit type 'time'
        const routines = Array.isArray(data.routines) ? data.routines.map(r => {
            return {
                name: r.name,
                exercises: Array.isArray(r.exercises) ? r.exercises.map(ex => {
                    if (!ex) return null;
                    // Handle circuits
                    if (ex.type === 'circuit') {
                        return {
                            type: 'circuit',
                            rounds: ex.rounds || 3,
                            restBetweenRounds: ex.restBetweenRounds || 60,
                            exercises: Array.isArray(ex.exercises) ? ex.exercises.map(cEx => {
                                if (!cEx) return null;
                                if (cEx.type === 'sets') {
                                    return { 
                                        exerciseId: cEx.exerciseId, 
                                        type: 'sets', 
                                        sets: cEx.sets || 3, 
                                        reps: cEx.reps || 10, 
                                        restBetweenSets: cEx.restBetweenSets || 60 
                                    };
                                }
                                return { 
                                    exerciseId: cEx.exerciseId, 
                                    type: 'time', 
                                    work: sanitizeDuration(cEx.work), 
                                    rest: sanitizeDuration(cEx.rest), 
                                    repeat: Math.max(1, sanitizeDuration(cEx.repeat, 1)) 
                                };
                            }).filter(Boolean) : []
                        };
                    }
                    // If object already has 'type' keep it
                    if (ex.type === 'sets') return { exerciseId: ex.exerciseId, type: 'sets', sets: ex.sets || ex.count || 3, reps: ex.reps || 10, restBetweenSets: ex.restBetweenSets || ex.restBetweenSets || 60 };
                    if (ex.type === 'time') return { exerciseId: ex.exerciseId, type: 'time', work: sanitizeDuration(ex.work), rest: sanitizeDuration(ex.rest), repeat: Math.max(1, sanitizeDuration(ex.repeat, 1)) };
                    // Legacy shape: { exerciseId, work, rest }
                    return { exerciseId: ex.exerciseId, type: 'time', work: sanitizeDuration(ex.work), rest: sanitizeDuration(ex.rest), repeat: Math.max(1, sanitizeDuration(ex.repeat, 1)) };
                }).filter(Boolean) : []
            };
        }) : [];

        return {
            exercises: data.exercises || {},
            routines
        };
    }

    function isValidDataShape(candidate) {
        if (!candidate || typeof candidate !== 'object') return false;
        if (candidate.exercises && typeof candidate.exercises !== 'object') return false;
        if (candidate.routines && !Array.isArray(candidate.routines)) return false;
        return true;
    }

    function persistDataLocally() {
        try {
            const snapshot = JSON.stringify({ exercises, routines });
            localStorage.setItem(LOCAL_STORAGE_KEY, snapshot);
        } catch (error) {
            console.error('Error persisting HIIT data locally:', error);
            alertMessage('No se pudo guardar la información en este navegador.', 'warning');
        }
    }

    function saveData(showToast = false) {
        persistDataLocally();
        if (showToast) alertMessage('Cambios guardados en este dispositivo. Usa Exportar para guardar una copia.', 'success');
    }
    
    function setupAudio() {
        if (typeof Tone !== 'undefined') {
            if (!countdownSynth) {
                countdownSynth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.2, release: 0.1 } }).toDestination();
            }
            if (!finishSynth) {
                finishSynth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 } }).toDestination();
            }
            return;
        }

        if (!audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            audioContext = new AudioContextClass();
        }

        if (!countdownGainNode && audioContext) {
            countdownGainNode = audioContext.createGain();
            countdownGainNode.gain.value = 0.15;
            countdownGainNode.connect(audioContext.destination);
        }

        if (!finishGainNode && audioContext) {
            finishGainNode = audioContext.createGain();
            finishGainNode.gain.value = 0.2;
            finishGainNode.connect(audioContext.destination);
        }
    }

    function playCountdownCue() {
        if (countdownSynth) {
            countdownSynth.triggerAttackRelease('C5', '8n');
            return;
        }
        playFallbackBeep(880, 0.18, countdownGainNode);
    }

    function playFinishCue() {
        if (finishSynth) {
            finishSynth.triggerAttackRelease('G5', '4n');
            return;
        }
        playFallbackBeep(660, 0.3, finishGainNode);
    }

    function playFallbackBeep(frequency, durationSeconds, gainNode) {
        if (!audioContext) return;
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        if (gainNode) oscillator.connect(gainNode);
        else oscillator.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + durationSeconds);
    }

    async function primeAudioEngines() {
        if (typeof Tone !== 'undefined') {
            try {
                if (Tone.context.state !== 'running') await Tone.start();
                return;
            } catch (error) {
                console.warn('No se pudo inicializar el audio de Tone.js', error);
            }
        }

        if (audioContext) {
            try {
                if (audioContext.state === 'suspended') await audioContext.resume();
            } catch (error) {
                console.warn('No se pudo reanudar el contexto de audio', error);
            }
        }
    }

    function sanitizeDuration(value, defaultValue = 0) {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed < 0) return defaultValue;
        return parsed;
    }

    function setTimerPhaseLabel(text) {
        if (timerPhase) timerPhase.textContent = text;
        if (expandedTimerPhase) expandedTimerPhase.textContent = text;
    }

    function setStartButtonActive(active) {
        if (!startButton) return;
        if (active) {
            startButton.classList.add('active-timer');
            startButton.style.opacity = '0.6';
            startButton.style.pointerEvents = 'none';
        } else {
            startButton.classList.remove('active-timer');
            startButton.style.opacity = '1';
            startButton.style.pointerEvents = 'auto';
            startButton.disabled = false; // Mantener para consistencia
        }
    }

    function updateSidebarToggleUI() {
        // Function kept for compatibility but no longer needed with new layout
    }

    function setSidebarHidden(hidden) {
        isSidebarHidden = hidden;
        if (appLayout) appLayout.classList.toggle('sidebar-hidden', isSidebarHidden);
        updateSidebarToggleUI();
        updateExpandedLayoutState();
    }

    function updateMaximizeButton(isExpanded) {
        if (!maximizeVideoButton) return;
        const labelSpan = maximizeVideoButton.querySelector('span');
        maximizeVideoButton.setAttribute('aria-label', isExpanded ? 'Restaurar panel de entrenamiento' : 'Maximizar panel de entrenamiento');
        if (labelSpan) labelSpan.textContent = isExpanded ? 'Restaurar' : 'Maximizar';
    }

    function isFullscreenActive() {
        return isFallbackFullscreen || document.fullscreenElement === trainingPanel;
    }

    function isExpandedLayoutActive() {
        return isSidebarHidden || isFullscreenActive();
    }

    function updateExpandedLayoutState() {
        if (appLayout) appLayout.classList.toggle('expanded-mode', isExpandedLayoutActive());
        if (!isExpandedLayoutActive() && videoContainer) {
            videoContainer.style.height = '';
            videoContainer.style.maxHeight = '';
            videoContainer.style.maxWidth = '';
            videoContainer.style.paddingBottom = '';
        }
        scheduleExpandedLayoutRecalc();
    }

    function scheduleExpandedLayoutRecalc() {
        if (layoutRaf) cancelAnimationFrame(layoutRaf);
        layoutRaf = requestAnimationFrame(() => {
            layoutRaf = null;
            recalculateExpandedLayout();
        });
    }

    function recalculateExpandedLayout() {
        if (!videoContainer || !isExpandedLayoutActive()) return;

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const aspectRatio = 16 / 9;
        const maxWidthCap = isFullscreenActive()
            ? Math.min(viewportWidth * 0.96, 1480)
            : Math.min(viewportWidth * 0.92, 1200);
        const widthLimitedHeight = maxWidthCap / aspectRatio;

        const timerHeight = timerDisplay ? timerDisplay.getBoundingClientRect().height : 0;
        const controlsHeight = controlButtonsContainer ? controlButtonsContainer.getBoundingClientRect().height : 0;

        let layoutGap = 0;
        // Layout gap calculation simplified for new 3-column layout

    const paddingBuffer = (isFullscreenActive() ? 110 : 190) + layoutGap;
        const availableHeight = Math.max(260, viewportHeight - timerHeight - controlsHeight - paddingBuffer);
        const targetHeight = Math.min(widthLimitedHeight, availableHeight);
        const computedWidth = Math.min(maxWidthCap, targetHeight * aspectRatio);

        // Prefer letting CSS aspect-ratio control the element height in all modes.
        // JS will only enforce maximum dimensions to prevent overflow, not force a pixel height.
        videoContainer.style.maxWidth = `${computedWidth}px`;
        videoContainer.style.maxHeight = `${targetHeight}px`;
        // clear any forced height so CSS aspect-ratio calculates the correct height from width
        videoContainer.style.height = '';
        // ensure padding-bottom is disabled so aspect-ratio or absolute sizing works
        videoContainer.style.paddingBottom = '0';
    }

    function formatDuration(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const seconds = safeSeconds % 60;
        if (hours > 0) {
            return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function calculateRemainingSeconds() {
        if (!currentRoutine || !Array.isArray(currentRoutine.exercises) || currentRoutine.exercises.length === 0) return 0;
        const routineExercises = currentRoutine.exercises;
        let remaining = 0;
        for (let index = currentExerciseIndex; index < routineExercises.length; index++) {
            const exercise = routineExercises[index];
            if (!exercise) continue;
            if (exercise.type === 'sets') {
                // Work is manual (user presses next), only count rests between sets
                const sets = Math.max(1, exercise.sets || 1);
                const restBetweenSets = sanitizeDuration(exercise.restBetweenSets, 0);
                // Count rests between remaining sets for this exercise
                if (index === currentExerciseIndex) {
                    if (timerState === 'running' || timerState === 'paused') {
                        // if currently in a rest state, include timeLeft
                        if (state === 'rest') remaining += Math.max(0, timeLeft);
                        // plus rests between upcoming sets
                        remaining += restBetweenSets * (sets - 1);
                    } else {
                        remaining += restBetweenSets * (sets - 1);
                    }
                } else {
                    remaining += restBetweenSets * (sets - 1);
                }
                continue;
            }
            const workDuration = sanitizeDuration(exercise.work);
            const restDuration = sanitizeDuration(exercise.rest);
            if (index === currentExerciseIndex) {
                if (timerState === 'running' || timerState === 'paused') {
                    if (state === 'work') {
                        remaining += Math.max(0, timeLeft);
                        if (restDuration > 0) remaining += restDuration;
                    } else {
                        remaining += Math.max(0, timeLeft);
                    }
                } else {
                    remaining += workDuration;
                    if (restDuration > 0) remaining += restDuration;
                }
            } else {
                remaining += workDuration;
                if (restDuration > 0) remaining += restDuration;
            }
        }
        return remaining;
    }

    function updateExpandedStats() {
        if (!expandedStatsProgress || !expandedStatsRemaining || !expandedStatsDetails) {
            scheduleExpandedLayoutRecalc();
            return;
        }

        if (!currentRoutine || !Array.isArray(currentRoutine.exercises) || currentRoutine.exercises.length === 0) {
            expandedStatsProgress.textContent = '0/0';
            expandedStatsRemaining.textContent = '00:00';
            expandedStatsDetails.textContent = 'Inicia la rutina';
            if (expandedStatsProgressBar) expandedStatsProgressBar.style.height = '0%';
            scheduleExpandedLayoutRecalc();
            return;
        }

        const totalExercises = currentRoutine.exercises.length;
        const currentPosition = Math.min(currentExerciseIndex + 1, totalExercises);
        expandedStatsProgress.textContent = `${currentPosition}/${totalExercises}`;

        const completed = Math.min(totalExercises, state === 'rest' ? currentExerciseIndex + 1 : currentExerciseIndex);
        const progressPercent = totalExercises > 0 ? Math.min(100, Math.max(0, (completed / totalExercises) * 100)) : 0;
        if (expandedStatsProgressBar) expandedStatsProgressBar.style.height = `${progressPercent}%`;

        const remainingSeconds = calculateRemainingSeconds();
        expandedStatsRemaining.textContent = formatDuration(remainingSeconds);
        if (remainingSeconds <= 0) {
            expandedStatsDetails.textContent = '¡Completada!';
            scheduleExpandedLayoutRecalc();
            return;
        }

        const statusParts = [];
        if (timerState === 'paused') statusParts.push('Temporizador en pausa');
        else if (timerState === 'running') statusParts.push(state === 'rest' ? 'Descanso activo' : 'Trabajo activo');
        else statusParts.push('Listo para comenzar');

        const remainingExercises = Math.max(totalExercises - currentPosition, 0);
        if (remainingExercises > 0) statusParts.push(`${remainingExercises} ejercicio(s) después de este`);
        else statusParts.push(state === 'rest' ? 'Inicia el último ejercicio al terminar' : 'Último tramo de la rutina');

        expandedStatsDetails.textContent = statusParts.join(' · ');
        scheduleExpandedLayoutRecalc();
    }

    // Compute completed 'points' for progress: each exercise = 1. For sets, each completed set = 1/sets.
    function computeProgressPoints() {
        if (!currentRoutine || !Array.isArray(currentRoutine.exercises) || currentRoutine.exercises.length === 0) return 0;
        const total = currentRoutine.exercises.length;
        let points = 0;
        // Full exercises completed before the current exercise
        for (let i = 0; i < currentExerciseIndex; i++) {
            const ex = currentRoutine.exercises[i];
            if (!ex) continue;
            points += 1;
        }

        const currentEx = currentRoutine.exercises[currentExerciseIndex];
        if (!currentEx) return points;

        if (currentEx.type === 'sets') {
            const totalSets = Math.max(1, currentEx.sets || 1);
            let completedSets = 0;
            if (state === 'work') {
                completedSets = Math.max(0, (currentSetIndex || 1) - 1);
            } else if (state === 'rest') {
                completedSets = Math.min(totalSets, currentSetIndex || 1);
            } else {
                completedSets = Math.max(0, (currentSetIndex || 1) - 1);
            }
            completedSets = Math.max(0, Math.min(totalSets, completedSets));
            points += completedSets / totalSets;
        }

        return points;
    }

    // Render small info block under exercise title in the left panel
    function renderLeftPanelDetails() {
        const container = document.getElementById('leftPanelExerciseDetails');
        const seriesEl = document.getElementById('leftDetailSeriesReps');
        const setIndexEl = document.getElementById('leftDetailSetIndex');
        const totalSetsEl = document.getElementById('leftDetailTotalSets');
        const repsEl = document.getElementById('leftDetailReps');
        const timeEl = document.getElementById('leftDetailTime');
        const elapsedEl = document.getElementById('leftDetailTimeElapsed');
        const totalTimeEl = document.getElementById('leftDetailTimeTotal');
        const remainingEl = document.getElementById('leftDetailTimeRemaining');
        const progressEl = document.getElementById('leftDetailProgress');
        const completedEl = document.getElementById('leftDetailCompleted');
        const totalEl = document.getElementById('leftDetailTotal');
        const percentEl = document.getElementById('leftDetailPercent');
        if (!container) return;

        const totalExercises = currentRoutine && Array.isArray(currentRoutine.exercises) ? currentRoutine.exercises.length : 0;
        const points = computeProgressPoints();
        const percent = totalExercises > 0 ? Math.round((points / totalExercises) * 100) : 0;

        // Default hide
        if (seriesEl) seriesEl.style.display = 'none';
        if (timeEl) timeEl.style.display = 'none';

        // Debug: log key state to help diagnose missing UI
        try {
            console.debug('[renderLeftPanelDetails] exIndex=', currentExerciseIndex, 'ex=', currentRoutine && currentRoutine.exercises ? currentRoutine.exercises[currentExerciseIndex] : null, 'currentSetIndex=', currentSetIndex, 'state=', state, 'timeLeft=', timeLeft);
        } catch (e) {}

        // If there's no current routine/exercise, show empty progress
        if (!currentRoutine || !Array.isArray(currentRoutine.exercises) || !currentRoutine.exercises[currentExerciseIndex]) {
            if (completedEl) completedEl.textContent = '0';
            if (totalEl) totalEl.textContent = String(totalExercises);
            if (percentEl) percentEl.textContent = '0%';
            return;
        }

        const ex = currentRoutine.exercises[currentExerciseIndex];

        // Progress numbers: show completed points (with one decimal if fractional)
        const completedDisplay = Number.isInteger(points) ? String(points) : points.toFixed(1);
        if (completedEl) completedEl.textContent = completedDisplay;
        if (totalEl) totalEl.textContent = String(totalExercises);
        if (percentEl) percentEl.textContent = `${percent}%`;

        if (ex.type === 'sets') {
            // show sets/reps info
            if (seriesEl) seriesEl.style.display = 'block';
            if (setIndexEl) setIndexEl.textContent = String(Math.min(Math.max(1, currentSetIndex || 1), Math.max(1, ex.sets || 1)));
            if (totalSetsEl) totalSetsEl.textContent = String(Math.max(1, ex.sets || 1));
            if (repsEl) repsEl.textContent = String(ex.reps || 0);
        } else {
            // time-based exercise: show elapsed / total / remaining
            if (timeEl) timeEl.style.display = 'block';
            const totalTime = sanitizeDuration(ex.work, 0);
            const remaining = Math.max(0, timeLeft || 0);
            const elapsed = Math.max(0, totalTime - remaining);
            if (elapsedEl) elapsedEl.textContent = formatDuration(elapsed);
            if (totalTimeEl) totalTimeEl.textContent = formatDuration(totalTime);
            if (remainingEl) remainingEl.textContent = formatDuration(remaining);
            // show repeat index if >1
            const repeatCount = Math.max(1, sanitizeDuration(ex.repeat, 1));
            if (repeatCount > 1) {
                // append repeat info to the time element
                if (timeEl) {
                    const repeatSpanId = 'leftDetailRepeatInfo';
                    let repeatSpan = document.getElementById(repeatSpanId);
                    if (!repeatSpan) {
                        repeatSpan = document.createElement('div');
                        repeatSpan.id = repeatSpanId;
                        repeatSpan.style.fontSize = '0.85em';
                        repeatSpan.style.color = '#9CA3AF';
                        timeEl.appendChild(repeatSpan);
                    }
                    repeatSpan.textContent = `Repetición ${currentRepeatIndex || 1}/${repeatCount}`;
                }
            } else {
                const existing = document.getElementById('leftDetailRepeatInfo');
                if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
            }
        }
    }

    function updateExerciseInfo() {
        if (!exerciseInfoCurrentName || !exerciseInfoCurrentPhase || !exerciseInfoNextName || !exerciseInfoNextStatus) return;

        if (!currentRoutine || !Array.isArray(currentRoutine.exercises) || currentRoutine.exercises.length === 0) {
            exerciseInfoCurrentName.textContent = 'Selecciona una rutina';
            exerciseInfoCurrentPhase.textContent = 'Prepárate';
            exerciseInfoNextName.textContent = '—';
            exerciseInfoNextStatus.textContent = 'Añade ejercicios';
            updateExpandedStats();
            // Also refresh left panel details
            renderLeftPanelDetails();
            return;
        }

        // Compute completed 'points' for progress: each exercise = 1. For sets, each completed set = 1/sets.
        function computeProgressPoints() {
            if (!currentRoutine || !Array.isArray(currentRoutine.exercises) || currentRoutine.exercises.length === 0) return 0;
            const total = currentRoutine.exercises.length;
            let points = 0;
            // Full exercises completed before the current exercise
            for (let i = 0; i < currentExerciseIndex; i++) {
                const ex = currentRoutine.exercises[i];
                if (!ex) continue;
                points += 1;
            }

            const currentEx = currentRoutine.exercises[currentExerciseIndex];
            if (!currentEx) return points;

            if (currentEx.type === 'sets') {
                const totalSets = Math.max(1, currentEx.sets || 1);
                let completedSets = 0;
                // Heuristic to determine how many sets have already been completed:
                // - If currently in work phase, completedSets = currentSetIndex - 1
                // - If currently in rest phase (rest between sets running), then the previous set was completed, so count currentSetIndex as completed
                if (state === 'work') {
                    completedSets = Math.max(0, (currentSetIndex || 1) - 1);
                } else if (state === 'rest') {
                    // during rest between sets, a set has just finished
                    completedSets = Math.min(totalSets, currentSetIndex || 1);
                } else {
                    completedSets = Math.max(0, (currentSetIndex || 1) - 1);
                }
                completedSets = Math.max(0, Math.min(totalSets, completedSets));
                points += completedSets / totalSets;
            } else {
                // time-mode: do not count partial progress for percent until exercise is completed or skipped
            }

            return points;
        }

        // Render small info block under exercise title in the left panel
        function renderLeftPanelDetails() {
            const container = document.getElementById('leftPanelExerciseDetails');
            const seriesEl = document.getElementById('leftDetailSeriesReps');
            const setIndexEl = document.getElementById('leftDetailSetIndex');
            const totalSetsEl = document.getElementById('leftDetailTotalSets');
            const repsEl = document.getElementById('leftDetailReps');
            const timeEl = document.getElementById('leftDetailTime');
            const elapsedEl = document.getElementById('leftDetailTimeElapsed');
            const totalTimeEl = document.getElementById('leftDetailTimeTotal');
            const remainingEl = document.getElementById('leftDetailTimeRemaining');
            const progressEl = document.getElementById('leftDetailProgress');
            const completedEl = document.getElementById('leftDetailCompleted');
            const totalEl = document.getElementById('leftDetailTotal');
            const percentEl = document.getElementById('leftDetailPercent');
            if (!container) return;

            const totalExercises = currentRoutine && Array.isArray(currentRoutine.exercises) ? currentRoutine.exercises.length : 0;
            const points = computeProgressPoints();
            const percent = totalExercises > 0 ? Math.round((points / totalExercises) * 100) : 0;

            // Default hide
            if (seriesEl) seriesEl.style.display = 'none';
            if (timeEl) timeEl.style.display = 'none';

            // If there's no current routine/exercise, show empty progress
            if (!currentRoutine || !Array.isArray(currentRoutine.exercises) || !currentRoutine.exercises[currentExerciseIndex]) {
                if (completedEl) completedEl.textContent = '0';
                if (totalEl) totalEl.textContent = String(totalExercises);
                if (percentEl) percentEl.textContent = '0%';
                return;
            }

            const ex = currentRoutine.exercises[currentExerciseIndex];

            // Progress numbers: show completed points (with one decimal if fractional)
            const completedDisplay = Number.isInteger(points) ? String(points) : points.toFixed(1);
            if (completedEl) completedEl.textContent = completedDisplay;
            if (totalEl) totalEl.textContent = String(totalExercises);
            if (percentEl) percentEl.textContent = `${percent}%`;

            // Also update expanded/fullscreen small indicators if present
            const expSeriesEl = document.getElementById('expandedSeriesReps');
            const expSetIndex = document.getElementById('expandedSetIndex');
            const expTotalSets = document.getElementById('expandedTotalSets');
            const expReps = document.getElementById('expandedReps');
            const expTimeInfo = document.getElementById('expandedTimeInfo');
            const expTimeElapsed = document.getElementById('expandedTimeElapsed');
            const expTimeTotal = document.getElementById('expandedTimeTotal');
            const expRepeatInfo = document.getElementById('expandedRepeatInfo');
            const expRepeatIndex = document.getElementById('expandedRepeatIndex');
            const expRepeatTotal = document.getElementById('expandedRepeatTotal');

            if (ex.type === 'sets') {
                // show sets/reps info in left panel
                if (seriesEl) seriesEl.style.display = 'block';
                if (setIndexEl) setIndexEl.textContent = String(Math.min(Math.max(1, currentSetIndex || 1), Math.max(1, ex.sets || 1)));
                if (totalSetsEl) totalSetsEl.textContent = String(Math.max(1, ex.sets || 1));
                if (repsEl) repsEl.textContent = String(ex.reps || 0);
                // show in expanded panel
                if (expSeriesEl) expSeriesEl.style.display = 'block';
                if (expSetIndex) expSetIndex.textContent = String(Math.min(Math.max(1, currentSetIndex || 1), Math.max(1, ex.sets || 1)));
                if (expTotalSets) expTotalSets.textContent = String(Math.max(1, ex.sets || 1));
                if (expReps) expReps.textContent = String(ex.reps || 0);
                if (expTimeInfo) expTimeInfo.style.display = 'none';
                if (expRepeatInfo) expRepeatInfo.style.display = 'none';
            } else {
                // time-based exercise: show elapsed / total / remaining
                if (timeEl) timeEl.style.display = 'block';
                const totalTime = sanitizeDuration(ex.work, 0);
                const remaining = Math.max(0, timeLeft || 0);
                const elapsed = Math.max(0, totalTime - remaining);
                if (elapsedEl) elapsedEl.textContent = formatDuration(elapsed);
                if (totalTimeEl) totalTimeEl.textContent = formatDuration(totalTime);
                if (remainingEl) remainingEl.textContent = formatDuration(remaining);
                // expanded panel timing
                if (expTimeInfo) expTimeInfo.style.display = 'block';
                if (expTimeElapsed) expTimeElapsed.textContent = formatDuration(elapsed);
                if (expTimeTotal) expTimeTotal.textContent = formatDuration(totalTime);
                // show repeat index if >1
                const repeatCount = Math.max(1, sanitizeDuration(ex.repeat, 1));
                if (repeatCount > 1) {
                    if (timeEl) {
                        const repeatSpanId = 'leftDetailRepeatInfo';
                        let repeatSpan = document.getElementById(repeatSpanId);
                        if (!repeatSpan) {
                            repeatSpan = document.createElement('div');
                            repeatSpan.id = repeatSpanId;
                            repeatSpan.style.fontSize = '0.85em';
                            repeatSpan.style.color = '#9CA3AF';
                            timeEl.appendChild(repeatSpan);
                        }
                        repeatSpan.textContent = `Repetición ${currentRepeatIndex || 1}/${repeatCount}`;
                    }
                    if (expRepeatInfo) {
                        expRepeatInfo.style.display = 'block';
                        if (expRepeatIndex) expRepeatIndex.textContent = String(currentRepeatIndex || 1);
                        if (expRepeatTotal) expRepeatTotal.textContent = String(repeatCount);
                    }
                } else {
                    const existing = document.getElementById('leftDetailRepeatInfo');
                    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
                    if (expRepeatInfo) expRepeatInfo.style.display = 'none';
                }
            }
        }

        const routineExercises = currentRoutine.exercises;
        let effectiveIndex = currentExerciseIndex;
        if (Number.isNaN(effectiveIndex) || effectiveIndex < 0) effectiveIndex = 0;
        if (effectiveIndex >= routineExercises.length) effectiveIndex = routineExercises.length - 1;

        const currentExercise = routineExercises[effectiveIndex];
        const nextExercise = routineExercises[effectiveIndex + 1] || null;

        if (currentExercise) {
            exerciseInfoCurrentName.textContent = currentExercise.name || 'Ejercicio actual';
        } else {
            exerciseInfoCurrentName.textContent = 'Rutina finalizada';
        }

        let phaseText = 'Listo para comenzar';
        if (!currentExercise) {
            phaseText = 'Rutina completada';
        } else if (currentExercise.type === 'sets') {
            const totalSets = Math.max(1, currentExercise.sets || 1);
            const displaySet = Math.min(Math.max(1, currentSetIndex || 1), totalSets);
            phaseText = `Serie ${displaySet}/${totalSets} — ${currentExercise.reps || 0} reps`;
            if (timerState === 'running') phaseText += state === 'rest' ? ' · Descanso en progreso' : ' · Trabajo en progreso';
            else if (timerState === 'paused') phaseText += state === 'rest' ? ' · Descanso en pausa' : ' · Trabajo en pausa';
            else if (timerState === 'stopped') phaseText += state === 'rest' ? ' · Descanso listo' : ' · Listo para iniciar';
        } else if (timerState === 'running') {
            phaseText = state === 'rest' ? 'Descanso en progreso' : 'Trabajo en progreso';
        } else if (timerState === 'paused') {
            phaseText = state === 'rest' ? 'Descanso en pausa' : 'Trabajo en pausa';
        } else if (timerState === 'stopped') {
            phaseText = state === 'rest' ? 'Descanso listo' : 'Listo para iniciar';
        }
        exerciseInfoCurrentPhase.textContent = phaseText;

        if (nextExercise) {
            exerciseInfoNextName.textContent = nextExercise.name || 'Siguiente ejercicio';
            let statusText = 'A continuación';
            if (timerState === 'running' && state === 'rest') statusText = 'Comienza al terminar el descanso';
            if (timerState === 'paused') statusText = 'Pendiente cuando reanudes';
            if (timerState === 'stopped') statusText = 'Preparado para iniciar después';
            exerciseInfoNextStatus.textContent = statusText;
        } else {
            exerciseInfoNextName.textContent = 'Sin siguiente ejercicio';
            const finaleText = currentExercise ? (state === 'rest' ? 'Finaliza tras este descanso' : 'Último ejercicio de la rutina') : 'Carga otra rutina para continuar';
            exerciseInfoNextStatus.textContent = finaleText;
        }
        updateExpandedStats();
    }

    function applyFallbackFullscreen(forceState) {
        if (!trainingPanel) return;
        const targetState = typeof forceState === 'boolean' ? forceState : !isFallbackFullscreen;
        if (targetState === isFallbackFullscreen) {
            updateMaximizeButton(targetState || document.fullscreenElement === trainingPanel);
            updateExpandedLayoutState();
            return;
        }
        if (targetState) {
            previousSidebarHidden = isSidebarHidden;
        }
        isFallbackFullscreen = targetState;
        trainingPanel.classList.toggle('training-panel-fullscreen', isFallbackFullscreen);
        if (isFallbackFullscreen) {
            setSidebarHidden(true);
        } else {
            setSidebarHidden(previousSidebarHidden);
        }
        const isFullscreenActive = isFallbackFullscreen || document.fullscreenElement === trainingPanel;
        if (videoContainer) videoContainer.classList.toggle('full-width', isFullscreenActive);
        updateMaximizeButton(isFullscreenActive);
        updateExpandedLayoutState();
    }

    async function toggleTrainingFullscreen() {
        if (!trainingPanel) return;
        const canUseNativeFullscreen = document.fullscreenEnabled && typeof trainingPanel.requestFullscreen === 'function';
        if (canUseNativeFullscreen) {
            if (document.fullscreenElement === trainingPanel) {
                await document.exitFullscreen();
            } else {
                try {
                    await trainingPanel.requestFullscreen();
                } catch (error) {
                    console.warn('No se pudo activar pantalla completa nativa:', error);
                    applyFallbackFullscreen(true);
                }
            }
        } else {
            applyFallbackFullscreen();
        }
    }
    function populateAllSelects() { const sortedRoutines = [...routines].sort((a, b) => a.name.localeCompare(b.name)); const sortedExercises = Object.entries(exercises).sort(([, a], [, b]) => a.name.localeCompare(b.name)); routineSelect.innerHTML = '<option value="">-- Carga una rutina --</option>'; editRoutineSelect.innerHTML = '<option value="">-- Crear Nueva Rutina --</option>'; sortedRoutines.forEach(r => { routineSelect.innerHTML += `<option value="${r.name}">${r.name}</option>`; editRoutineSelect.innerHTML += `<option value="${r.name}">${r.name}</option>`; }); exerciseSelect.innerHTML = ''; if(sortedExercises.length > 0) sortedExercises.forEach(([id, ex]) => { exerciseSelect.innerHTML += `<option value="${id}">${ex.name}</option>`; }); exerciseLibraryList.innerHTML = ''; sortedExercises.forEach(([id, ex]) => { exerciseLibraryList.innerHTML += `<li><span>${ex.name}</span><div class="flex gap-2"><button data-id="${id}" class="edit-ex-btn text-indigo-400 hover:text-indigo-300">Editar</button><button data-id="${id}" class="delete-ex-btn text-red-400 hover:text-red-300">Eliminar</button></div></li>`; }); }
    
    function resetWorkout(status = 'no_routine') {
        clearInterval(timer); timerState = 'stopped'; currentExerciseIndex = 0;
        // Reset circuit variables
        isInCircuit = false;
        currentCircuitRound = 1;
        currentCircuitExerciseIndex = 0;
        
        if (player) { player.destroy(); player = null; }
        playerReady = false; pendingPlayerAction = null;
        const firstExercise = currentRoutine ? currentRoutine.exercises[0] : null;
        if (firstExercise) {
            // Reset set index at start of routine
            currentSetIndex = 1;
            currentRepeatIndex = 1;
            
            // Handle circuit as first exercise
            if (firstExercise.type === 'circuit') {
                isInCircuit = true;
                const firstCircuitEx = firstExercise.exercises[0];
                if (firstCircuitEx) {
                    if (firstCircuitEx.type === 'sets') {
                        timeLeft = 0;
                    } else {
                        timeLeft = firstCircuitEx.work;
                    }
                    currentExerciseTitle.textContent = `🔁 CIRCUITO 1/${firstExercise.rounds} - ${firstCircuitEx.name}`;
                    loadVideo(firstCircuitEx, false);
                }
            } else {
                if (firstExercise.type === 'sets') {
                    timeLeft = 0; // manual work
                } else {
                    timeLeft = firstExercise.work;
                }
                currentExerciseTitle.textContent = firstExercise.name;
                loadVideo(firstExercise, false);
            }
        } else { timeLeft = 0; if (status === 'empty') currentExerciseTitle.textContent = 'Esta rutina está vacía'; else if (status === 'all_invalid') currentExerciseTitle.textContent = 'La rutina solo contiene ejercicios no válidos'; else currentExerciseTitle.textContent = 'Selecciona una rutina'; }
        updateTimerDisplay(); resetPhaseUI();
        renderLeftPanelDetails();
    }

    window.onYouTubeIframeAPIReady = function() {};

    function loadVideo(exercise, playOnReady = false) {
        if (player) { player.destroy(); player = null; }
        playerReady = false;
        pendingPlayerAction = playOnReady ? 'play' : null;
        if (!exercise || !exercise.videoId) {
            pendingPlayerAction = null;
            return;
        }
        const playerVars = { 'autoplay': 0, 'controls': 0, 'rel': 0, 'showinfo': 0, 'mute': isVideoMuted ? 1 : 0, 'loop': 1, 'playlist': exercise.videoId };
        if (exercise.start) playerVars.start = exercise.start;
        if (exercise.end) playerVars.end = exercise.end;
        player = new YT.Player('player', { 
            height: '100%', 
            width: '100%', 
            videoId: exercise.videoId, 
            playerVars: playerVars, 
            events: { 
                'onReady': (event) => { 
                    playerReady = true; 
                    syncPlayerMuteState(); 
                    if (pendingPlayerAction === 'play') { 
                        // Ensure video starts at correct time
                        const startTime = sanitizeDuration(exercise.start, 0);
                        event.target.seekTo(startTime, true);
                        setTimeout(() => {
                            event.target.playVideo();
                        }, 100);
                        pendingPlayerAction = null; 
                    } 
                }, 
                'onStateChange': (event) => { 
                    if (event.data === YT.PlayerState.ENDED) { 
                        player.seekTo(exercise.start || 0); 
                    }
                } 
            } 
        });
    }
    
    function updateTimerDisplay() { const m=Math.floor(timeLeft/60).toString().padStart(2,'0'); const s=(timeLeft % 60).toString().padStart(2,'0'); timerDisplay.textContent=`${m}:${s}`; }
    function updatePhaseUI() { if(state==='work'){ setTimerPhaseLabel('¡A TRABAJAR!'); trainingPanel.classList.remove('rest-state'); trainingPanel.classList.add('work-state'); } else { setTimerPhaseLabel('DESCANSO'); trainingPanel.classList.remove('work-state'); trainingPanel.classList.add('rest-state'); } updateExerciseInfo(); }
    
    // Ensure complete-set button visibility updates when phase changes
    const originalUpdatePhaseUI = updatePhaseUI;
    updatePhaseUI = function() { originalUpdatePhaseUI(); updateCompleteSetButtonVisibility(); };
    function resetPhaseUI() { trainingPanel.classList.remove('work-state','rest-state'); setTimerPhaseLabel('Prepárate'); updateExerciseInfo(); }
    
    function loadExercise(playOnLoad) {
        const ex = currentRoutine.exercises[currentExerciseIndex];
        if (!ex) { finishWorkout(); return; }
        
        // Handle circuits
        if (ex.type === 'circuit') {
            isInCircuit = true;
            currentCircuitRound = 1;
            currentCircuitExerciseIndex = 0;
            const firstCircuitExercise = ex.exercises[0];
            if (!firstCircuitExercise) { finishWorkout(); return; }
            
            state = 'work';
            currentRepeatIndex = 1;
            
            if (firstCircuitExercise.type === 'sets') {
                currentSetIndex = 1;
                timeLeft = 0;
                setTimerDisplayManual();
                // Sets: permitir Play/Pause siempre
                if (startButton) startButton.disabled = false;
                if (pauseButton) pauseButton.disabled = true;
                // Si venimos de un temporizador corriendo, detenerlo para evitar beep inmediato
                if (timerState === 'running') { clearInterval(timer); timer = null; timerState = 'stopped'; }
            } else {
                timeLeft = sanitizeDuration(firstCircuitExercise.work);
                if (startButton) startButton.disabled = false;
                if (pauseButton) pauseButton.disabled = true;
            }
            
            currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${ex.rounds} - ${firstCircuitExercise.name}`;
            updateTimerDisplay();
            loadVideo(firstCircuitExercise, playOnLoad);
            updatePhaseUI();
            updateCompleteSetButtonVisibility();
            renderLeftPanelDetails();
            return;
        }
        
        // Regular exercise loading
        isInCircuit = false;
        state = 'work';
        // initialize repeat tracking for time-mode exercises
        currentRepeatIndex = 1;
        if (ex.type === 'sets') {
            // Manual work phase: no countdown, pero permitir Play/Pause
            currentSetIndex = 1;
            timeLeft = 0;
            setTimerDisplayManual();
            if (startButton) startButton.disabled = false;
            if (pauseButton) pauseButton.disabled = true;
            if (timerState === 'running') { clearInterval(timer); timer = null; timerState = 'stopped'; }
        } else {
            timeLeft = sanitizeDuration(ex.work);
            if (startButton) startButton.disabled = false;
            if (pauseButton) pauseButton.disabled = true;
        }
        currentExerciseTitle.textContent = ex.name;
        updateTimerDisplay();
        loadVideo(ex, playOnLoad);
        updatePhaseUI();
        updateCompleteSetButtonVisibility();
        renderLeftPanelDetails();
    }

    // Navigation helpers: move to next / previous exercise and load it
    function goToNextExercise(playImmediately = true) {
        if (!currentRoutine || !Array.isArray(currentRoutine.exercises) || currentRoutine.exercises.length === 0) return;
        if (currentExerciseIndex < currentRoutine.exercises.length - 1) {
            clearInterval(timer);
            timerState = 'stopped';
            currentExerciseIndex++;
            
            // Check if next exercise is a circuit
            const nextEx = currentRoutine.exercises[currentExerciseIndex];
            if (nextEx && nextEx.type === 'circuit') {
                // Load the circuit
                loadExercise(playImmediately);
                // Only start timer if first exercise is time-based
                if (playImmediately && nextEx.exercises[0] && nextEx.exercises[0].type !== 'sets') {
                    startTimer();
                }
                renderLeftPanelDetails();
                return;
            }
            
            // Regular exercise
            loadExercise(playImmediately);
            // Start the timer only for time-based exercises (sets handle video via loadExercise)
            if (playImmediately && nextEx && nextEx.type !== 'sets') {
                startTimer();
            }
            renderLeftPanelDetails();
        }
    }

    function goToPreviousExercise(playImmediately = true) {
        if (!currentRoutine || !Array.isArray(currentRoutine.exercises) || currentRoutine.exercises.length === 0) return;
        if (currentExerciseIndex > 0) {
            clearInterval(timer);
            timerState = 'stopped';
            currentExerciseIndex--;
            
            // Check if previous exercise is a circuit
            const prevEx = currentRoutine.exercises[currentExerciseIndex];
            if (prevEx && prevEx.type === 'circuit') {
                // Load the circuit
                loadExercise(playImmediately);
                // Only start timer if first exercise is time-based
                if (playImmediately && prevEx.exercises[0] && prevEx.exercises[0].type !== 'sets') {
                    startTimer();
                }
                renderLeftPanelDetails();
                return;
            }
            
            // Regular exercise
            loadExercise(playImmediately);
            // Start the timer only for time-based exercises (sets handle video via loadExercise)
            if (playImmediately && prevEx && prevEx.type !== 'sets') {
                startTimer();
            }
            renderLeftPanelDetails();
        }
    }

    // Circuit navigation helpers
    function goToNextCircuitExercise() {
        if (!isInCircuit || !currentRoutine) return;
        const circuit = currentRoutine.exercises[currentExerciseIndex];
        if (!circuit || circuit.type !== 'circuit') return;
        
        clearInterval(timer);
        timerState = 'stopped';
        
        // Move to next exercise in circuit
        currentCircuitExerciseIndex++;
        
        if (currentCircuitExerciseIndex >= circuit.exercises.length) {
            // Reached end of circuit - go to next round or next exercise
            currentCircuitExerciseIndex = 0;
            currentCircuitRound++;
            
            if (currentCircuitRound > circuit.rounds) {
                // Completed all rounds - exit circuit
                isInCircuit = false;
                currentCircuitRound = 1;
                currentCircuitExerciseIndex = 0;
                currentExerciseIndex++;
                
                if (currentExerciseIndex < currentRoutine.exercises.length) {
                    const nextEx = currentRoutine.exercises[currentExerciseIndex];
                    loadExercise(true); // Auto-play video for both time and sets
                    // Auto-start timer if it's a time-based exercise
                    if (nextEx && nextEx.type !== 'sets') {
                        startTimer();
                    }
                } else {
                    alertMessage('Has completado la rutina.', 'success');
                }
                return;
            }
        }
        
        // Load the exercise at the new position
        const circuitEx = circuit.exercises[currentCircuitExerciseIndex];
        if (!circuitEx) return;
        
        state = 'work';
        currentRepeatIndex = 1;
        
        if (circuitEx.type === 'sets') {
            currentSetIndex = 1;
            timeLeft = 0;
            setTimerDisplayManual();
            if (startButton) startButton.disabled = false;
            if (pauseButton) pauseButton.disabled = true;
        } else {
            timeLeft = sanitizeDuration(circuitEx.work);
            if (startButton) startButton.disabled = false;
            if (pauseButton) pauseButton.disabled = true;
        }
        
        currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${circuitEx.name}`;
        updateTimerDisplay();
        loadVideo(circuitEx, true); // Auto-play video for both time and sets
        updatePhaseUI();
        updateCompleteSetButtonVisibility();
        renderLeftPanelDetails();
        
        // Auto-start timer for time-based exercises
        if (circuitEx.type !== 'sets') {
            startTimer();
        }
    }

    function goToPreviousCircuitExercise() {
        if (!isInCircuit || !currentRoutine) return;
        const circuit = currentRoutine.exercises[currentExerciseIndex];
        if (!circuit || circuit.type !== 'circuit') return;
        
        clearInterval(timer);
        timerState = 'stopped';
        
        // Move to previous exercise in circuit
        currentCircuitExerciseIndex--;
        
        if (currentCircuitExerciseIndex < 0) {
            // Reached beginning of circuit - go to previous round or previous exercise
            currentCircuitRound--;
            
            if (currentCircuitRound < 1) {
                // Exit circuit and go to previous exercise in routine
                isInCircuit = false;
                currentCircuitRound = 1;
                currentCircuitExerciseIndex = 0;
                
                if (currentExerciseIndex > 0) {
                    currentExerciseIndex--;
                    const prevEx = currentRoutine.exercises[currentExerciseIndex];
                    loadExercise(true); // Auto-play video for both time and sets
                    // Auto-start timer if it's a time-based exercise
                    if (prevEx && prevEx.type !== 'sets') {
                        startTimer();
                    }
                } else {
                    // Already at first exercise
                    currentCircuitRound = 1;
                    currentCircuitExerciseIndex = 0;
                    isInCircuit = true;
                    loadExercise(true); // Auto-play video
                }
                return;
            }
            
            // Go to last exercise of previous round
            currentCircuitExerciseIndex = circuit.exercises.length - 1;
        }
        
        // Load the exercise at the new position
        const circuitEx = circuit.exercises[currentCircuitExerciseIndex];
        if (!circuitEx) return;
        
        state = 'work';
        currentRepeatIndex = 1;
        
        if (circuitEx.type === 'sets') {
            currentSetIndex = 1;
            timeLeft = 0;
            setTimerDisplayManual();
            if (startButton) startButton.disabled = false;
            if (pauseButton) pauseButton.disabled = true;
        } else {
            timeLeft = sanitizeDuration(circuitEx.work);
            if (startButton) startButton.disabled = false;
            if (pauseButton) pauseButton.disabled = true;
        }
        
        currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${circuitEx.name}`;
        updateTimerDisplay();
        loadVideo(circuitEx, true); // Auto-play video for both time and sets
        updatePhaseUI();
        updateCompleteSetButtonVisibility();
        renderLeftPanelDetails();
        
        // Auto-start timer for time-based exercises
        if (circuitEx.type !== 'sets') {
            startTimer();
        }
    }

    function playCurrentVideo() {
        if (!player) { pendingPlayerAction = 'play'; return; }
        if (playerReady && typeof player.playVideo === 'function') {
            player.playVideo();
            pendingPlayerAction = null;
        } else {
            pendingPlayerAction = 'play';
        }
    }

    function pauseCurrentVideo() {
        if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
        pendingPlayerAction = null;
    }

    function stopCurrentVideo() {
        if (player && typeof player.pauseVideo === 'function') {
            // Use pause instead of stop to preserve video state
            player.pauseVideo();
        }
        pendingPlayerAction = null;
    }

    function resetVideoToStart() {
        // Reset video to configured start time and play
        const ex = currentRoutine?.exercises[currentExerciseIndex];
        if (!player || !ex) return;
        const startTime = sanitizeDuration(ex.start, 0);
        
        if (playerReady && typeof player.seekTo === 'function' && typeof player.playVideo === 'function') {
            // First pause to ensure clean state
            if (typeof player.pauseVideo === 'function') {
                player.pauseVideo();
            }
            
            // Wait a moment for pause to complete, then seek and play
            setTimeout(() => {
                player.seekTo(startTime, true); // true = allow seek ahead
                setTimeout(() => {
                    player.playVideo();
                }, 200); // wait for seek to complete
            }, 50);
        } else {
            // Player not ready yet, queue the action
            pendingPlayerAction = 'play';
        }
    }

    function isPlayerCurrentlyPlaying() {
        if (!player || typeof player.getPlayerState !== 'function' || typeof YT === 'undefined') {
            return pendingPlayerAction === 'play';
        }
        const state = player.getPlayerState();
        return state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
    }

    function syncPlayerMuteState(options = {}) {
        if (!player || typeof player.mute !== 'function') return;
        if (isVideoMuted) player.mute();
        else player.unMute();
        if (options.resumeIfPlaying && options.wasPlaying && typeof player.playVideo === 'function') player.playVideo();
    }
    
    async function startTimer() {
        // Si es un ejercicio por series en fase de trabajo, permitir Play (solo video) sin iniciar el temporizador
        if (currentRoutine && Array.isArray(currentRoutine.exercises)) {
            const topEx = currentRoutine.exercises[currentExerciseIndex];
            let effectiveEx = topEx;
            if (isInCircuit && topEx && topEx.type === 'circuit') {
                effectiveEx = (topEx.exercises || [])[currentCircuitExerciseIndex] || null;
            }
            if (effectiveEx && effectiveEx.type === 'sets' && state === 'work') {
                // Reproducir video, actualizar estados de botones; no iniciar intervalo
                timerState = 'running';
                if (startButton) {
                    startButton.classList.add('active-timer');
                    startButton.style.opacity = '0.6';
                }
                if (pauseButton) pauseButton.disabled = false;
                try {
                    setupAudio();
                } catch {}
                playCurrentVideo();
                updateExerciseInfo();
                renderLeftPanelDetails();
                return;
            }
        }

        if (timerState === 'paused') {
            // Si estamos en un ejercicio por series en fase de trabajo, reanudar solo el video, sin temporizador
            if (currentRoutine && Array.isArray(currentRoutine.exercises)) {
                const topEx = currentRoutine.exercises[currentExerciseIndex];
                let effectiveEx = topEx;
                if (isInCircuit && topEx && topEx.type === 'circuit') {
                    effectiveEx = (topEx.exercises || [])[currentCircuitExerciseIndex] || null;
                }
                if (effectiveEx && effectiveEx.type === 'sets' && state === 'work') {
                    timerState = 'running';
                    if (startButton) {
                        startButton.classList.add('active-timer');
                        startButton.style.opacity = '0.6';
                    }
                    if (pauseButton) pauseButton.disabled = false;
                    playCurrentVideo();
                    updateExerciseInfo();
                    renderLeftPanelDetails();
                    return;
                }
            }
            // resume from pause
            timerState = 'running';
            // update button states
            setStartButtonActive(true);
            if (pauseButton) pauseButton.disabled = false;
            setupAudio();
            await primeAudioEngines();
            playCurrentVideo();
            timer = setInterval(timerLoop, 1000);
            updateExerciseInfo();
            renderLeftPanelDetails();
            return;
        }

        if (timerState === 'stopped' && currentRoutine && currentRoutine.exercises.length > 0) {
            setupAudio();
            await primeAudioEngines();

            // Determine effective exercise (handle circuits)
            const topEx = currentRoutine.exercises[currentExerciseIndex];
            let effectiveEx = topEx;
            if (isInCircuit && topEx && topEx.type === 'circuit') {
                effectiveEx = (topEx.exercises || [])[currentCircuitExerciseIndex] || null;
            }

            // If starting a manual sets exercise in work phase: play/pause video only, no interval
            if (effectiveEx && effectiveEx.type === 'sets' && state === 'work') {
                clearInterval(timer); timer = null;
                timerState = 'running';
                setStartButtonActive(true);
                if (pauseButton) pauseButton.disabled = false;
                playCurrentVideo();
                updateExerciseInfo();
                renderLeftPanelDetails();
                return;
            }

            // Otherwise start timed loop (time exercises or rest between sets)
            timerState = 'running';
            // ensure work state for first tick of time-based exercises
            if (state !== 'rest') state = 'work';
            setStartButtonActive(true);
            if (pauseButton) pauseButton.disabled = false;
            updatePhaseUI();

            // For time-based exercises, reset video to start time to ensure proper playback
            if (effectiveEx && effectiveEx.type !== 'sets') {
                resetVideoToStart();
            } else {
                playCurrentVideo();
            }

            timer = setInterval(timerLoop, 1000);
            updateExerciseInfo();
            renderLeftPanelDetails();
        }
    }

    function pauseTimer() {
        // Pause regardless of previous state: stop timer and pause video
        timerState = 'paused';
        clearInterval(timer);
        pauseCurrentVideo();
        // update button states: allow resuming with Start, disable Pause while paused
        setStartButtonActive(false);
        if (pauseButton) pauseButton.disabled = true;
        updateExerciseInfo();
        renderLeftPanelDetails();
    }

    function timerLoop() {
        if (timeLeft <= 4 && timeLeft >= 1) {
            // Only play warning beep when timer is running. For 'sets' exercises allow beep
            // only during timed rests (not during manual work).
            if (timerState === 'running') {
                // Check original routine reference (may be more authoritative than hydrated object)
                let originalExRef = null;
                if (currentRoutine && currentRoutine.name) {
                    const originalRoutine = routines.find(r => r.name === currentRoutine.name);
                    if (originalRoutine && Array.isArray(originalRoutine.exercises)) originalExRef = originalRoutine.exercises[currentExerciseIndex];
                }
                const hydratedEx = currentRoutine && currentRoutine.exercises ? currentRoutine.exercises[currentExerciseIndex] : null;
                const isSetsRef = originalExRef && originalExRef.type === 'sets';
                const isSetsHydrated = hydratedEx && hydratedEx.type === 'sets';
                const isSets = isSetsRef || isSetsHydrated;
                const allowForSets = isSets ? (state === 'rest') : true;
                if (allowForSets) playCountdownCue();
            }
        }

        if (timeLeft > 0) {
            timeLeft--;
            timeLeft = Math.max(timeLeft, 0);
            updateTimerDisplay();
            updateExerciseInfo();
            // refresh left panel each tick so elapsed/remaining is live
            try { renderLeftPanelDetails(); } catch (e) {}
            return;
        }

        // Play finish cue only if the timer was actively running (avoid repeated beeps when in manual 'sets' mode)
        if (timerState === 'running') {
            playFinishCue();
        }

        if (state === 'work') {
            // Check if we're in a circuit
            if (isInCircuit) {
                const circuit = currentRoutine.exercises[currentExerciseIndex];
                const circuitEx = circuit.exercises[currentCircuitExerciseIndex];
                
                if (circuitEx.type === 'sets') {
                    // Manual sets mode within circuit: stop interval so finish cue does not loop
                    clearInterval(timer); timer = null;
                    timerState = 'stopped';
                    setTimerDisplayManual();
                    updateExerciseInfo();
                    try { renderLeftPanelDetails(); } catch (e) {}
                    return;
                }
                
                // Time-based exercise in circuit
                const repeatCount = Math.max(1, sanitizeDuration(circuitEx.repeat, 1));
                
                // Handle rest or next repeat
                if (sanitizeDuration(circuitEx.rest, 0) > 0) {
                    state = 'rest';
                    timeLeft = sanitizeDuration(circuitEx.rest);
                    stopCurrentVideo();
                    updatePhaseUI();
                    updateTimerDisplay();
                    return;
                } else {
                    // No rest - advance to next repeat or next circuit exercise
                    if (currentRepeatIndex < repeatCount) {
                        currentRepeatIndex++;
                        state = 'work';
                        timeLeft = sanitizeDuration(circuitEx.work);
                        updatePhaseUI();
                        updateTimerDisplay();
                        resetVideoToStart();
                        return;
                    }
                    // Completed repeats - advance to next exercise in circuit
                    currentRepeatIndex = 1;
                    currentCircuitExerciseIndex++;
                    
                    // Check if more exercises in this round
                    if (currentCircuitExerciseIndex < circuit.exercises.length) {
                        const nextCircuitEx = circuit.exercises[currentCircuitExerciseIndex];
                        state = 'work';
                        
                        if (nextCircuitEx.type === 'sets') {
                            currentSetIndex = 1;
                            timeLeft = 0;
                            setTimerDisplayManual();
                            if (startButton) startButton.disabled = false;
                            if (pauseButton) pauseButton.disabled = true;
                            // detener intervalo para evitar beep al pasar a sets manual
                            clearInterval(timer); timer = null; timerState = 'stopped';
                        } else {
                            timeLeft = sanitizeDuration(nextCircuitEx.work);
                        }
                        
                        currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${nextCircuitEx.name}`;
                        updateTimerDisplay();
                        loadVideo(nextCircuitEx, true);
                        updatePhaseUI();
                        updateCompleteSetButtonVisibility();
                        try { renderLeftPanelDetails(); } catch (e) {}
                        return;
                    }
                    
                    // Completed all exercises in round - check if more rounds
                    currentCircuitExerciseIndex = 0;
                    currentCircuitRound++;
                    
                    if (currentCircuitRound <= circuit.rounds) {
                        // Rest between rounds
                        if (circuit.restBetweenRounds > 0) {
                            state = 'rest';
                            timeLeft = circuit.restBetweenRounds;
                            stopCurrentVideo();
                            currentExerciseTitle.textContent = `🔁 Descanso entre vueltas (${currentCircuitRound - 1}/${circuit.rounds} completada)`;
                            updatePhaseUI();
                            updateTimerDisplay();
                            return;
                        } else {
                            // No rest between rounds - start next round immediately
                            const firstEx = circuit.exercises[0];
                            state = 'work';
                            currentRepeatIndex = 1;
                            
                            if (firstEx.type === 'sets') {
                                currentSetIndex = 1;
                                timeLeft = 0;
                                setTimerDisplayManual();
                                if (startButton) startButton.disabled = false;
                                if (pauseButton) pauseButton.disabled = true;
                                clearInterval(timer); timer = null; timerState = 'stopped';
                            } else {
                                timeLeft = sanitizeDuration(firstEx.work);
                            }
                            
                            currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${firstEx.name}`;
                            updateTimerDisplay();
                            loadVideo(firstEx, true);
                            updatePhaseUI();
                            updateCompleteSetButtonVisibility();
                            try { renderLeftPanelDetails(); } catch (e) {}
                            return;
                        }
                    }
                    
                    // Completed all rounds - advance to next exercise in routine
                    isInCircuit = false;
                    currentCircuitRound = 1;
                    currentCircuitExerciseIndex = 0;
                    currentExerciseIndex++;
                    if (currentExerciseIndex < currentRoutine.exercises.length) {
                        const nextEx = currentRoutine.exercises[currentExerciseIndex];
                        if (nextEx && nextEx.type === 'sets') {
                            // moving to manual sets: stop interval and load without auto-playing timer
                            clearInterval(timer); timer = null; timerState = 'stopped';
                            loadExercise(false);
                        } else {
                            // keep interval running and auto-continue
                            loadExercise(true);
                        }
                    } else {
                        finishWorkout();
                    }
                    return;
                }
            }
            
            // Regular (non-circuit) exercise handling
            // Transition to rest (or next exercise) — only for time-mode exercises
            const ex = currentRoutine.exercises[currentExerciseIndex];
            if (!ex) {
                currentExerciseIndex++;
                if (currentExerciseIndex < currentRoutine.exercises.length) loadExercise(true);
                else finishWorkout();
                return;
            }
            if (ex.type === 'sets') {
                // Work for sets is manual — stop any running timer and show manual display
                clearInterval(timer); timer = null;
                timerState = 'stopped';
                setTimerDisplayManual();
                updateExerciseInfo();
                try { renderLeftPanelDetails(); } catch (e) {}
                return;
            }

            // time-mode: go to rest phase (or advance repeat/exercise if no rest)
            const repeatCount = Math.max(1, sanitizeDuration(ex.repeat, 1));
            if (sanitizeDuration(ex.rest, 0) > 0) {
                state = 'rest';
                timeLeft = sanitizeDuration(ex.rest);
                stopCurrentVideo();
                if (timeLeft > 0) {
                    updatePhaseUI();
                    updateTimerDisplay();
                }
            } else {
                // No rest: advance to next repeat or next exercise immediately
                if (currentRepeatIndex < repeatCount) {
                    currentRepeatIndex++;
                    // restart work for the same exercise
                    state = 'work';
                    timeLeft = sanitizeDuration(ex.work);
                    updatePhaseUI();
                    updateTimerDisplay();
                    resetVideoToStart();
                } else {
                    // completed all repeats -> move to next exercise
                    currentRepeatIndex = 1;
                    currentExerciseIndex++;
                    if (currentExerciseIndex < currentRoutine.exercises.length) loadExercise(true);
                    else finishWorkout();
                }
            }
        } else {
            // Currently in rest phase
            
            // Check if we're in a circuit
            if (isInCircuit) {
                const circuit = currentRoutine.exercises[currentExerciseIndex];
                const circuitEx = circuit.exercises[currentCircuitExerciseIndex];

                // 1. Descanso entre vueltas (verificar por el título actual, no por índices)
                const isRestBetweenRounds = currentExerciseTitle.textContent.includes('Descanso entre vueltas');
                if (isRestBetweenRounds) {
                    const firstEx = circuit.exercises[0];
                    state = 'work';
                    currentRepeatIndex = 1;
                    if (firstEx.type === 'sets') {
                        currentSetIndex = 1;
                        timeLeft = 0;
                        setTimerDisplayManual();
                        if (startButton) startButton.disabled = false;
                        if (pauseButton) pauseButton.disabled = true;
                        clearInterval(timer); timer = null; timerState = 'stopped';
                    } else {
                        timeLeft = sanitizeDuration(firstEx.work);
                    }
                    currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${firstEx.name}`;
                    updateTimerDisplay();
                    loadVideo(firstEx, true);
                    updatePhaseUI();
                    updateCompleteSetButtonVisibility();
                    try { renderLeftPanelDetails(); } catch (e) {}
                    return;
                }

                // 2. Descanso dentro de ejercicio por series (entre sets)
                if (circuitEx.type === 'sets') {
                    clearInterval(timer); timer = null; timerState = 'stopped';
                    const totalSets = Math.max(1, circuitEx.sets || 1);
                    currentSetIndex = (currentSetIndex || 1) + 1;
                    if (currentSetIndex <= totalSets) {
                        state = 'work';
                        setTimerDisplayManual();
                        updateExerciseInfo();
                        updateCompleteSetButtonVisibility();
                        try { renderLeftPanelDetails(); } catch (e) {}
                        return;
                    }
                    currentSetIndex = 1; currentRepeatIndex = 1; currentCircuitExerciseIndex++;
                    if (currentCircuitExerciseIndex < circuit.exercises.length) {
                        const nextCircuitEx = circuit.exercises[currentCircuitExerciseIndex];
                        state = 'work';
                        if (nextCircuitEx.type === 'sets') {
                            currentSetIndex = 1; timeLeft = 0; setTimerDisplayManual();
                            if (startButton) startButton.disabled = false; if (pauseButton) pauseButton.disabled = true;
                            clearInterval(timer); timer = null; timerState = 'stopped';
                        } else { timeLeft = sanitizeDuration(nextCircuitEx.work); }
                        currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${nextCircuitEx.name}`;
                        updateTimerDisplay(); loadVideo(nextCircuitEx, true); updatePhaseUI(); updateCompleteSetButtonVisibility(); try { renderLeftPanelDetails(); } catch (e) {}
                        return;
                    }
                    // Fin de vuelta tras sets
                    currentCircuitExerciseIndex = 0; currentCircuitRound++;
                    if (currentCircuitRound <= circuit.rounds) {
                        if (circuit.restBetweenRounds > 0) {
                            state = 'rest'; timeLeft = circuit.restBetweenRounds; stopCurrentVideo(); currentExerciseTitle.textContent = `🔁 Descanso entre vueltas (${currentCircuitRound - 1}/${circuit.rounds} completada)`; updatePhaseUI(); updateTimerDisplay(); return;
                        } else {
                            const firstEx = circuit.exercises[0]; state = 'work'; currentRepeatIndex = 1;
                            if (firstEx.type === 'sets') { currentSetIndex = 1; timeLeft = 0; setTimerDisplayManual(); if (startButton) startButton.disabled = false; if (pauseButton) pauseButton.disabled = true; } else { timeLeft = sanitizeDuration(firstEx.work); }
                            if (firstEx.type === 'sets') { clearInterval(timer); timer = null; timerState = 'stopped'; }
                            currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${firstEx.name}`; updateTimerDisplay(); loadVideo(firstEx, true); updatePhaseUI(); updateCompleteSetButtonVisibility(); try { renderLeftPanelDetails(); } catch (e) {}
                            return;
                        }
                    }
                    isInCircuit = false; currentCircuitRound = 1; currentCircuitExerciseIndex = 0; currentExerciseIndex++; if (currentExerciseIndex < currentRoutine.exercises.length) { loadExercise(true); } else { finishWorkout(); } return;
                }

                // 3. Descanso de ejercicio time (entre repeticiones o antes de avanzar)
                if (circuitEx.type === 'time') {
                    const repeatCount = Math.max(1, sanitizeDuration(circuitEx.repeat, 1));
                    if (currentRepeatIndex < repeatCount) {
                        currentRepeatIndex++; state = 'work'; timeLeft = sanitizeDuration(circuitEx.work); resetVideoToStart(); updatePhaseUI(); updateTimerDisplay(); try { renderLeftPanelDetails(); } catch (e) {} return;
                    }
                    currentRepeatIndex = 1; currentCircuitExerciseIndex++;
                    if (currentCircuitExerciseIndex < circuit.exercises.length) {
                        const nextCircuitEx = circuit.exercises[currentCircuitExerciseIndex]; state = 'work';
                        if (nextCircuitEx.type === 'sets') { currentSetIndex = 1; timeLeft = 0; setTimerDisplayManual(); if (startButton) startButton.disabled = false; if (pauseButton) pauseButton.disabled = true; } else { timeLeft = sanitizeDuration(nextCircuitEx.work); }
                        if (nextCircuitEx.type === 'sets') { clearInterval(timer); timer = null; timerState = 'stopped'; }
                        currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${nextCircuitEx.name}`; updateTimerDisplay(); loadVideo(nextCircuitEx, true); updatePhaseUI(); updateCompleteSetButtonVisibility(); try { renderLeftPanelDetails(); } catch (e) {} return;
                    }
                    // Fin de vuelta tras ejercicio time
                    currentCircuitExerciseIndex = 0; currentCircuitRound++;
                    if (currentCircuitRound <= circuit.rounds) {
                        if (circuit.restBetweenRounds > 0) { state = 'rest'; timeLeft = circuit.restBetweenRounds; stopCurrentVideo(); currentExerciseTitle.textContent = `🔁 Descanso entre vueltas (${currentCircuitRound - 1}/${circuit.rounds} completada)`; updatePhaseUI(); updateTimerDisplay(); return; }
                        else { const firstEx = circuit.exercises[0]; state = 'work'; currentRepeatIndex = 1; if (firstEx.type === 'sets') { currentSetIndex = 1; timeLeft = 0; setTimerDisplayManual(); if (startButton) startButton.disabled = false; if (pauseButton) pauseButton.disabled = true; } else { timeLeft = sanitizeDuration(firstEx.work); } currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${firstEx.name}`; updateTimerDisplay(); loadVideo(firstEx, true); updatePhaseUI(); updateCompleteSetButtonVisibility(); try { renderLeftPanelDetails(); } catch (e) {} return; }
                        if (firstEx.type === 'sets') { clearInterval(timer); timer = null; timerState = 'stopped'; }
                    }
                    // Salir del circuito tras última ronda
                    isInCircuit = false; currentCircuitRound = 1; currentCircuitExerciseIndex = 0; currentExerciseIndex++;
                    if (currentExerciseIndex < currentRoutine.exercises.length) {
                        const nextEx = currentRoutine.exercises[currentExerciseIndex];
                        if (nextEx && nextEx.type === 'sets') {
                            clearInterval(timer); timer = null; timerState = 'stopped';
                            loadExercise(false);
                        } else {
                            loadExercise(true);
                        }
                    } else { finishWorkout(); }
                    return;
                }
            }
            
            // Regular (non-circuit) exercise rest handling
            const ex = currentRoutine.exercises[currentExerciseIndex];
            if (ex && ex.type === 'sets') {
                // Finished rest between sets -> advance to next set (or next exercise)
                clearInterval(timer);
                timer = null;
                timerState = 'stopped';
                const totalSets = Math.max(1, ex.sets || 1);
                // move to next set
                currentSetIndex = (currentSetIndex || 1) + 1;
                if (currentSetIndex <= totalSets) {
                    // start next set as manual work
                    state = 'work';
                    setTimerDisplayManual();
                    updateExerciseInfo();
                    updateCompleteSetButtonVisibility();
                    try { renderLeftPanelDetails(); } catch (e) {}
                    return;
                }
                // completed all sets -> reset set index and advance to next exercise
                currentSetIndex = 1;
                if (currentExerciseIndex < currentRoutine.exercises.length - 1) {
                    currentExerciseIndex++;
                    loadExercise(true);
                    return;
                }
                // last exercise finished
                finishWorkout();
                return;
            }
            // time-mode standard behavior: advance to next exercise
            // handle repeats for time-mode
            if (ex) {
                const repeatCount = Math.max(1, sanitizeDuration(ex.repeat, 1));
                if (currentRepeatIndex < repeatCount) {
                    currentRepeatIndex++;
                    // start next repeat's work
                    state = 'work';
                    timeLeft = sanitizeDuration(ex.work);
                    resetVideoToStart();
                    updatePhaseUI();
                    updateTimerDisplay();
                    try { renderLeftPanelDetails(); } catch (e) {}
                    return;
                }
                // completed repeats -> reset repeat counter and advance
                currentRepeatIndex = 1;
            }
            currentExerciseIndex++;
            if (currentExerciseIndex < currentRoutine.exercises.length) loadExercise(true);
            else finishWorkout();
        }
    }
    function finishWorkout() { clearInterval(timer); timerState = 'stopped'; alertMessage("¡Rutina completada! ¡Excelente trabajo!"); resetWorkout('no_routine'); }

    startButton.addEventListener('click', startTimer);
    pauseButton.addEventListener('click', pauseTimer);
    resetExerciseButton.addEventListener('click', () => { if (!currentRoutine || !currentRoutine.exercises[currentExerciseIndex]) return; clearInterval(timer); timerState = 'stopped'; loadExercise(false); });

    const prevExerciseButton = document.getElementById('prevExerciseButton');
    const nextExerciseButton = document.getElementById('nextExerciseButton');
        const completeSetButton = document.getElementById('completeSetButton');

    function updateCompleteSetButtonVisibility() {
        if (!completeSetButton || !currentRoutine) return;
        const topEx = currentRoutine.exercises && currentRoutine.exercises[currentExerciseIndex];
        if (!topEx) { completeSetButton.style.display = 'none'; return; }

        // Determine the effective current exercise (handles circuits)
        let effectiveEx = topEx;
        if (isInCircuit && topEx.type === 'circuit') {
            const innerList = topEx.exercises || [];
            effectiveEx = innerList[currentCircuitExerciseIndex] || null;
        }

        // Show button only when current effective exercise is 'sets' and in work phase
        if (effectiveEx && effectiveEx.type === 'sets' && state === 'work') {
            completeSetButton.style.display = '';
        } else {
            completeSetButton.style.display = 'none';
        }
    }

    if (prevExerciseButton) prevExerciseButton.addEventListener('click', () => {
        if (!currentRoutine) return;
        
        // Navigate within circuit if active
        if (isInCircuit) {
            goToPreviousCircuitExercise();
        } else {
            // Check if we should navigate to previous exercise in routine
            if (currentExerciseIndex > 0) {
                const prevEx = currentRoutine.exercises[currentExerciseIndex - 1];
                
                // If previous exercise is a circuit, enter it at the last round, last exercise
                if (prevEx && prevEx.type === 'circuit') {
                    clearInterval(timer);
                    timerState = 'stopped';
                    currentExerciseIndex--;
                    
                    // Enter circuit at last round, last exercise
                    isInCircuit = true;
                    currentCircuitRound = prevEx.rounds;
                    currentCircuitExerciseIndex = prevEx.exercises.length - 1;
                    
                    const lastEx = prevEx.exercises[currentCircuitExerciseIndex];
                    if (!lastEx) return;
                    
                    state = 'work';
                    currentRepeatIndex = 1;
                    
                    if (lastEx.type === 'sets') {
                        currentSetIndex = 1;
                        timeLeft = 0;
                        setTimerDisplayManual();
                        if (startButton) startButton.disabled = false;
                        if (pauseButton) pauseButton.disabled = true;
                    } else {
                        timeLeft = sanitizeDuration(lastEx.work);
                        if (startButton) startButton.disabled = false;
                        if (pauseButton) pauseButton.disabled = true;
                    }
                    
                    currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${prevEx.rounds} - ${lastEx.name}`;
                    updateTimerDisplay();
                    loadVideo(lastEx, true); // Auto-play video for both time and sets
                    updatePhaseUI();
                    updateCompleteSetButtonVisibility();
                    renderLeftPanelDetails();
                    
                    // Auto-start timer for time-based exercises
                    if (lastEx.type !== 'sets') {
                        startTimer();
                    }
                    return;
                }
            }
            
            // Regular navigation
            goToPreviousExercise(true);
        }
    });
    
    if (nextExerciseButton) nextExerciseButton.addEventListener('click', () => {
        if (!currentRoutine) return;
        
        // Handle circuit navigation
        if (isInCircuit) {
            const circuit = currentRoutine.exercises[currentExerciseIndex];
            const circuitEx = circuit.exercises[currentCircuitExerciseIndex];
            if (circuitEx && circuitEx.type === 'sets' && state === 'work') {
                completeSet();
                return;
            }
            goToNextCircuitExercise();
            return;
        }
        
        // Regular exercise navigation
        const ex = currentRoutine.exercises[currentExerciseIndex];
        if (ex && ex.type === 'sets' && state === 'work') {
            // User confirms completion of a set
            completeSet();
            return;
        }
        // default behavior
        goToNextExercise(true);
    });
    if (completeSetButton) completeSetButton.addEventListener('click', () => completeSet());
    resetRoutineButton.addEventListener('click', () => { if (!currentRoutine) return; const routineName = routineSelect.value; if (!routineName) return; routineSelect.value = ''; routineSelect.value = routineName; const event = new Event('change'); routineSelect.dispatchEvent(event); });
    
    // Removed obsolete sidebar toggle buttons (new hamburger menu handles this)

    if (maximizeVideoButton) {
        maximizeVideoButton.addEventListener('click', async () => {
            const centerColumn = document.querySelector('.center-column');
            if (!centerColumn) return;
            
            if (!document.fullscreenElement) {
                try {
                    if (centerColumn.requestFullscreen) {
                        await centerColumn.requestFullscreen();
                    } else if (centerColumn.webkitRequestFullscreen) { /* Safari */
                        centerColumn.webkitRequestFullscreen();
                    } else if (centerColumn.msRequestFullscreen) { /* IE11 */
                        centerColumn.msRequestFullscreen();
                    }
                } catch (error) {
                    console.warn('Error al entrar en pantalla completa:', error);
                }
            } else {
                try {
                    if (document.exitFullscreen) {
                        await document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) { /* Safari */
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) { /* IE11 */
                        document.msExitFullscreen();
                    }
                } catch (error) {
                    console.warn('Error al salir de pantalla completa:', error);
                }
            }
        });
    }

    document.addEventListener('fullscreenchange', () => {
        const isNativeFullscreen = document.fullscreenElement === trainingPanel;
        if (isNativeFullscreen) {
            previousSidebarHidden = isSidebarHidden;
            setSidebarHidden(true);
            trainingPanel.classList.add('training-panel-fullscreen');
        } else if (!isFallbackFullscreen) {
            trainingPanel.classList.remove('training-panel-fullscreen');
            setSidebarHidden(previousSidebarHidden);
        }
        const isFullscreenActive = isNativeFullscreen || isFallbackFullscreen;
        if (!isNativeFullscreen && !isFallbackFullscreen) {
            trainingPanel.classList.remove('training-panel-fullscreen');
        }
        if (videoContainer) videoContainer.classList.toggle('full-width', isFullscreenActive);
        updateMaximizeButton(isFullscreenActive);
        updateExpandedLayoutState();
    });

    document.getElementById('manageRoutinesBtn').addEventListener('click',()=>routineModal.style.display='flex');
    document.getElementById('manageExercisesBtn').addEventListener('click',()=>exerciseModal.style.display='flex');
    document.querySelectorAll('.close-btn').forEach(btn=>btn.addEventListener('click',(e)=>e.target.closest('.modal').style.display='none'));
    window.addEventListener('click',(event)=>{if(event.target.classList.contains('modal'))event.target.style.display='none';});
    
    audioToggle.addEventListener('change', () => {
        const wasPlaying = isPlayerCurrentlyPlaying();
        isVideoMuted = !audioToggle.checked;
        localStorage.setItem(LOCAL_STORAGE_MUTE_KEY, JSON.stringify(isVideoMuted));
        syncPlayerMuteState({ resumeIfPlaying: true, wasPlaying });
        alertMessage(`Audio del video ${isVideoMuted ? 'desactivado' : 'activado'}.`);
    });

    editRoutineSelect.addEventListener('change',(e)=>{
        const routineName=e.target.value; 
        deleteRoutineBtn.style.display=routineName?'block':'none'; 
        if(!routineName){
            routineNameInput.value='';
            tempExercises=[];
        } else {
            const routine=routines.find(r=>r.name===routineName); 
            routineNameInput.value=routine.name; 
            tempExercises=[...routine.exercises];
        } 
        renderTempExercises();
    });
    // Toggle fields between 'time' and 'sets' mode in the modal
    const exerciseModeInput = document.getElementById('exerciseModeInput');
    const setsCountInput = document.getElementById('setsCountInput');
    const repsInput = document.getElementById('repsInput');
    const restBetweenSetsInput = document.getElementById('restBetweenSetsInput');
    const timeFieldsWork = document.getElementById('timeFields_work');
    const timeFieldsRest = document.getElementById('timeFields_rest');
    const setFields = document.getElementById('setFields');

    function toggleExerciseModeFields() {
        const mode = (exerciseModeInput && exerciseModeInput.value) || 'time';
        if (!timeFieldsWork || !timeFieldsRest || !setFields) return;
        const showSets = mode === 'sets';
        setFields.classList.toggle('hidden', !showSets);
        timeFieldsWork.classList.toggle('hidden', showSets);
        timeFieldsRest.classList.toggle('hidden', showSets);
    }
    exerciseModeInput && exerciseModeInput.addEventListener('change', toggleExerciseModeFields);
    toggleExerciseModeFields();

    // Add exercise supporting both 'time' and 'sets' types
    document.getElementById('addExerciseBtn').addEventListener('click',()=>{
        const id = exerciseSelect.value;
        if (!id) {
            alertMessage('Selecciona un ejercicio antes de añadirlo.', 'warning');
            return;
        }
        const mode = (exerciseModeInput && exerciseModeInput.value) || 'time';
        if (mode === 'time') {
            const workInput = document.getElementById('workTimeInput');
            const restInput = document.getElementById('restTimeInput');
            const repeatInput = document.getElementById('timeRepeatInput');
            const work = sanitizeDuration(workInput.value, 30);
            const rest = sanitizeDuration(restInput.value, 0);
            const repeat = Math.max(1, sanitizeDuration(repeatInput && repeatInput.value ? repeatInput.value : 1, 1));
            if (work <= 0) {
                alertMessage('El tiempo de trabajo debe ser mayor a cero.', 'warning');
                return;
            }
            workInput.value = work;
            restInput.value = rest;
            if (repeatInput) repeatInput.value = repeat;
            tempExercises.push({ exerciseId: id, type: 'time', work, rest, repeat });
        } else {
            const sets = Math.max(1, sanitizeDuration(setsCountInput.value, 3));
            const reps = Math.max(1, sanitizeDuration(repsInput.value, 10));
            const restBetweenSets = Math.max(0, sanitizeDuration(restBetweenSetsInput.value, 60));
            tempExercises.push({ exerciseId: id, type: 'sets', sets, reps, restBetweenSets });
        }
        renderTempExercises();
    });
    routineExercisesList.addEventListener('click',(e)=>{ 
        const target = e.target.closest('button'); 
        if (!target) return; 
        const index = parseInt(target.dataset.index, 10); 
        if (Number.isNaN(index)) return; 
        
        // Handle edit circuit button
        if (target.classList.contains('edit-circuit-btn')) {
            const circuit = tempExercises[index];
            if (circuit && circuit.type === 'circuit') {
                // Store the index we're editing
                window.editingCircuitIndex = index;
                // Load circuit data into modal
                tempCircuitExercises = [...circuit.exercises];
                circuitRoundsInput.value = circuit.rounds;
                circuitRestInput.value = circuit.restBetweenRounds;
                renderCircuitExercises();
                circuitModal.style.display = 'flex';
            }
            return;
        }
        
        if (target.classList.contains('remove-ex-btn')) tempExercises.splice(index, 1); 
        else if (target.classList.contains('move-up-btn') && index > 0) [tempExercises[index], tempExercises[index - 1]] = [tempExercises[index - 1], tempExercises[index]]; 
        else if (target.classList.contains('move-down-btn') && index < tempExercises.length - 1) [tempExercises[index], tempExercises[index + 1]] = [tempExercises[index + 1], tempExercises[index]]; 
        renderTempExercises(); 
    });

    routineExercisesList.addEventListener('input', (e) => {
        const target = e.target;
        if (!target.classList.contains('routine-time-input')) return;
        const index = parseInt(target.dataset.index, 10);
        const field = target.dataset.field;
        if (Number.isNaN(index) || !tempExercises[index]) return;
        const ex = tempExercises[index];
        if (!ex) return;
        if (field === 'work' || field === 'rest') {
            const defaultValue = field === 'work' ? 30 : 0;
            const sanitizedValue = sanitizeDuration(target.value, defaultValue);
            tempExercises[index][field] = sanitizedValue;
            target.value = sanitizedValue;
        } else if (field === 'sets') {
            const sanitized = Math.max(1, sanitizeDuration(target.value, 1));
            ex.sets = sanitized; target.value = sanitized; ex.type = 'sets';
        } else if (field === 'reps') {
            const sanitized = Math.max(1, sanitizeDuration(target.value, 1));
            ex.reps = sanitized; target.value = sanitized; ex.type = 'sets';
        } else if (field === 'restBetweenSets') {
            const sanitized = Math.max(0, sanitizeDuration(target.value, 0));
            ex.restBetweenSets = sanitized; target.value = sanitized; ex.type = 'sets';
        } else if (field === 'repeat') {
            const sanitized = Math.max(1, sanitizeDuration(target.value, 1));
            ex.repeat = sanitized; target.value = sanitized; ex.type = ex.type || 'time';
        }
    });

    // Drag and drop for routine exercises
    let draggedRoutineExIndex = null;

    routineExercisesList.addEventListener('dragstart', (e) => {
        const li = e.target.closest('li[draggable="true"]');
        if (!li) return;
        draggedRoutineExIndex = parseInt(li.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        li.style.opacity = '0.4';
    });

    routineExercisesList.addEventListener('dragend', (e) => {
        const li = e.target.closest('li[draggable="true"]');
        if (li) li.style.opacity = '1';
        draggedRoutineExIndex = null;
    });

    routineExercisesList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    routineExercisesList.addEventListener('drop', (e) => {
        e.preventDefault();
        const li = e.target.closest('li[draggable="true"]');
        if (!li || draggedRoutineExIndex === null) return;
        
        const dropIndex = parseInt(li.dataset.index, 10);
        if (draggedRoutineExIndex === dropIndex) return;
        
        // Reorder array
        const draggedItem = tempExercises[draggedRoutineExIndex];
        tempExercises.splice(draggedRoutineExIndex, 1);
        
        // Adjust drop index if needed
        const newIndex = draggedRoutineExIndex < dropIndex ? dropIndex - 1 : dropIndex;
        tempExercises.splice(newIndex, 0, draggedItem);
        
        renderTempExercises();
    });

    function renderTempExercises() {
        routineExercisesList.innerHTML = tempExercises.map((ex, i) => {
            // Handle circuits differently
            if (ex.type === 'circuit') {
                const circuitExercises = ex.exercises || [];
                const exercisesList = circuitExercises.map(cEx => {
                    const libEx = exercises[cEx.exerciseId];
                    return libEx ? libEx.name : 'Ejercicio no encontrado';
                }).join(', ');
                
                return `<li class="bg-indigo-900/30 border-2 border-indigo-500/50 rounded-lg p-3 mb-2 cursor-move" draggable="true" data-index="${i}">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-start gap-3">
                                    <div class="flex flex-col">
                                        <button data-index="${i}" class="move-up-btn text-gray-400 hover:text-white ${i === 0 ? 'invisible' : ''}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg></button>
                                        <button data-index="${i}" class="move-down-btn text-gray-400 hover:text-white ${i === tempExercises.length - 1 ? 'invisible' : ''}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></button>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <span class="font-semibold text-sm sm:text-base text-indigo-300">🔁 CIRCUITO - ${ex.rounds} vueltas</span>
                                        <div class="text-xs text-gray-300 mt-1">${circuitExercises.length} ejercicios: ${exercisesList}</div>
                                        <div class="text-xs text-gray-400 mt-1">Descanso entre vueltas: ${ex.restBetweenRounds}s</div>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    <button data-index="${i}" class="edit-circuit-btn text-indigo-400 hover:text-indigo-300 text-sm">✏️ Editar</button>
                                    <button data-index="${i}" class="remove-ex-btn text-red-400 hover:text-red-300 font-bold p-1">X</button>
                                </div>
                            </div>
                        </li>`;
            }
            
            // Regular exercise handling
            const libraryExercise = exercises[ex.exerciseId];
            // Normalize time fields for display when type === 'time'
            if (ex.type === 'time' || !ex.type) {
                const sanitizedWork = sanitizeDuration(ex.work, 30);
                const sanitizedRest = sanitizeDuration(ex.rest, 0);
                tempExercises[i].type = 'time';
                tempExercises[i].work = sanitizedWork;
                tempExercises[i].rest = sanitizedRest;
            }
            const nameContent = libraryExercise ? `<span class="font-semibold text-sm sm:text-base">${libraryExercise.name}</span>` : `<span class="flex items-center text-red-400 text-sm sm:text-base" title="ID: ${ex.exerciseId}"><svg class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-3a1 1 0 001 1h0a1 1 0 001-1V8a1 1 0 00-2 0v2z" clip-rule="evenodd" /></svg>Ejercicio no encontrado</span>`;
            let fieldsHtml = '';
            if (ex.type === 'sets') {
                const sets = sanitizeDuration(ex.sets, 3);
                const reps = sanitizeDuration(ex.reps, 10);
                const rbs = sanitizeDuration(ex.restBetweenSets, 60);
                tempExercises[i].sets = sets; tempExercises[i].reps = reps; tempExercises[i].restBetweenSets = rbs;
                fieldsHtml = `<div class="flex flex-wrap gap-3 mt-3 pl-8 sm:pl-10 text-gray-300">
                                <label class="flex items-center gap-2 text-xs sm:text-sm"><span>Series</span><input type="number" min="1" class="routine-time-input w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" data-index="${i}" data-field="sets" value="${sets}"></label>
                                <label class="flex items-center gap-2 text-xs sm:text-sm"><span>Reps</span><input type="number" min="1" class="routine-time-input w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" data-index="${i}" data-field="reps" value="${reps}"></label>
                                <label class="flex items-center gap-2 text-xs sm:text-sm"><span>Descanso s/serie</span><input type="number" min="0" class="routine-time-input w-28 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" data-index="${i}" data-field="restBetweenSets" value="${rbs}"></label>
                              </div>`;
            } else {
                const sanitizedWork = sanitizeDuration(ex.work, 30);
                const sanitizedRest = sanitizeDuration(ex.rest, 0);
                const sanitizedRepeat = Math.max(1, sanitizeDuration(ex.repeat, 1));
                tempExercises[i].repeat = sanitizedRepeat;
                fieldsHtml = `<div class="flex flex-wrap gap-3 mt-3 pl-8 sm:pl-10 text-gray-300"><label class="flex items-center gap-2 text-xs sm:text-sm"><span>Trabajo (s)</span><input type="number" min="1" class="routine-time-input w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" data-index="${i}" data-field="work" value="${sanitizedWork}"></label><label class="flex items-center gap-2 text-xs sm:text-sm"><span>Descanso (s)</span><input type="number" min="0" class="routine-time-input w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" data-index="${i}" data-field="rest" value="${sanitizedRest}"></label><label class="flex items-center gap-2 text-xs sm:text-sm"><span>Repeticiones</span><input type="number" min="1" class="routine-time-input w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" data-index="${i}" data-field="repeat" value="${sanitizedRepeat}"></label></div>`;
            }

            return `<li class="bg-gray-700/20 rounded-lg p-3 mb-2 cursor-move" draggable="true" data-index="${i}">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex items-start gap-3">
                                <div class="flex flex-col">
                                    <button data-index="${i}" class="move-up-btn text-gray-400 hover:text-white ${i === 0 ? 'invisible' : ''}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg></button>
                    <button data-index="${i}" class="move-down-btn text-gray-400 hover:text-white ${i === tempExercises.length - 1 ? 'invisible' : ''}"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></button>
                                </div>
                                <div class="min-w-0">${nameContent}</div>
                            </div>
                            <button data-index="${i}" class="remove-ex-btn text-red-400 hover:text-red-300 font-bold p-1">X</button>
                        </div>
                        ${fieldsHtml}
                    </li>`;
        }).join('');
        if (tempExercises.length === 0) {
            routineExercisesList.innerHTML = '<li class="text-sm text-gray-400">Añade ejercicios para construir tu rutina.</li>';
        }
    }

    document.getElementById('saveRoutineBtn').addEventListener('click',async()=>{
        const name=routineNameInput.value.trim();
        if(!name){alertMessage("La rutina debe tener un nombre.", 'warning');return;}
        if(tempExercises.length === 0){alertMessage("Añade al menos un ejercicio.", 'warning');return;}
        // Persist exercises preserving 'type' and relevant fields, including circuits
        const leanExercises = tempExercises.map(ex => {
            if (ex.type === 'circuit') {
                // Save circuit with all its exercises
                return {
                    type: 'circuit',
                    rounds: ex.rounds,
                    restBetweenRounds: ex.restBetweenRounds,
                    exercises: ex.exercises.map(cEx => {
                        // Use 'id' or 'exerciseId' (hydrated exercises use 'id')
                        const exId = cEx.exerciseId || cEx.id;
                        if (cEx.type === 'sets') {
                            return { exerciseId: exId, type: 'sets', sets: cEx.sets, reps: cEx.reps, restBetweenSets: cEx.restBetweenSets };
                        }
                        return { exerciseId: exId, type: 'time', work: cEx.work, rest: cEx.rest, repeat: Math.max(1, cEx.repeat || 1) };
                    })
                };
            }
            // Use 'id' or 'exerciseId' (hydrated exercises use 'id')
            const exId = ex.exerciseId || ex.id;
            if (ex.type === 'sets') {
                return { exerciseId: exId, type: 'sets', sets: ex.sets, reps: ex.reps, restBetweenSets: ex.restBetweenSets };
            }
            return { exerciseId: exId, type: 'time', work: ex.work, rest: ex.rest, repeat: Math.max(1, ex.repeat || 1) };
        });
        const routine = {name, exercises: leanExercises};
        const index = routines.findIndex(r => r.name === name);
        if (index > -1) routines[index] = routine; else routines.push(routine);
        populateAllSelects();
        saveData();
        routineModal.style.display='none';
        alertMessage("Rutina guardada (en esta sesión). Usa Exportar para un guardado permanente.");
    });
    deleteRoutineBtn.addEventListener('click',async()=>{ const name=editRoutineSelect.value; if(!name)return; if(confirm(`¿Seguro que quieres eliminar "${name}"?`)){ routines = routines.filter(r => r.name !== name); populateAllSelects(); saveData(); routineModal.style.display='none'; alertMessage("Rutina eliminada (en esta sesión).", 'warning'); } });
    
    // Circuit Editor Logic
    const circuitModal = document.getElementById('circuitModal');
    const circuitRoundsInput = document.getElementById('circuitRoundsInput');
    const circuitRestInput = document.getElementById('circuitRestInput');
    const circuitExerciseSelect = document.getElementById('circuitExerciseSelect');
    const circuitExerciseModeInput = document.getElementById('circuitExerciseModeInput');
    const circuitExercisesList = document.getElementById('circuitExercisesList');
    const circuitTimeFieldsWork = document.getElementById('circuitTimeFields_work');
    const circuitTimeFieldsRest = document.getElementById('circuitTimeFields_rest');
    const circuitSetFields = document.getElementById('circuitSetFields');

    // Toggle fields for circuit exercise mode
    function toggleCircuitExerciseModeFields() {
        const mode = (circuitExerciseModeInput && circuitExerciseModeInput.value) || 'time';
        const showSets = mode === 'sets';
        if (circuitSetFields) circuitSetFields.classList.toggle('hidden', !showSets);
        if (circuitTimeFieldsWork) circuitTimeFieldsWork.classList.toggle('hidden', showSets);
        if (circuitTimeFieldsRest) circuitTimeFieldsRest.classList.toggle('hidden', showSets);
    }
    circuitExerciseModeInput && circuitExerciseModeInput.addEventListener('change', toggleCircuitExerciseModeFields);
    toggleCircuitExerciseModeFields();

    // Open circuit editor
    document.getElementById('addCircuitBtn').addEventListener('click', () => {
        window.editingCircuitIndex = undefined; // Reset editing index
        tempCircuitExercises = [];
        circuitRoundsInput.value = 3;
        circuitRestInput.value = 60;
        renderCircuitExercises();
        // Populate circuit exercise selector
        circuitExerciseSelect.innerHTML = '<option value="">--Seleccionar ejercicio--</option>' + 
            Object.keys(exercises).map(id => `<option value="${id}">${exercises[id].name}</option>`).join('');
        circuitModal.style.display = 'flex';
    });

    // Add exercise to circuit
    document.getElementById('addExerciseToCircuitBtn').addEventListener('click', () => {
        const id = circuitExerciseSelect.value;
        if (!id) {
            alertMessage('Selecciona un ejercicio.', 'warning');
            return;
        }
        const mode = (circuitExerciseModeInput && circuitExerciseModeInput.value) || 'time';
        if (mode === 'time') {
            const workInput = document.getElementById('circuitWorkTimeInput');
            const restInput = document.getElementById('circuitRestTimeInput');
            const repeatInput = document.getElementById('circuitTimeRepeatInput');
            const work = sanitizeDuration(workInput.value, 30);
            const rest = sanitizeDuration(restInput.value, 0);
            const repeat = Math.max(1, sanitizeDuration(repeatInput && repeatInput.value ? repeatInput.value : 1, 1));
            if (work <= 0) {
                alertMessage('El tiempo de trabajo debe ser mayor a cero.', 'warning');
                return;
            }
            workInput.value = work;
            restInput.value = rest;
            if (repeatInput) repeatInput.value = repeat;
            tempCircuitExercises.push({ exerciseId: id, type: 'time', work, rest, repeat });
        } else {
            const setsInput = document.getElementById('circuitSetsCountInput');
            const repsInput = document.getElementById('circuitRepsInput');
            const restBetweenSetsInput = document.getElementById('circuitRestBetweenSetsInput');
            const sets = Math.max(1, sanitizeDuration(setsInput.value, 3));
            const reps = Math.max(1, sanitizeDuration(repsInput.value, 10));
            const restBetweenSets = Math.max(0, sanitizeDuration(restBetweenSetsInput.value, 60));
            tempCircuitExercises.push({ exerciseId: id, type: 'sets', sets, reps, restBetweenSets });
        }
        renderCircuitExercises();
    });

    // Render circuit exercises list
    function renderCircuitExercises() {
        circuitExercisesList.innerHTML = tempCircuitExercises.map((ex, i) => {
            const libraryExercise = exercises[ex.exerciseId];
            const nameContent = libraryExercise ? `<span class="font-semibold text-sm">${libraryExercise.name}</span>` : `<span class="text-red-400 text-sm">Ejercicio no encontrado</span>`;
            
            // Build editable fields based on type
            let fieldsHtml = '';
            if (ex.type === 'sets') {
                const sets = ex.sets || 3;
                const reps = ex.reps || 10;
                const restBetweenSets = ex.restBetweenSets || 60;
                fieldsHtml = `<div class="flex flex-wrap gap-3 mt-3 pl-8 sm:pl-10 text-gray-300">
                                <label class="flex items-center gap-2 text-xs sm:text-sm">
                                    <span>Series</span>
                                    <input type="number" min="1" class="circuit-ex-field w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                                           data-index="${i}" data-field="sets" value="${sets}">
                                </label>
                                <label class="flex items-center gap-2 text-xs sm:text-sm">
                                    <span>Reps</span>
                                    <input type="number" min="1" class="circuit-ex-field w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                                           data-index="${i}" data-field="reps" value="${reps}">
                                </label>
                                <label class="flex items-center gap-2 text-xs sm:text-sm">
                                    <span>Descanso s/serie</span>
                                    <input type="number" min="0" class="circuit-ex-field w-28 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                                           data-index="${i}" data-field="restBetweenSets" value="${restBetweenSets}">
                                </label>
                              </div>`;
            } else {
                const work = ex.work || 30;
                const rest = ex.rest || 0;
                const repeat = ex.repeat || 1;
                fieldsHtml = `<div class="flex flex-wrap gap-3 mt-3 pl-8 sm:pl-10 text-gray-300">
                                <label class="flex items-center gap-2 text-xs sm:text-sm">
                                    <span>Trabajo (s)</span>
                                    <input type="number" min="1" class="circuit-ex-field w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                                           data-index="${i}" data-field="work" value="${work}">
                                </label>
                                <label class="flex items-center gap-2 text-xs sm:text-sm">
                                    <span>Descanso (s)</span>
                                    <input type="number" min="0" class="circuit-ex-field w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                                           data-index="${i}" data-field="rest" value="${rest}">
                                </label>
                                <label class="flex items-center gap-2 text-xs sm:text-sm">
                                    <span>Repeticiones</span>
                                    <input type="number" min="1" class="circuit-ex-field w-20 px-2 py-1 rounded-md bg-[#111827] border border-gray-600 focus:border-indigo-500 focus:outline-none" 
                                           data-index="${i}" data-field="repeat" value="${repeat}">
                                </label>
                              </div>`;
            }
            
            return `<li class="bg-gray-700/20 rounded-lg p-3 mb-2 cursor-move" draggable="true" data-index="${i}">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex items-start gap-3 flex-1">
                                <div class="flex flex-col">
                                    <button data-index="${i}" class="move-circuit-ex-up text-gray-400 hover:text-white ${i === 0 ? 'invisible' : ''}">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                                        </svg>
                                    </button>
                                    <button data-index="${i}" class="move-circuit-ex-down text-gray-400 hover:text-white ${i === tempCircuitExercises.length - 1 ? 'invisible' : ''}">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                        </svg>
                                    </button>
                                </div>
                                <div class="flex-1">
                                    ${nameContent}
                                </div>
                            </div>
                            <button data-index="${i}" class="remove-circuit-ex-btn text-red-400 hover:text-red-300 font-bold p-1">X</button>
                        </div>
                        ${fieldsHtml}
                    </li>`;
        }).join('');
        if (tempCircuitExercises.length === 0) {
            circuitExercisesList.innerHTML = '<li class="text-sm text-gray-400">Añade ejercicios al circuito.</li>';
        }
    }

    // Handle circuit exercises list actions
    circuitExercisesList.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const index = parseInt(target.dataset.index, 10);
        if (Number.isNaN(index)) return;
        
        // Remove exercise
        if (target.classList.contains('remove-circuit-ex-btn')) {
            tempCircuitExercises.splice(index, 1);
            renderCircuitExercises();
            return;
        }
        
        // Move up
        if (target.classList.contains('move-circuit-ex-up') && index > 0) {
            [tempCircuitExercises[index], tempCircuitExercises[index - 1]] = [tempCircuitExercises[index - 1], tempCircuitExercises[index]];
            renderCircuitExercises();
            return;
        }
        
        // Move down
        if (target.classList.contains('move-circuit-ex-down') && index < tempCircuitExercises.length - 1) {
            [tempCircuitExercises[index], tempCircuitExercises[index + 1]] = [tempCircuitExercises[index + 1], tempCircuitExercises[index]];
            renderCircuitExercises();
            return;
        }
    });

    // Handle input changes in circuit exercises
    circuitExercisesList.addEventListener('input', (e) => {
        const target = e.target;
        if (!target.classList.contains('circuit-ex-field')) return;
        
        const index = parseInt(target.dataset.index, 10);
        const field = target.dataset.field;
        
        if (Number.isNaN(index) || !tempCircuitExercises[index]) return;
        
        const ex = tempCircuitExercises[index];
        const value = parseInt(target.value, 10);
        
        if (!Number.isNaN(value) && value >= 0) {
            ex[field] = value;
        }
    });

    // Drag and drop for circuit exercises
    let draggedCircuitExIndex = null;

    circuitExercisesList.addEventListener('dragstart', (e) => {
        const li = e.target.closest('li[draggable="true"]');
        if (!li) return;
        draggedCircuitExIndex = parseInt(li.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        li.style.opacity = '0.4';
    });

    circuitExercisesList.addEventListener('dragend', (e) => {
        const li = e.target.closest('li[draggable="true"]');
        if (li) li.style.opacity = '1';
        draggedCircuitExIndex = null;
    });

    circuitExercisesList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    circuitExercisesList.addEventListener('drop', (e) => {
        e.preventDefault();
        const li = e.target.closest('li[draggable="true"]');
        if (!li || draggedCircuitExIndex === null) return;
        
        const dropIndex = parseInt(li.dataset.index, 10);
        if (draggedCircuitExIndex === dropIndex) return;
        
        // Reorder array
        const draggedItem = tempCircuitExercises[draggedCircuitExIndex];
        tempCircuitExercises.splice(draggedCircuitExIndex, 1);
        
        // Adjust drop index if needed
        const newIndex = draggedCircuitExIndex < dropIndex ? dropIndex - 1 : dropIndex;
        tempCircuitExercises.splice(newIndex, 0, draggedItem);
        
        renderCircuitExercises();
    });

    // Save circuit and add to routine (or update if editing)
    document.getElementById('saveCircuitBtn').addEventListener('click', () => {
        const rounds = Math.max(1, parseInt(circuitRoundsInput.value, 10) || 3);
        const restBetweenRounds = Math.max(0, parseInt(circuitRestInput.value, 10) || 60);
        
        if (tempCircuitExercises.length === 0) {
            alertMessage('El circuito debe tener al menos un ejercicio.', 'warning');
            return;
        }

        const circuit = {
            type: 'circuit',
            rounds,
            restBetweenRounds,
            exercises: [...tempCircuitExercises]
        };

        // Check if we're editing an existing circuit
        if (typeof window.editingCircuitIndex === 'number' && window.editingCircuitIndex >= 0) {
            tempExercises[window.editingCircuitIndex] = circuit;
            window.editingCircuitIndex = undefined;
            alertMessage('Circuito actualizado.');
        } else {
            tempExercises.push(circuit);
            alertMessage('Circuito añadido a la rutina.');
        }
        
        renderTempExercises();
        circuitModal.style.display = 'none';
    });

    document.getElementById('saveExerciseBtn').addEventListener('click', async () => { let id = exerciseIdInput.value.trim(); const name = exerciseNameInput.value.trim(); const videoId = exerciseVideoIdInput.value.trim(); const start = parseInt(videoStartInput.value, 10) || null; const end = parseInt(videoEndInput.value, 10) || null; if (!name || !videoId) { alertMessage("Debe tener nombre y ID de video.", 'warning'); return; } if (!id) id = name.toLowerCase().replace(/[^a-z0-9]/g, ''); const exerciseData = { name, videoId }; if (start) exerciseData.start = start; if (end) exerciseData.end = end; exercises[id] = exerciseData; populateAllSelects(); saveData(); exerciseIdInput.value = ''; exerciseNameInput.value = ''; exerciseVideoIdInput.value = ''; videoStartInput.value = ''; videoEndInput.value = ''; alertMessage("Ejercicio guardado (en esta sesión)."); });
    exerciseLibraryList.addEventListener('click',async(e)=>{ const id=e.target.dataset.id; if(e.target.classList.contains('edit-ex-btn')){ const ex=exercises[id]; exerciseIdInput.value=id; exerciseNameInput.value=ex.name; exerciseVideoIdInput.value=ex.videoId; videoStartInput.value = ex.start || ''; videoEndInput.value = ex.end || ''; } if(e.target.classList.contains('delete-ex-btn')){ if(confirm(`¿Seguro que quieres eliminar "${exercises[id].name}"?`)){ delete exercises[id]; routines.forEach(r => { r.exercises = r.exercises.filter(ex => ex.exerciseId !== id); }); populateAllSelects(); saveData(); alertMessage("Ejercicio eliminado (en esta sesión).", 'warning'); } } });
    
    routineSelect.addEventListener('change',(e)=>{
        if(!e.target.value){ currentRoutine=null; startButton.disabled=true; resetWorkout('no_routine'); return; } 
        const selectedRoutine = routines.find(r => r.name === e.target.value);
        if (!selectedRoutine) return;
        const validExercises = selectedRoutine.exercises.map(ex => getHydratedExerciseFromRef(ex)).filter(Boolean);
        currentRoutine = { ...selectedRoutine, exercises: validExercises };
        let status = 'ok';
        if (selectedRoutine.exercises.length === 0) status = 'empty';
        else if (validExercises.length === 0) status = 'all_invalid';
        else if (validExercises.length < selectedRoutine.exercises.length) alertMessage(`${selectedRoutine.exercises.length - validExercises.length} ejercicio(s) no son válidos y se omitirán.`, 'warning');
        startButton.disabled = currentRoutine.exercises.length === 0; 
        resetWorkout(status);
    });
    
    exportBtn.addEventListener('click', () => {
        const dataToExport = { exercises, routines };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "hiit_trainer_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        alertMessage('Datos exportados con éxito.');
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (isValidDataShape(data)) {
                    importedData = normalizeDataPayload(data);
                    importModal.style.display = 'flex';
                } else { alertMessage('El archivo de importación no es válido.', 'error'); }
            } catch (err) { alertMessage('Error al leer el archivo.', 'error'); }
        };
        reader.readAsText(file);
        importFile.value = '';
    });
    
    replaceBtn.addEventListener('click', async () => {
         if (!importedData) return;
         exercises = importedData.exercises;
         routines = importedData.routines;
         populateAllSelects();
         saveData(true);
         importModal.style.display = 'none';
         importedData = null;
         alertMessage('Datos reemplazados con éxito.');
    });

    mergeBtn.addEventListener('click', async () => {
        if (!importedData) return;
        let overwrittenRoutines = 0;
        let newRoutines = 0;

        Object.entries(importedData.exercises).forEach(([id, exercise]) => {
            exercises[id] = exercise;
        });

        importedData.routines.forEach(newRoutine => {
            const existingIndex = routines.findIndex(r => r.name === newRoutine.name);
            if (existingIndex > -1) {
                routines[existingIndex] = newRoutine;
                overwrittenRoutines++;
            } else {
                routines.push(newRoutine);
                newRoutines++;
            }
        });
        populateAllSelects();
        saveData(true);
    importModal.style.display = 'none';
    importedData = null;
        let summary = 'Datos fusionados con éxito.';
        if (newRoutines > 0 || overwrittenRoutines > 0) {
            summary += ` Rutinas nuevas: ${newRoutines}. Rutinas actualizadas: ${overwrittenRoutines}.`;
        }
        alertMessage(summary);
    });

    function getHydratedExerciseFromRef(exRef) {
        // Handle circuits
        if (exRef && exRef.type === 'circuit') {
            const hydratedCircuitExercises = (exRef.exercises || []).map(cExRef => {
                const libraryEx = exercises[cExRef.exerciseId];
                if (!libraryEx) {
                    console.warn(`Exercise "${cExRef.exerciseId}" not found in library for circuit`);
                    return null;
                }
                if (cExRef.type === 'sets') {
                    return {
                        ...libraryEx,
                        id: cExRef.exerciseId,
                        type: 'sets',
                        sets: Math.max(1, sanitizeDuration(cExRef.sets, 3)),
                        reps: Math.max(1, sanitizeDuration(cExRef.reps, 10)),
                        restBetweenSets: Math.max(0, sanitizeDuration(cExRef.restBetweenSets, 60))
                    };
                }
                return {
                    ...libraryEx,
                    id: cExRef.exerciseId,
                    type: 'time',
                    work: sanitizeDuration(cExRef.work, 30),
                    rest: sanitizeDuration(cExRef.rest, 0),
                    repeat: Math.max(1, sanitizeDuration(cExRef.repeat, 1))
                };
            }).filter(Boolean);

            // Return null if circuit has no valid exercises
            if (hydratedCircuitExercises.length === 0) {
                console.warn('Circuit has no valid exercises');
                return null;
            }

            // Warn if some exercises were filtered out
            if (hydratedCircuitExercises.length < (exRef.exercises || []).length) {
                const missing = (exRef.exercises || []).length - hydratedCircuitExercises.length;
                console.warn(`${missing} exercise(s) in circuit were not found in library`);
            }

            return {
                type: 'circuit',
                rounds: Math.max(1, exRef.rounds || 3),
                restBetweenRounds: Math.max(0, exRef.restBetweenRounds || 60),
                exercises: hydratedCircuitExercises
            };
        }

        // Handle regular exercises
        if (!exRef || !exRef.exerciseId) return null;
        const libraryEx = exercises[exRef.exerciseId];
        if (!libraryEx) return null;
        // For 'sets' items we keep sets/reps/restBetweenSets
        if (exRef.type === 'sets') {
            return {
                ...libraryEx,
                id: exRef.exerciseId,
                type: 'sets',
                sets: Math.max(1, sanitizeDuration(exRef.sets, exRef.count || 3)),
                reps: Math.max(1, sanitizeDuration(exRef.reps, 10)),
                restBetweenSets: Math.max(0, sanitizeDuration(exRef.restBetweenSets, exRef.rest || 60))
            };
        }
        // Default/time mode
        return {
            ...libraryEx,
            id: exRef.exerciseId,
            type: 'time',
            work: sanitizeDuration(exRef.work, 30),
            rest: sanitizeDuration(exRef.rest, 0),
            repeat: Math.max(1, sanitizeDuration(exRef.repeat, 1))
        };
    }

    function alertMessage(msg, type = 'success') { const div=document.createElement('div'); let bgColor = 'bg-green-500'; if (type === 'warning') bgColor = 'bg-yellow-500'; if (type === 'error') bgColor = 'bg-red-500'; div.className=`fixed top-5 right-5 ${bgColor} text-white py-2 px-4 rounded-lg shadow-lg z-50`; div.textContent=msg; document.body.appendChild(div); setTimeout(()=>div.remove(), 4000); }

    function setTimerDisplayManual() {
        if (timerDisplay) timerDisplay.textContent = '--:--';
        if (expandedStatsRemaining) expandedStatsRemaining.textContent = '--:--';
    }

    // Called when the user indicates they finished the current set (manual confirmation)
    function completeSet() {
        if (!currentRoutine) return;
        
        // Handle sets within circuits
        if (isInCircuit) {
            const circuit = currentRoutine.exercises[currentExerciseIndex];
            const circuitEx = circuit.exercises[currentCircuitExerciseIndex];
            
            if (!circuitEx || circuitEx.type !== 'sets') {
                // Not a sets exercise - shouldn't happen
                return;
            }
            
            const totalSets = Math.max(1, circuitEx.sets || 1);
            const rbs = sanitizeDuration(circuitEx.restBetweenSets, 0);
            
            if (rbs > 0) {
                // Start timed rest between sets
                startRestBetweenSets(rbs);
                renderLeftPanelDetails();
                return;
            }
            
            // No timed rest: increment set
            currentSetIndex = (currentSetIndex || 1) + 1;
            
            if (currentSetIndex <= totalSets) {
                // Show manual state for next set
                state = 'work';
                setTimerDisplayManual();
                updateExerciseInfo();
                updateCompleteSetButtonVisibility();
                renderLeftPanelDetails();
                return;
            }
            
            // Completed all sets - advance to next exercise in circuit
            currentSetIndex = 1;
            currentRepeatIndex = 1;
            currentCircuitExerciseIndex++;
            
            if (currentCircuitExerciseIndex < circuit.exercises.length) {
                const nextCircuitEx = circuit.exercises[currentCircuitExerciseIndex];
                state = 'work';
                
                if (nextCircuitEx.type === 'sets') {
                    currentSetIndex = 1;
                    timeLeft = 0;
                    setTimerDisplayManual();
                    if (startButton) startButton.disabled = false;
                    if (pauseButton) pauseButton.disabled = true;
                } else {
                    timeLeft = sanitizeDuration(nextCircuitEx.work);
                    if (startButton) startButton.disabled = false;
                    if (pauseButton) pauseButton.disabled = true;
                }
                
                currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${nextCircuitEx.name}`;
                updateTimerDisplay();
                loadVideo(nextCircuitEx, true);
                updatePhaseUI();
                updateCompleteSetButtonVisibility();
                renderLeftPanelDetails();
                return;
            }
            
            // Completed all exercises in round
            currentCircuitExerciseIndex = 0;
            currentCircuitRound++;
            
            if (currentCircuitRound <= circuit.rounds) {
                // Rest between rounds or start next round
                if (circuit.restBetweenRounds > 0) {
                    state = 'rest';
                    timeLeft = circuit.restBetweenRounds;
                    stopCurrentVideo();
                    currentExerciseTitle.textContent = `🔁 Descanso entre vueltas (${currentCircuitRound - 1}/${circuit.rounds} completada)`;
                    timerState = 'running';
                    setupAudio();
                    primeAudioEngines().then(() => {
                        clearInterval(timer);
                        timer = setInterval(timerLoop, 1000);
                        updatePhaseUI();
                        updateTimerDisplay();
                        updateCompleteSetButtonVisibility();
                        renderLeftPanelDetails();
                    });
                    return;
                } else {
                    // No rest - start next round immediately
                    const firstEx = circuit.exercises[0];
                    state = 'work';
                    currentRepeatIndex = 1;
                    
                    if (firstEx.type === 'sets') {
                        currentSetIndex = 1;
                        timeLeft = 0;
                        setTimerDisplayManual();
                        if (startButton) startButton.disabled = false;
                        if (pauseButton) pauseButton.disabled = true;
                    } else {
                        timeLeft = sanitizeDuration(firstEx.work);
                        if (startButton) startButton.disabled = false;
                        if (pauseButton) pauseButton.disabled = true;
                    }
                    
                    currentExerciseTitle.textContent = `🔁 CIRCUITO ${currentCircuitRound}/${circuit.rounds} - ${firstEx.name}`;
                    updateTimerDisplay();
                    loadVideo(firstEx, true);
                    updatePhaseUI();
                    updateCompleteSetButtonVisibility();
                    renderLeftPanelDetails();
                    return;
                }
            }
            
            // Completed all rounds
            isInCircuit = false;
            currentCircuitRound = 1;
            currentCircuitExerciseIndex = 0;
            currentExerciseIndex++;
            if (currentExerciseIndex < currentRoutine.exercises.length) {
                loadExercise(true);
            } else {
                finishWorkout();
            }
            renderLeftPanelDetails();
            return;
        }
        
        // Regular (non-circuit) sets handling
        const ex = currentRoutine.exercises[currentExerciseIndex];
        if (!ex || ex.type !== 'sets') {
            goToNextExercise(true);
            return;
        }
        const totalSets = Math.max(1, ex.sets || 1);
        // If we are in rest currently, ignore (shouldn't be called)
        const rbs = sanitizeDuration(ex.restBetweenSets, 0);
        if (rbs > 0) {
            // Start timed rest between sets; increment will occur when rest finishes
            startRestBetweenSets(rbs);
            renderLeftPanelDetails();
            return;
        }
        // No timed rest: increment and move to next or show next set
        currentSetIndex = (currentSetIndex || 1) + 1;
        if (currentSetIndex <= totalSets) {
            // show manual state for next set
            state = 'work';
            setTimerDisplayManual();
            updateExerciseInfo();
            updateCompleteSetButtonVisibility();
            renderLeftPanelDetails();
            return;
        }
        // Completed all sets -> move to next exercise
        currentSetIndex = 1;
        goToNextExercise(true);
        renderLeftPanelDetails();
    }

    function startRestBetweenSets(seconds) {
        // Start a timed rest between sets
        state = 'rest';
        timeLeft = Math.max(0, sanitizeDuration(seconds, 0));
        timerState = 'running';
        setupAudio();
        primeAudioEngines().then(() => {
            playCurrentVideo();
            clearInterval(timer);
            timer = setInterval(timerLoop, 1000);
            updatePhaseUI();
            updateTimerDisplay();
            renderLeftPanelDetails();
        }).catch(() => {
            clearInterval(timer);
            timer = setInterval(timerLoop, 1000);
            updatePhaseUI();
            updateTimerDisplay();
            renderLeftPanelDetails();
        });
    }
    
    // Event listeners ya configurados arriba para maximizar video
    
    // Cambiar icono cuando entra/sale de pantalla completa
    document.addEventListener('fullscreenchange', updateFullscreenIcon);
    document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
    document.addEventListener('msfullscreenchange', updateFullscreenIcon);
    
    function updateFullscreenIcon() {
        const expandIcon = document.getElementById('expandIcon');
        const compressIcon = document.getElementById('compressIcon');
        const maximizeVideoBtn = document.getElementById('maximizeVideoBtn');
        
        if (!expandIcon || !compressIcon || !maximizeVideoBtn) return;
        
        if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            expandIcon.style.display = 'none';
            compressIcon.style.display = 'block';
            maximizeVideoBtn.title = 'Salir de pantalla completa';
        } else {
            expandIcon.style.display = 'block';
            compressIcon.style.display = 'none';
            maximizeVideoBtn.title = 'Maximizar video';
        }
    }
    
    window.addEventListener('resize', scheduleExpandedLayoutRecalc);
    updateSidebarToggleUI();
    updateMaximizeButton(false);
    updateExpandedLayoutState();
    
    // Hamburger Menu Handler
    const hamburgerMenuBtn = document.getElementById('hamburgerMenuBtn');
    const sidebarMenu = document.getElementById('sidebarMenu');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    
    function toggleSidebarMenu() {
        sidebarMenu.classList.toggle('-translate-x-full');
    }
    
    if (hamburgerMenuBtn) {
        hamburgerMenuBtn.addEventListener('click', toggleSidebarMenu);
    }
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', toggleSidebarMenu);
    }
    
    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (sidebarMenu && !sidebarMenu.classList.contains('-translate-x-full')) {
            if (!sidebarMenu.contains(e.target) && !hamburgerMenuBtn.contains(e.target)) {
                toggleSidebarMenu();
            }
        }
    });
    
    // Close sidebar after clicking a menu item
    const sidebarButtons = sidebarMenu?.querySelectorAll('button:not(#closeSidebarBtn)');
    sidebarButtons?.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!sidebarMenu.classList.contains('-translate-x-full')) {
                toggleSidebarMenu();
            }
        });
    });
    
    initializeAppData();
});


