const HISTORY_KEY = 'hiitTrainerHistory';

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
        return safeParse(raw, []);
    }

    saveHistory(list) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(list));
            return true;
        } catch (e) {
            console.error('No se pudo guardar el historial', e);
            return false;
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
        this.saveHistory(trimmed);
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
