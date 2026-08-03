const LOCAL_STORAGE_KEY = 'hiitTrainerData';
const LOCAL_STORAGE_MUTE_KEY = 'hiitVideoMuted';
const MAX_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function isLikelyJsonFile(file) {
    if (!file || typeof file.name !== 'string') return false;
    const lowerName = file.name.toLowerCase();
    const hasJsonExtension = lowerName.endsWith('.json');
    // Browsers may report empty MIME for local files, so extension remains the primary signal.
    const validMime = !file.type || file.type === 'application/json' || file.type === 'text/json';
    return hasJsonExtension && validMime;
}

/**
 * Validates data structure
 * @param {*} candidate - Data to validate
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }} Validation result
 */
export function isValidDataShape(candidate) {
    const errors = [];
    const warnings = [];

    if (!candidate || typeof candidate !== 'object') {
        return { valid: false, errors: ['La estructura raíz debe ser un objeto.'], warnings };
    }

    const { exercises, routines } = candidate;

    // exercises validations
    if (!exercises || typeof exercises !== 'object' || Array.isArray(exercises)) {
        errors.push('"exercises" debe ser un objeto con al menos un ejercicio.');
    } else {
        const exerciseIds = Object.keys(exercises);
        if (exerciseIds.length === 0) {
            errors.push('Debe existir al menos un ejercicio en "exercises".');
        }
        exerciseIds.forEach((id) => {
            const ex = exercises[id];
            const label = `Ejercicio "${id}"`;
            if (!ex || typeof ex !== 'object') {
                errors.push(`${label} no es un objeto.`);
                return;
            }
            if (!ex.name || typeof ex.name !== 'string' || !ex.name.trim()) {
                errors.push(`${label} debe tener un nombre (string no vacío).`);
            }
            if (!ex.videoId || typeof ex.videoId !== 'string' || ex.videoId.trim().length < 6) {
                warnings.push(`${label} debería tener un videoId de 11 caracteres.`);
            }
            ['start', 'end'].forEach((field) => {
                if (ex[field] !== undefined) {
                    const value = Number(ex[field]);
                    if (!Number.isFinite(value) || value < 0) {
                        warnings.push(`${label}: "${field}" debería ser un número mayor o igual a 0.`);
                    }
                }
            });
        });
    }

    // routines validations
    if (!Array.isArray(routines)) {
        errors.push('"routines" debe ser un arreglo.');
    } else {
        routines.forEach((routine, idx) => {
            const routineLabel = routine?.name ? `Rutina "${routine.name}"` : `Rutina #${idx + 1}`;
            if (!routine || typeof routine !== 'object') {
                errors.push(`${routineLabel} no es un objeto.`);
                return;
            }
            if (!routine.name || typeof routine.name !== 'string' || !routine.name.trim()) {
                errors.push(`${routineLabel} debe tener un nombre (string).`);
            }
            if (!Array.isArray(routine.exercises) || routine.exercises.length === 0) {
                warnings.push(`${routineLabel} debería incluir un arreglo de ejercicios no vacío.`);
                return;
            }

            routine.exercises.forEach((exRef, exIdx) => {
                const exLabel = `${routineLabel} → ejercicio #${exIdx + 1}`;
                if (!exRef || typeof exRef !== 'object') {
                    warnings.push(`${exLabel} no es un objeto válido.`);
                    return;
                }
                if (!exRef.exerciseId || !exercises || !exercises[exRef.exerciseId]) {
                    warnings.push(`${exLabel}: exerciseId "${exRef.exerciseId}" no existe en exercises.`);
                }

                const type = exRef.type || 'time';
                if (type === 'time') {
                    ['work', 'rest', 'repeat'].forEach((field) => {
                        const value = Number(exRef[field]);
                        const min = field === 'work' ? 1 : 0; // allow rest >= 0
                        if (!Number.isFinite(value) || value < min) {
                            warnings.push(`${exLabel}: "${field}" debería ser un número ${field === 'work' ? 'mayor a 0' : 'mayor o igual a 0'}.`);
                        }
                    });
                } else if (type === 'sets') {
                    const sets = Number(exRef.sets);
                    const reps = Number(exRef.reps);
                    const restBetweenSets = Number(exRef.restBetweenSets);
                    if (!Number.isFinite(sets) || sets < 1) warnings.push(`${exLabel}: "sets" debería ser >= 1.`);
                    if (!Number.isFinite(reps) || reps < 1) warnings.push(`${exLabel}: "reps" debería ser >= 1.`);
                    if (!Number.isFinite(restBetweenSets) || restBetweenSets < 0) warnings.push(`${exLabel}: "restBetweenSets" debería ser >= 0.`);
                } else if (type === 'circuit') {
                    const rounds = Number(exRef.rounds);
                    if (!Number.isFinite(rounds) || rounds < 1) warnings.push(`${exLabel}: "rounds" debería ser >= 1.`);
                    if (!Array.isArray(exRef.exercises) || exRef.exercises.length === 0) {
                        warnings.push(`${exLabel}: "exercises" debería ser un arreglo no vacío.`);
                        return;
                    }
                    exRef.exercises.forEach((cEx, cIdx) => {
                        const cLabel = `${exLabel} → circuito #${cIdx + 1}`;
                        if (!cEx || typeof cEx !== 'object') {
                            warnings.push(`${cLabel} no es un objeto válido.`);
                            return;
                        }
                        if (!cEx.exerciseId || !exercises || !exercises[cEx.exerciseId]) {
                            warnings.push(`${cLabel}: exerciseId "${cEx.exerciseId}" no existe en exercises.`);
                        }
                        const cType = cEx.type || 'time';
                        if (cType === 'time') {
                            ['work', 'rest', 'repeat'].forEach((field) => {
                                const value = Number(cEx[field]);
                                const min = field === 'work' ? 1 : 0;
                                if (!Number.isFinite(value) || value < min) {
                                    warnings.push(`${cLabel}: "${field}" debería ser un número ${field === 'work' ? 'mayor a 0' : 'mayor o igual a 0'}.`);
                                }
                            });
                        } else if (cType === 'sets') {
                            const sets = Number(cEx.sets);
                            const reps = Number(cEx.reps);
                            const restBetweenSets = Number(cEx.restBetweenSets);
                            if (!Number.isFinite(sets) || sets < 1) warnings.push(`${cLabel}: "sets" debería ser >= 1.`);
                            if (!Number.isFinite(reps) || reps < 1) warnings.push(`${cLabel}: "reps" debería ser >= 1.`);
                            if (!Number.isFinite(restBetweenSets) || restBetweenSets < 0) warnings.push(`${cLabel}: "restBetweenSets" debería ser >= 0.`);
                        } else {
                            warnings.push(`${cLabel}: tipo "${cType}" no es válido.`);
                        }
                    });
                } else {
                    warnings.push(`${exLabel}: tipo "${type}" no es válido.`);
                }
            });
        });
    }

    // Only treat fundamental shape issues as invalid; report the rest as warnings so data can load.
    const fatalErrors = errors;
    return { valid: fatalErrors.length === 0, errors: fatalErrors, warnings };
}

