# Proxy GEO Diageo

Proxy en Express que valida usuarios y registra ubicaciones contra la API de SmartData.

## Variables de entorno (Railway)

| Variable    | Descripción                                        |
|-------------|----------------------------------------------------|
| `API_TOKEN` | Token de la API (solo el valor, sin `Token `)      |
| `PORT`      | Lo asigna Railway automáticamente                  |

## Endpoints

- `GET  /api/validar?cedula=XXXXX`: busca la cédula en `usuarios_diageo`
- `POST /api/enviar-ubicacion`: body `{ CEDULA, LATITUD, LONGITUD }`, guarda en `registro_ubicacion_dieageo`
- `POST /api/debug`: devuelve lo recibido
- `GET  /health`

## Local

```bash
npm install
API_TOKEN=xxxx npm start
```
