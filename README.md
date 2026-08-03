# HIIT Trainer

Aplicación web para crear, editar y ejecutar rutinas HIIT (High-Intensity Interval Training) directamente en el navegador. Incluye temporizador dinámico, reproducción de videos de YouTube por ejercicio, señales auditivas y herramientas para importar/exportar rutinas.

## Características principales

- **Temporizador interactivo**: alterna automáticamente entre fases de trabajo y descanso, con alertas visuales y sonoras en los últimos segundos.
- **Reproducción de video sincronizada**: integra el reproductor de YouTube y mantiene la reproducción en marcha al iniciar la rutina o reanudar una pausa.
- **Biblioteca editable**: añade, edita o elimina ejercicios con enlaces a videos y opcionales marcas de inicio/fin.
- **Constructor de rutinas**: organiza fácilmente los ejercicios, ajusta tiempos de trabajo/descanso y reordena con controles intuitivos.
- **Persistencia local**: todos los cambios se guardan automáticamente en `localStorage` del navegador; puedes exportarlos a JSON o volver a importarlos más tarde.
- **Importación flexible**: fusiona o reemplaza rutinas desde archivos externos con mensajes de resumen y validaciones de formato.

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox, Safari).
- Conexión a internet para cargar la API de YouTube, Tone.js y los videos.
- Servir los archivos desde un servidor estático (requerido por la API `fetch`).

## Puesta en marcha

1. Clona o descarga este repositorio.
2. Sirve la carpeta del proyecto con cualquier servidor estático. Opciones recomendadas:
   - Extensión **Live Server** de VS Code.
   - Servidor simple con Node.js:

```powershell
# Desde la carpeta del proyecto
npx serve .
```

3. Abre `http://localhost:3000` (o el puerto indicado) en el navegador.
4. Selecciona una rutina y pulsa **Iniciar** para comenzar el entrenamiento.

## Uso diario

- **Sonido del video**: activa/desactiva sin pausar la reproducción con el interruptor lateral.
- **Guardar cambios**: los ajustes se guardan automáticamente en el dispositivo. Usa **Exportar Datos** para guardar una copia externa.
- **Importar datos**: selecciona un JSON válido y elige entre fusionar o reemplazar completamente la biblioteca actual. Después de importar, se muestran resúmenes de elementos nuevos o actualizados.
- **Alertas sonoras**: se reproducen pitidos en los últimos 4 segundos de cada fase y un tono distinto al terminar trabajo o descanso.

## Estructura de archivos

- `index.html`: estructura principal y modales de la interfaz.
- `style.css`: estilos personalizados adicionales a Tailwind.
- `app.js`: lógica completa del temporizador, reproducción, modales e importación/exportación.
- `data.json`: biblioteca base de ejercicios y rutinas (se copia a `localStorage` en la primera carga).

## Construcción y edición de `data.json`

El archivo `data.json` define la biblioteca de ejercicios y las rutinas disponibles. Al cargar la aplicación por primera vez, su contenido se copia a `localStorage`; después, los cambios que hagas dentro de la interfaz se guardan solo localmente hasta que exportes.

### Forma general

```jsonc
{
   "exercises": {
      "sentadilla_basica": {
         "name": "Sentadilla Básica",
         "videoId": "XXXXXXXXXXX",
         "start": 0,            // (opcional) segundo inicial dentro del video
         "end": 60               // (opcional) segundo final dentro del video
      },
      "plancha": {
         "name": "Plancha",
         "videoId": "YYYYYYYYYYY"
      }
   },
   "routines": [
      {
         "name": "Rutina Inferior",
         "exercises": [
            { "type": "time", "exerciseId": "sentadilla_basica", "work": 30, "rest": 15, "repeat": 3 },
            { "type": "sets", "exerciseId": "plancha", "sets": 4, "restBetweenSets": 30 },
            {
               "type": "circuit",
               "rounds": 3,
               "restBetweenRounds": 60,
               "restBetweenExercises": 15,
               "exercises": [
                  { "type": "time", "exerciseId": "sentadilla_basica", "work": 25, "rest": 10, "repeat": 2 },
                  { "type": "sets", "exerciseId": "plancha", "sets": 3, "restBetweenSets": 20 }
               ]
            }
         ]
      }
   ]
}
```

### Sección `exercises`
- Clave: identificador único (sin espacios, usa guiones bajos).
- Campos mínimos: `name`, `videoId`.
- Campos opcionales: `start`, `end` (recortan el segmento reproducido).
- Recomendación: mantenlo pequeño y reutilizable; varios ejercicios en rutinas pueden apuntar al mismo `exerciseId` con diferentes tiempos.

### Tipos de bloques en `routines[].exercises`

1. `time` (ejercicio por tiempo)
    - Campos: `type`, `exerciseId`, `work` (segundos), `rest` (segundos), `repeat` (número de ciclos trabajo+descanso).
    - Ejemplo: `{ "type": "time", "exerciseId": "sentadilla_basica", "work": 40, "rest": 20, "repeat": 4 }`.
2. `sets` (ejercicio por series manuales)
    - Campos: `type`, `exerciseId`, `sets` (número total de series), `restBetweenSets` (segundos de descanso entre series).
    - El temporizador sólo controla descansos; la fase de trabajo es manual (botón Completar Serie).
