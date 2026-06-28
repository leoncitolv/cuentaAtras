# CuentaAlerta UI v4 — Modo Dios iOS Pro

Actualización visual para CuentaAlerta con vistas nuevas:

- Vista **Tarjetas** con contador grande.
- Vista **Agenda** ordenada por Vencidos, Hoy, Mañana, Próximos 7 días, Este mes y Después.
- Vista **Calendario** mensual con puntos de colores en los días con pendientes.
- Panel superior con estadísticas: Hoy, 7 días, Vencidos y Total.
- Botón **Prueba 20 min** en Agenda para probar Telegram rápido.
- Botón **Guardar GitHub** conservado para actualizar `reminders.json` automáticamente.

## Archivos que debes reemplazar en GitHub

Sube/reemplaza en la raíz del repo:

```text
index.html
styles.css
app.js
manifest.webmanifest
service-worker.js
assets/icon.svg
assets/icon-192.svg
```

No borres ni muevas:

```text
.github/workflows
scripts/check_reminders.py
reminders.json
```

## Después de subir

1. Espera a que GitHub Pages termine en verde.
2. Abre la app con:

```text
https://leoncitolv.github.io/cuentaAtras/?v=4
```

3. Si ves la versión anterior, en iPhone borra datos del sitio o abre con `?v=4.1`.
4. Tu token de GitHub se conserva en el navegador si ya estaba guardado.

## Notas

La vista Calendario y Agenda son visuales. Las alertas siguen funcionando con GitHub Actions + Telegram leyendo `reminders.json`.
