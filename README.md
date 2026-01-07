# LifetimeLeveling

App web de productividad estilo RPG. Gamifica habitos diarios con metas, acciones, entrenamiento, logros y progreso por niveles.

## Caracteristicas

- Registro e inicio de sesion
- Panel principal con acciones diarias y recompensas
- Metas y progreso por niveles
- Entrenamiento y estadisticas
- Logros desbloqueables

## Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express, MongoDB, JWT

## Estructura del repo

- `index.html`, `style.css`, `src/` (frontend)
- `server/` (backend API)

## Ejecutar en local

Backend:
1) Copia `server/.env.example` a `server/.env` y completa valores.
2) Instala dependencias desde `server/`:
   - `npm install`
3) Inicia el servidor:
   - `npm run dev` o `node src/index.js`

Frontend:
- Abri `index.html` con Live Server o un servidor estatico simple.

## Endpoints principales

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `PATCH /api/auth/me/password`
- `GET /api/state`
- `PUT /api/state`
- `POST /api/state/reset`