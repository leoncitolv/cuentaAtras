# CuentaAlerta

App web estilo iOS para llevar cuentas atrás y mandar alertas reales al iPhone mediante Telegram Bot + GitHub Actions.

## Qué hace

- Interfaz HTML/CSS/JS bonita, tipo iOS.
- Funciona en GitHub Pages como página estática.
- Se puede agregar a la pantalla de inicio del iPhone.
- Lee tus pendientes desde `reminders.json`.
- GitHub Actions revisa los pendientes cada 15 minutos.
- Manda avisos por Telegram:
  - 7 días antes
  - 3 días antes
  - 1 día antes
  - 12 horas antes
  - 1 hora antes
  - 15 minutos antes
  - al momento exacto aproximado

## Arquitectura

```text
iPhone
  ↓ abre GitHub Pages
HTML + CSS + JavaScript
  ↓ muestra tus cuentas atrás
reminders.json
  ↓ leído por GitHub Actions
scripts/check_reminders.py
  ↓ manda aviso
Telegram Bot
  ↓
Notificación en iPhone
```

## Archivos importantes

```text
index.html                         Interfaz principal
styles.css                         Diseño tipo iOS
app.js                             Lógica visual y exportación JSON
reminders.json                     Tus recordatorios
scripts/check_reminders.py         Script que manda Telegram
.github/workflows/check-reminders.yml  Automatización de GitHub Actions
.alert_state.json                  Historial para evitar alertas duplicadas
manifest.webmanifest               Instalación como app web
service-worker.js                  Caché básico
assets/icon.svg                    Icono de la app
```

## Paso 1: Crear bot de Telegram

1. Abre Telegram.
2. Busca `@BotFather`.
3. Escribe `/newbot`.
4. Ponle nombre, por ejemplo `CuentaAlerta`.
5. Guarda el token que te da. Se ve parecido a:

```text
1234567890:AAExampleTokenExampleTokenExample
```

6. Abre tu bot y mándale `/start`.
7. Para obtener tu `chat_id`, abre en el navegador:

```text
https://api.telegram.org/botTU_TOKEN/getUpdates
```

Cambia `TU_TOKEN` por el token real. Busca algo como:

```json
"chat":{"id":123456789}
```

Ese número es tu `TELEGRAM_CHAT_ID`.

## Paso 2: Subir a GitHub

Desde Linux/Bazzite, dentro de la carpeta del proyecto:

```bash
git init
git add .
git commit -m "Primera version de CuentaAlerta"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/CuentaAlerta.git
git push -u origin main
```

## Paso 3: Activar GitHub Pages

En GitHub:

```text
Repo CuentaAlerta
→ Settings
→ Pages
→ Build and deployment
→ Source: Deploy from a branch
→ Branch: main
→ Folder: / root
→ Save
```

Después GitHub te dará una dirección parecida a:

```text
https://TU-USUARIO.github.io/CuentaAlerta/
```

## Paso 4: Configurar secretos de Telegram

En GitHub:

```text
Repo CuentaAlerta
→ Settings
→ Secrets and variables
→ Actions
→ New repository secret
```

Crea estos secretos:

```text
TELEGRAM_BOT_TOKEN = token del bot
TELEGRAM_CHAT_ID = tu chat_id
```

Luego crea estas variables:

```text
APP_TIMEZONE = America/Mexico_City
APP_BASE_URL = https://TU-USUARIO.github.io/CuentaAlerta/
```

`APP_BASE_URL` es opcional, pero sirve para que el mensaje de Telegram incluya el enlace a tu app.

## Paso 5: Probar la alerta manualmente

En GitHub:

```text
Repo CuentaAlerta
→ Actions
→ CuentaAlerta Telegram
→ Run workflow
```

Para probar rápido, edita `reminders.json` y pon un recordatorio para dentro de 15 o 20 minutos con:

```json
"notify": ["15m", "due"]
```

## Cómo agregar recordatorios

Tienes dos formas.

### Forma A: Desde la interfaz

1. Abre la app web.
2. Presiona `+`.
3. Crea o edita recordatorios.
4. Ve a `Exportar`.
5. Descarga o copia el nuevo `reminders.json`.
6. En GitHub reemplaza el archivo `reminders.json` y haz commit.

### Forma B: Editar `reminders.json` directo

Ejemplo:

```json
{
  "id": "pago-tenencia",
  "title": "Pago de tenencia",
  "due": "2026-07-30T09:00",
  "color": "orange",
  "notify": ["7d", "1d", "1h", "due"],
  "notes": "Revisar documentos y comprobante."
}
```

## Agregar al iPhone como app

En Safari abre tu GitHub Pages:

```text
https://TU-USUARIO.github.io/CuentaAlerta/
```

Luego:

```text
Compartir
→ Agregar a pantalla de inicio
→ Agregar
```

## Importante sobre privacidad

Si tu repositorio es público, el archivo `reminders.json` también puede ser público. No pongas datos sensibles como contraseñas, datos bancarios, CURP, RFC completo, direcciones privadas o información médica.

El token de Telegram sí queda seguro porque va en GitHub Secrets, no en el HTML.

## Limitaciones

- Las alertas dependen de GitHub Actions, por eso no son exactas al segundo.
- GitHub Actions puede retrasarse algunos minutos.
- La interfaz HTML no puede escribir directo a GitHub sin usar tokens; por seguridad se exporta el JSON y tú lo subes.
- Para trámites, mantenimiento y recordatorios personales funciona muy bien. Para emergencias o medicamentos críticos, usa también una alarma del iPhone.
