# Copiloto — Tablero de Auto para iPad

App web (PWA) que convierte tu iPad en el tablero del carro: velocidad, mapa en vivo,
clima, brújula, viaje, y lanzadores de música/navegación + radio en vivo.

## Cómo se usa en el iPad
1. Abre la URL en **Safari**.
2. **Compartir → Añadir a inicio** (así abre a pantalla completa, sin barras).
3. Ábrela desde el ícono. Toca **INICIAR** y **permite Ubicación**.
4. Monta el iPad en el carro. La pantalla se queda encendida sola.

## Qué hace (y qué no)
- **Sí:** reloj, velocímetro (GPS), brújula, mapa que te sigue, clima, medidor de viaje,
  día/noche automático, pantalla siempre encendida, radio en vivo dentro de la app.
- **No puede** controlar la reproducción de Spotify/Apple Music por dentro (Apple lo
  bloquea para apps web). Por eso hay **botones que saltan** a esas apps con un toque.

## Correr local
```bash
npm start      # sirve ./public en el PORT (default 3000)
```
Sin dependencias (Node puro). En producción lo sirve Railway con `npm start`.

## Notas técnicas
- GPS, brújula y pantalla-encendida requieren **HTTPS** (por eso va desplegado).
- Mapa: Leaflet + tiles CARTO. Clima: Open-Meteo (sin llave). Radio: streams SomaFM.
- Todo lo esencial (reloj, velocidad, brújula, viaje) funciona **sin internet**.