/**
 * Normalizes imported data payload
 * @param {Object} data - Raw data object
 * @returns {Object} Normalized data
 */
export function normalizeDataPayload(data) {
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
                                work: parseInt(cEx.work, 10) || 30,
                                rest: parseInt(cEx.rest, 10) || 10,
                                repeat: Math.max(1, parseInt(cEx.repeat, 10) || 1)
                            };
                        }).filter(Boolean) : []
                    };
                }
                // If object already has 'type' keep it
                if (ex.type === 'sets') {
                    return {
                        exerciseId: ex.exerciseId,
                        type: 'sets',
                        sets: ex.sets || ex.count || 3,
                        reps: ex.reps || 10,
                        restBetweenSets: ex.restBetweenSets || 60
                    };
                }
                if (ex.type === 'time') {
                    return {
                        exerciseId: ex.exerciseId,
                        type: 'time',
                        work: parseInt(ex.work, 10) || 30,
                        rest: parseInt(ex.rest, 10) || 10,
                        repeat: Math.max(1, parseInt(ex.repeat, 10) || 1)
                    };
                }
                // Legacy shape
                return {
                    exerciseId: ex.exerciseId,
                    type: 'time',
                    work: parseInt(ex.work, 10) || 30,
                    rest: parseInt(ex.rest, 10) || 10,
                    repeat: Math.max(1, parseInt(ex.repeat, 10) || 1)
                };
            }).filter(Boolean) : []
        };
    }) : [];

    return {
        exercises: data.exercises || {},
        routines
    };
}

/**
 * Saves data to localStorage
 * @param {Object} exercises - Exercises object
 * @param {Array} routines - Routines array
 * @returns {boolean} True if successful
 */
