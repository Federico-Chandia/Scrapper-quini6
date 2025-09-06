# Quini 6 Scrapper

Scrapper web para obtener los resultados de Quini 6 desde https://www.quini-6-resultados.com.ar/

## Instalación

```bash
npm install
```

## Uso

```bash
npm start
```

## Endpoints

- `GET /` - Información de la API
- `GET /resultados` - Obtener los últimos resultados de Quini 6 (incluye Pozo Extra)
- `GET /todoslossorteos` - Obtener los últimos 10 sorteos completos
- `GET /cargarhistoricos` - Cargar sorteos históricos desde la página web

## Ejemplo de respuesta

```json
{
  "success": true,
  "data": [
    {
      "sorteo": "TRADICIONAL",
      "numeros": "20 - 24 - 29 - 33 - 39 - 43"
    },
    {
      "sorteo": "LA SEGUNDA",
      "numeros": "06 - 16 - 25 - 39 - 42 - 44"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```