3. `circuit` (grupo de ejercicios)
    - Campos: `type`, `rounds` (vueltas completas), `restBetweenRounds`, `restBetweenExercises`.
    - Dentro de `exercises` (del circuito) se aceptan sub-bloques `time` y `sets` con la misma forma descrita arriba.

### Reglas y validaciones recomendadas
- Todos los valores de tiempo deben ser enteros positivos (usa segundos).
- Si `repeat` falta en un bloque `time`, la aplicación lo normaliza a `1`.
- Un circuito requiere al menos un ejercicio interno.
- Evita duplicar nombres de rutina (`name`) para claridad en la interfaz.

### Pasos para crear o actualizar el JSON manualmente
1. Haz una copia de seguridad del archivo actual (`data-backup.json`).
2. Edita `data.json` en VS Code (asegúrate de mantener comas y llaves correctas).
3. Valida el formato (extensión JSON Linter o comando rápido):
    - En VS Code mira si aparecen errores de sintaxis en el editor.
4. Abre la aplicación en el navegador; si quieres forzar recarga limpia, borra el `localStorage`:
    ```javascript
    localStorage.removeItem('HIIT_TRAINER_DATA');
    ```
    y recarga la página.
5. Verifica que las nuevas rutinas aparecen en el selector y que los videos cargan desde sus `videoId`.
6. Usa la función de **Exportar Datos** para guardar el estado modificado después de probar.

### Construcción asistida desde una hoja de cálculo (opcional)
Si gestionas muchos ejercicios, puedes tener una hoja con columnas: `exerciseId`, `name`, `videoId`, `start`, `end`. Exporta a CSV y usa un pequeño script para transformarlo a JSON (no incluido). Recomendación: conserva IDs estables para que las rutinas previas sigan funcionando.

### Errores comunes
- Olvidar `"type"` dentro de un bloque de rutina.
- Usar milisegundos en vez de segundos (los tiempos deben ser simples enteros). 
- Duplicar `exerciseId` con distinta semántica (mejor crear uno nuevo con sufijo).
- Dejar un circuito con `exercises: []` (la app lo ignorará o puede fallar la navegación).

### Cheat Sheet rápida
| Tipo      | Campos clave | Descanso controlado |
|-----------|--------------|---------------------|
| time      | work, rest, repeat | Sí (automático) |
| sets      | sets, restBetweenSets | Sólo descansos entre series |
| circuit   | rounds, restBetweenRounds, restBetweenExercises | Ambos (interno + entre vueltas) |

### Recomendaciones de mantenimiento
- Mantén los IDs cortos y descriptivos (`burpee`, `plancha_lateral`).
- Agrupa rutinas por objetivos: fuerza, core, cardio, mixto.
- Documenta en comentarios aparte (no añadas claves no usadas; la app descartará formatos inesperados).

### Actualizar datos sin perder cambios locales
1. Exporta datos actuales desde la interfaz.
2. Edita `data.json` base según necesidades.
3. Importa el nuevo archivo y elige fusionar (mantiene lo existente y añade/actualiza) o reemplazar (sobrescribe todo).

Con estas pautas puedes ampliar fácilmente la biblioteca manteniendo consistencia y evitando errores de formato.

## Próximos pasos sugeridos

- Añadir pruebas automáticas (por ejemplo, con Playwright o Cypress) para validar los flujos clave.
- Separar la lógica de temporizador, datos y UI en módulos para facilitar el mantenimiento.
- Convertir la app en PWA para permitir uso sin conexión y guardado en pantalla de inicio.

## Seguridad mínima para GitHub Pages

Esta app no necesita login para funcionar, porque no maneja cuentas y guarda los datos en `localStorage` del navegador.

Checklist aplicado en el proyecto:

- **CSP en HTML**: limita scripts, estilos, iframes y conexiones a orígenes permitidos para reducir superficie XSS.
- **Referrer Policy**: usa `strict-origin-when-cross-origin` para no exponer rutas completas al salir del sitio.
- **Permissions Policy**: deshabilita APIs sensibles del navegador no usadas (cámara, micrófono, geolocalización, etc.).
- **Importación JSON endurecida**: solo acepta `.json`, valida MIME cuando existe, bloquea archivos vacíos y limita tamaño a 2 MB.

Notas importantes:

- No incluyas secretos (tokens, claves privadas) en archivos frontend.
- Si en el futuro quieres sincronizar historial entre dispositivos, sí necesitarás backend y autenticación.

## Despliegue automático con GitHub Actions

Este repositorio ya incluye un workflow para publicar automáticamente en GitHub Pages cuando haces push a la rama `main` o `master`.

Archivo del workflow:

- `.github/workflows/deploy-pages.yml`

Pasos en GitHub (una sola vez):

1. Sube el repositorio a GitHub.
2. Ve a **Settings > Pages**.
3. En **Source**, selecciona **GitHub Actions**.
4. Haz push a `main` (o ejecuta el workflow manualmente desde **Actions**).
5. GitHub publicará tu app en la URL de Pages del repositorio.

## Licencia

Este proyecto es de libre uso dentro de tu organización. Ajusta o distribuye según tus necesidades.
