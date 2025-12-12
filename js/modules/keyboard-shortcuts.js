// Keyboard shortcuts module
// Listens to keydown events and triggers UI actions

function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

function createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'keyboardShortcutsTooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.top = '1rem';
    tooltip.style.right = '1rem';
    tooltip.style.zIndex = '99999';
    tooltip.style.padding = '12px 14px';
    tooltip.style.background = 'rgba(15,23,42,0.95)';
    tooltip.style.border = '1px solid rgba(99,102,241,0.3)';
    tooltip.style.borderRadius = '10px';
    tooltip.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
    tooltip.style.color = '#e2e8f0';
    tooltip.style.fontSize = '13px';
    tooltip.style.lineHeight = '1.35';
    tooltip.style.maxWidth = '320px';
    tooltip.style.display = 'none';
    tooltip.innerHTML = `
        <strong style="display:block; color:#c7d2fe; margin-bottom:6px; font-size:13px;">Atajos de teclado</strong>
        <div style="display:grid; grid-template-columns: auto 1fr; gap:4px 10px;">
            <span style="color:#a5b4fc;">Espacio</span><span>Play / Pause</span>
            <span style="color:#a5b4fc;">R</span><span>Reiniciar ejercicio</span>
            <span style="color:#a5b4fc;">N</span><span>Siguiente ejercicio</span>
            <span style="color:#a5b4fc;">F</span><span>Pantalla completa</span>
            <span style="color:#a5b4fc;">M</span><span>Mute / Unmute</span>
            <span style="color:#a5b4fc;">ESC</span><span>Salir de fullscreen</span>
            <span style="color:#a5b4fc;">?</span><span>Mostrar atajos</span>
        </div>`;
    document.body.appendChild(tooltip);
    return tooltip;
}

export function initKeyboardShortcuts({
    startButton,
    pauseButton,
    resetExerciseButton,
    nextExerciseButton,
    toggleFullscreen,
    exitFullscreen,
    audioToggle
}) {
    if (!document) return;
    const tooltip = createTooltip();

    // Annotate buttons with hints
    if (startButton) startButton.dataset.keyboardHint = 'Espacio: Play/Pause';
    if (pauseButton) pauseButton.dataset.keyboardHint = 'Espacio: Play/Pause';
    if (resetExerciseButton) resetExerciseButton.dataset.keyboardHint = 'R: Reiniciar ejercicio';
    if (nextExerciseButton) nextExerciseButton.dataset.keyboardHint = 'N: Siguiente ejercicio';
    if (audioToggle) audioToggle.dataset.keyboardHint = 'M: Mute/Unmute';

    let tooltipTimeout = null;
    const showTooltip = () => {
        if (!tooltip) return;
        tooltip.style.display = 'block';
        clearTimeout(tooltipTimeout);
        tooltipTimeout = setTimeout(() => {
            tooltip.style.display = 'none';
        }, 4000);
    };

    document.addEventListener('keydown', (e) => {
        if (isTyping()) return;

        const key = e.key;
        if (key === '?') {
            e.preventDefault();
            showTooltip();
            return;
        }

        switch (key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                // Toggle play/pause based on pause button availability
                if (pauseButton && !pauseButton.disabled) {
                    pauseButton.click();
                } else if (startButton && !startButton.disabled) {
                    startButton.click();
                }
                break;
            case 'r':
                e.preventDefault();
                if (resetExerciseButton && !resetExerciseButton.disabled) resetExerciseButton.click();
                break;
            case 'n':
                e.preventDefault();
                if (nextExerciseButton && !nextExerciseButton.disabled) nextExerciseButton.click();
                break;
            case 'f':
                e.preventDefault();
                if (typeof toggleFullscreen === 'function') toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                if (audioToggle) {
                    audioToggle.checked = !audioToggle.checked;
                    audioToggle.dispatchEvent(new Event('change', { bubbles: true }));
                }
                break;
            case 'escape':
                if (typeof exitFullscreen === 'function') {
                    e.preventDefault();
                    exitFullscreen();
                }
                break;
            default:
                break;
        }
    });
}
