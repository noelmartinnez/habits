# Rutinas (móvil)

App de hábitos y ánimo para iPhone y Android, hecha con Expo (SDK 57).

- Marcar un hábito cuesta un toque. Cada hábito marcado sube una nota.
- El **cierre del día** dura unos 15 s: ánimo, qué marcó el día y, para cada hábito que faltó, por qué.
- **Descubrimientos** explica en lenguaje normal qué hace que tus días vayan mejor o peor, diciendo siempre con cuántos días se ha calculado.

## Probar en el iPhone (sin Mac ni cuenta de pago)

1. Instala **Expo Go** desde la App Store.
2. En el PC, dentro de esta carpeta:
   ```sh
   npm start
   ```
3. Escanea el código QR con la cámara del iPhone. El PC y el iPhone deben estar en la misma Wi‑Fi. Si Windows pregunta por el cortafuegos, permite Node en redes privadas.
   Si no conecta, usa `npx expo start --tunnel`.

Los cambios en el código se ven al momento en el iPhone.

## Traer los datos de Rutinas (escritorio)

```sh
node scripts/export-rutinas.mjs
```

Esto genera `rutinas-export.json`. La base de datos de escritorio solo se lee, no se modifica.

1. Pasa el archivo al iPhone, por ejemplo por iCloud Drive, OneDrive o correo, y guárdalo en Archivos.
2. En la app: **Ajustes → Importar copia**.

## Comandos

| | |
|---|---|
| `npm test` | tests de la lógica (rachas, fuerza, descubrimientos, avisos, copias) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `node scripts/gen-sounds.mjs` | vuelve a sintetizar los sonidos de `assets/sounds` |

## Estructura

- `src/app/`: pantallas (Expo Router).
- `src/core/`: lógica pura y con tests (fechas, rachas, fuerza, descubrimientos, avisos, copias).
- `src/db/`: SQLite (`expo-sqlite`) y migraciones.
- `src/store/`: estado (zustand).
- `src/juice/`: sonido y vibración.
- `src/ui/`: componentes.
