# Mis Gastos Pro — Rediseño Neon Glass

PWA instalable para controlar gastos de tarjetas, pagos pendientes y calendario.

## Rediseño incluido
- Estética oscura premium tipo app móvil.
- Fondo morado/negro con textura de grid suave.
- Tarjetas glassmorphism con transparencias, bordes luminosos y sombras.
- Botones neón, degradados violeta/azul y acentos verde/amarillo.
- Mantiene los mismos IDs y la lógica de `app.js`, por lo que conserva las funciones actuales.

## Qué incluye
- Registro de gasto, monto pagado y restante.
- Calendario de futuros pagos.
- Calculadora interna.
- Tarjetas personalizables.
- Exportación e importación JSON.
- Campo preparado para endpoint de integración con CuentaAtrás.

## Subir a GitHub
1. Descomprime el ZIP.
2. Sube todos los archivos del folder `gastos-ios-pwa-neon` a tu repo.
3. En GitHub activa Pages: Settings > Pages > Deploy from branch > main.
4. Abre la URL en el celular y usa “Agregar a pantalla de inicio”.

## Estructura JSON
```json
{
  "expenses": [],
  "cards": ["Santander", "Nu", "Encargos"],
  "apiUrl": "",
  "countdownUrl": ""
}
```
