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

## Próximos pasos sugeridos

- Añadir pruebas automáticas (por ejemplo, con Playwright o Cypress) para validar los flujos clave.
- Separar la lógica de temporizador, datos y UI en módulos para facilitar el mantenimiento.
- Convertir la app en PWA para permitir uso sin conexión y guardado en pantalla de inicio.

## Licencia

Este proyecto es de libre uso dentro de tu organización. Ajusta o distribuye según tus necesidades.
