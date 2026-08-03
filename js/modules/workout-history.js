const HISTORY_KEY = 'hiitTrainerHistory';
const HISTORY_FILE = 'hiit_history.json';

function safeParse(json, fallback = []) {
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

export class WorkoutHistory {
    constructor(storageKey = HISTORY_KEY) {
        this.storageKey = storageKey;
    }

    loadHistory() {
        const raw = localStorage.getItem(this.storageKey);
        const history = safeParse(raw, []);
        // If localStorage is empty, try loading from file
        if (history.length === 0) {
            this.loadHistoryFromFile();
        }
        return history;
    }

    saveHistory(list) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(list));
            // Also try to save to file for persistence
            this.saveHistoryToFile(list);
            return true;
        } catch (e) {
            console.error('No se pudo guardar el historial', e);
            return false;
        }
    }

    async loadHistoryFromFile() {
        try {
            const response = await fetch(HISTORY_FILE);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    localStorage.setItem(this.storageKey, JSON.stringify(data));
                    return data;
                }
            }
        } catch (e) {
            console.debug('No se pudo cargar el historial desde archivo', e);
        }
        return [];
    }

    saveHistoryToFile(list) {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(list, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", HISTORY_FILE);
            downloadAnchorNode.style.display = 'none';
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } catch (e) {
            console.debug('No se pudo guardar el historial en archivo', e);
        }
    }

    saveWorkout(routineName, exercises = [], duration = 0, completedAt = new Date()) {
        const history = this.loadHistory();
        const totalDuration = Math.max(0, Math.round(Number(duration) || 0));
        const cleanedExercises = (exercises || []).map((ex, idx) => ({
            exerciseId: ex?.exerciseId || `exercise-${idx + 1}`,
            duration: Math.max(0, Math.round(Number(ex?.duration) || 0)),
            completed: Boolean(ex?.completed)
        }));
        const completedCount = cleanedExercises.filter(e => e.completed).length;
        const completionRate = cleanedExercises.length === 0 ? 0 : Math.min(100, Math.max(0, Math.round((completedCount / cleanedExercises.length) * 100)));

        const entry = {
            id: Date.now(),
            routineName: routineName || 'Rutina',
            exercises: cleanedExercises,
            totalDuration,
            completedAt: new Date(completedAt).toISOString(),
            completionRate
        };

        history.unshift(entry);
        // Keep last 200 entries to avoid unbounded growth
        const trimmed = history.slice(0, 200);
        const saved = this.saveHistory(trimmed);
        
        if (saved) {
            console.log('✓ Historial guardado correctamente:', entry);
        } else {
            console.error('✗ Error al guardar el historial');
        }
        
        return entry;
    }

    getHistory(limit = 10) {
        const history = this.loadHistory().sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        return typeof limit === 'number' ? history.slice(0, limit) : history;
    }

    getStatsByRoutine(routineName) {
        const history = this.loadHistory();
        const filtered = routineName ? history.filter(h => h.routineName === routineName) : history;
        const totalWorkouts = filtered.length;
        const totalDuration = filtered.reduce((sum, h) => sum + (Number(h.totalDuration) || 0), 0);
        const avgCompletion = totalWorkouts === 0 ? 0 : Math.round(filtered.reduce((sum, h) => sum + (Number(h.completionRate) || 0), 0) / totalWorkouts);

        // Favorite routine by frequency (overall, not filtered)
        const routineCounts = history.reduce((acc, h) => {
            const key = h.routineName || 'Rutina';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        let favoriteRoutine = '—';
        let maxCount = 0;
        Object.entries(routineCounts).forEach(([name, count]) => {
            if (count > maxCount) {
                maxCount = count;
                favoriteRoutine = name;
            }
        });

        return { totalWorkouts, totalDuration, avgCompletion, favoriteRoutine };
    }

    clearHistory() {
        localStorage.removeItem(this.storageKey);
    }
}