export function persistDataLocally(arg1, arg2) {
    try {
        // Support both persistDataLocally(exercises, routines) and persistDataLocally({ exercises, routines })
        const payload = (arg2 === undefined && arg1 && typeof arg1 === 'object' && !Array.isArray(arg1) && 'exercises' in arg1 && 'routines' in arg1)
            ? arg1
            : { exercises: arg1, routines: arg2 };

        const snapshot = JSON.stringify({
            exercises: payload.exercises || {},
            routines: Array.isArray(payload.routines) ? payload.routines : []
        });

        localStorage.setItem(LOCAL_STORAGE_KEY, snapshot);
        return true;
    } catch (error) {
        console.error('Error persisting HIIT data locally:', error);
        return false;
    }
}

/**
 * Loads data from localStorage
 * @returns {Object|null} Loaded data or null if not found
 */
export function loadDataFromLocalStorage() {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return { data: null, errors: [] };
        const parsed = JSON.parse(raw);
        const validation = isValidDataShape(parsed);
        if (!validation.valid) {
            console.warn('Persisted HIIT data had invalid format. Ignoring.', validation.errors);
            return { data: null, errors: validation.errors };
        }
        return { data: normalizeDataPayload(parsed), errors: [] };
    } catch (error) {
        console.error('Error reading persisted HIIT data:', error);
        return { data: null, errors: ['Error leyendo datos locales'] };
    }
}

/**
 * Loads data from JSON file
 * @param {Array<string>} sources - Array of file paths to try
 * @returns {Promise<Object|null>} Loaded data or null
 */
export async function loadDataFromFile(sources = ['hiit_trainer_backup Agosto 2026.json', 'data.json', 'hiit_trainer_backup (13).json']) {
    let lastErrors = [];
    for (const src of sources) {
        try {
            const response = await fetch(encodeURI(src));
            if (!response.ok) continue;
            const data = await response.json();
            const validation = isValidDataShape(data);
            if (!validation.valid) {
                lastErrors = validation.errors;
                console.warn(`Formato no válido en ${src}`, validation.errors);
                continue;
            }
            return { data: normalizeDataPayload(data), errors: [] };
        } catch (e) {
            continue;
        }
    }
    console.warn('No fue posible cargar data desde archivos locales. Usa Importar o crea ejercicios/rutinas.');
    return { data: null, errors: lastErrors };
}

/**
 * Exports data to JSON file
 * @param {Object} exercises - Exercises object
 * @param {Array} routines - Routines array
 * @param {string} filename - Output filename
 */
export function exportToJSON(exercises, routines, filename = 'hiit_trainer_backup.json') {
    const dataToExport = { exercises, routines };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

/**
 * Imports data from JSON file
 * @param {File} file - File object to import
 * @returns {Promise<Object|null>} Imported data or null if invalid
 */
export function importFromJSON(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No se recibió ningún archivo para importar.'));
            return;
        }

        if (!isLikelyJsonFile(file)) {
            reject(new Error('El archivo debe ser JSON (.json).'));
            return;
        }

        if (!Number.isFinite(file.size) || file.size <= 0) {
            reject(new Error('El archivo está vacío o no se puede leer.'));
            return;
        }

        if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
            reject(new Error('El archivo supera el tamaño máximo permitido de 2 MB.'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const raw = e?.target?.result;
                if (typeof raw !== 'string') {
                    reject(new Error('No se pudo leer el contenido del archivo como texto.'));
                    return;
                }

                const data = JSON.parse(raw);
                const validation = isValidDataShape(data);
                if (validation.valid) {
                    resolve(normalizeDataPayload(data));
                } else {
                    reject(new Error(`Invalid data format: ${validation.errors.join(' | ')}`));
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * Saves video mute preference
 * @param {boolean} isMuted - Mute state
 */
export function saveMuteSetting(isMuted) {
    try {
        localStorage.setItem(LOCAL_STORAGE_MUTE_KEY, JSON.stringify(isMuted));
    } catch (error) {
        console.error('Error saving mute setting:', error);
    }
}

/**
 * Loads video mute preference
 * @returns {boolean} Mute state (default true)
 */
export function loadMuteSetting() {
    try {
        const savedMuteSetting = localStorage.getItem(LOCAL_STORAGE_MUTE_KEY);
        return savedMuteSetting !== null ? JSON.parse(savedMuteSetting) : true;
    } catch (error) {
        console.error('Error loading mute setting:', error);
        return true;
    }
}
