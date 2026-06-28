# CuentaAlerta UI v2

Esta actualización mejora solo la interfaz web de GitHub Pages. No cambia el bot, los secrets ni el workflow.

## Archivos que debes reemplazar en GitHub

Reemplaza estos archivos en la raíz del repo:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- carpeta `assets/`

No borres:

- `.github/workflows/check-reminders.yml`
- `scripts/check_reminders.py`
- `reminders.json`
- `.alert_state.json`

## Uso diario

1. Abre la app en GitHub Pages desde tu iPhone.
2. Agrega o edita recordatorios.
3. Presiona **Copiar JSON** o **Descargar**.
4. En GitHub abre `reminders.json`.
5. Reemplaza el contenido y haz **Commit changes**.
6. GitHub Actions enviará las alertas por Telegram.

## Campos compatibles

Cada recordatorio usa esta forma:

```json
{
  "id": "gas-estacionario-202607150900",
  "title": "Revisar gas estacionario",
  "due": "2026-07-15T09:00",
  "color": "blue",
  "category": "Casa",
  "notify": ["1d", "1h", "due"],
  "notes": "Revisar nivel y pedir recarga si hace falta."
}
```

`category` es solo para la interfaz. El script de Telegram lo ignora, pero no estorba.
