# CuentaAlerta UI v3 — Guardar en GitHub

Esta versión agrega el botón **Guardar GitHub** para actualizar `reminders.json` directamente desde el iPhone.

## Archivos que debes reemplazar/subir

Sube estos archivos al mismo repo `cuentaAtras`:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `assets/icon.svg`
- `assets/icon-192.svg`

No borres:

- `.github/workflows/check-reminders.yml`
- `scripts/check_reminders.py`
- `reminders.json`
- `.alert_state.json`, si existe

## Crear token seguro en GitHub

Crea un **Fine-grained personal access token** con el permiso mínimo:

- Repository access: **Only select repositories**
- Repository: tu repo `cuentaAtras`
- Permissions → Repository permissions → **Contents: Read and write**
- Expiration: 30 o 90 días

Copia el token una sola vez.

## Configurar en la app

1. Abre tu app en iPhone.
2. Toca el engrane **⚙**.
3. Llena:
   - Usuario GitHub: `leoncitolv`
   - Repositorio: `cuentaAtras`
   - Rama: `main`
   - Token: `github_pat_...`
4. Toca **Probar**.
5. Si sale correcto, toca **Guardar configuración**.

El token se guarda únicamente en el navegador/iPhone mediante `localStorage`. No se sube al repositorio.

## Uso normal

1. Crea o edita un recordatorio.
2. Toca **Guardar GitHub**.
3. La app actualiza `reminders.json` en el repo.
4. GitHub Actions revisa las fechas.
5. Telegram manda los avisos.

## Plan B

Si GitHub no deja guardar por token o permisos, usa **Copiar** o **Descargar** y actualiza `reminders.json` manualmente.
