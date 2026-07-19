/* Copiloto — tablero de auto. Vanilla JS, sin dependencias (salvo Leaflet para el mapa). */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // ---------- Reloj ----------
  const dias = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  function tickClock() {
    const d = new Date();
    let h = d.getHours(), m = d.getMinutes();
    $("clock").textContent = `${h}:${String(m).padStart(2, "0")}`;
    $("date").textContent = `${dias[d.getDay()]}, ${d.getDate()} ${meses[d.getMonth()]}`;
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------- Velocímetro (arco SVG) ----------
  const MAX_KMH = 160;
  const R = 120, CX = 150, CY = 150;
  const A0 = 135, A1 = 405; // grados: arco de 270°
  function polar(cx, cy, r, deg) {
    const rad = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }
  function arcPath(fromDeg, toDeg) {
    const [x0, y0] = polar(CX, CY, R, fromDeg);
    const [x1, y1] = polar(CX, CY, R, toDeg);
    const large = (toDeg - fromDeg) % 360 > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  $("gaugeTrack").setAttribute("d", arcPath(A0, A1));
  const valuePath = $("gaugeValue");
  const fullLen = (2 * Math.PI * R) * ((A1 - A0) / 360);
  valuePath.setAttribute("d", arcPath(A0, A1));
  valuePath.style.strokeDasharray = fullLen;
  valuePath.style.strokeDashoffset = fullLen;
  function renderSpeed(kmh) {
    const v = clamp(Math.round(kmh), 0, 999);
    $("speed").textContent = v;
    const frac = clamp(kmh / MAX_KMH, 0, 1);
    valuePath.style.strokeDashoffset = fullLen * (1 - frac);
  }
  renderSpeed(0);

  // ---------- Brújula ----------
  const dirs = ["N","NE","E","SE","S","SO","O","NO"];
  function headingText(deg) {
    if (deg == null || isNaN(deg)) return "—";
    return dirs[Math.round(deg / 45) % 8];
  }
  let lastHeading = null;
  function setHeading(deg) {
    if (deg == null || isNaN(deg)) return;
    lastHeading = deg;
    $("heading").textContent = headingText(deg);
    $("headingArrow").style.transform = `rotate(${deg}deg)`;
  }

  // ---------- Estado del viaje ----------
  const trip = { dist: 0, max: 0, moving: 0, start: Date.now(), prev: null };
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}:${String(m).padStart(2,"0")}` : `${m}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  }
  function renderTrip() {
    $("tDist").textContent = `${trip.dist.toFixed(1)} km`;
    $("tMax").textContent = `${Math.round(trip.max)} km/h`;
    const avg = trip.moving > 0 ? (trip.dist / (trip.moving / 3600000)) : 0;
    $("tAvg").textContent = `${Math.round(avg)} km/h`;
    $("tTime").textContent = fmtTime(Date.now() - trip.start);
  }
  setInterval(renderTrip, 1000);
  function resetTrip() {
    trip.dist = 0; trip.max = 0; trip.moving = 0; trip.start = Date.now(); trip.prev = null;
    renderTrip();
  }
  $("tripReset").addEventListener("click", resetTrip);

  // ---------- Distancia (haversine) ----------
  function haversine(a, b) {
    const toR = Math.PI / 180, r = 6371000;
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dLon/2)**2;
    return 2 * r * Math.asin(Math.sqrt(s));
  }
  function bearing(a, b) {
    const toR = Math.PI/180, toD = 180/Math.PI;
    const y = Math.sin((b.lon-a.lon)*toR) * Math.cos(b.lat*toR);
    const x = Math.cos(a.lat*toR)*Math.sin(b.lat*toR) - Math.sin(a.lat*toR)*Math.cos(b.lat*toR)*Math.cos((b.lon-a.lon)*toR);
    return (Math.atan2(y, x) * toD + 360) % 360;
  }

  // ---------- Mapa (Leaflet) ----------
  let map = null, meMarker = null, dayTiles = null, nightTiles = null, firstFix = true;
  function initMap() {
    if (map || typeof L === "undefined") return;
    map = L.map("map", { zoomControl: false, attributionControl: true, preferCanvas: true }).setView([32.46, -114.77], 15); // San Luis Río Colorado por defecto
    nightTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap © CARTO",
    });
    dayTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap © CARTO",
    });
    applyMapTheme();
    const icon = L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [20,20], iconAnchor: [10,10] });
    meMarker = L.marker([32.46, -114.77], { icon }).addTo(map);
  }
  function applyMapTheme() {
    if (!map) return;
    const day = document.body.classList.contains("day");
    if (day) { map.removeLayer(nightTiles); dayTiles.addTo(map); }
    else { map.removeLayer(dayTiles); nightTiles.addTo(map); }
  }
  function updateMap(lat, lon) {
    if (!map) return;
    meMarker.setLatLng([lat, lon]);
    map.setView([lat, lon], firstFix ? 16 : map.getZoom(), { animate: !firstFix });
    firstFix = false;
    $("mapMsg").classList.add("hidden");
  }

  // ---------- Clima (Open-Meteo, sin llave) ----------
  const WMO = {
    0:["Despejado","☀️"],1:["Mayormente despejado","🌤️"],2:["Parcial nublado","⛅"],3:["Nublado","☁️"],
    45:["Niebla","🌫️"],48:["Niebla","🌫️"],51:["Llovizna","🌦️"],53:["Llovizna","🌦️"],55:["Llovizna","🌦️"],
    61:["Lluvia","🌧️"],63:["Lluvia","🌧️"],65:["Lluvia fuerte","🌧️"],71:["Nieve","🌨️"],73:["Nieve","🌨️"],75:["Nieve","🌨️"],
    80:["Chubascos","🌦️"],81:["Chubascos","🌧️"],82:["Chubascos","⛈️"],95:["Tormenta","⛈️"],96:["Tormenta","⛈️"],99:["Tormenta","⛈️"],
  };
  let wxTimer = null, autoTheme = true;
  async function fetchWeather(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
      const r = await fetch(url);
      const j = await r.json();
      const c = j.current || {};
      const [desc, ico] = WMO[c.weather_code] || ["—","·"];
      $("wxTemp").textContent = `${Math.round(c.temperature_2m)}°`;
      $("wxDesc").textContent = desc;
      $("wxIcon").textContent = ico;
      if (j.daily) $("wxHiLo").textContent = `${Math.round(j.daily.temperature_2m_max[0])}° / ${Math.round(j.daily.temperature_2m_min[0])}°`;
      if (autoTheme) setTheme(c.is_day ? "day" : "night", true);
    } catch (e) { /* sin red: se queda como está */ }
  }

  // ---------- Tema día / noche / auto ----------
  let themeMode = "auto"; // auto | day | night
  function setTheme(mode, fromAuto) {
    if (!fromAuto) { themeMode = mode; autoTheme = (mode === "auto"); }
    const day = (mode === "day") || (fromAuto && mode === "day");
    document.body.classList.toggle("day", mode === "day");
    document.querySelector('meta[name=theme-color]').setAttribute("content", (mode === "day") ? "#dfe6f2" : "#05070d");
    applyMapTheme();
  }
  $("themeBtn").addEventListener("click", () => {
    themeMode = themeMode === "auto" ? "day" : themeMode === "day" ? "night" : "auto";
    autoTheme = (themeMode === "auto");
    if (themeMode === "day") setTheme("day");
    else if (themeMode === "night") setTheme("night");
    else if (lastWx) fetchWeather(lastWx.lat, lastWx.lon);
    $("themeBtn").textContent = themeMode === "auto" ? "◐" : themeMode === "day" ? "☀" : "☾";
  });

  // ---------- GPS ----------
  let lastWx = null, watchId = null;
  function onPos(pos) {
    const { latitude: lat, longitude: lon, speed, heading, accuracy } = pos.coords;
    $("net").textContent = "GPS"; $("net").className = "pill net live";

    // velocidad: usa la del GPS si existe; si no, se calcula del movimiento
    let kmh = (speed != null && speed >= 0) ? speed * 3.6 : null;
    const cur = { lat, lon, t: pos.timestamp };
    if (trip.prev) {
      const d = haversine(trip.prev, cur);       // metros
      const dt = (cur.t - trip.prev.t) / 1000;   // seg
      if (kmh == null && dt > 0) kmh = (d / dt) * 3.6;
      // acumula distancia solo si es movimiento real (evita ruido del GPS parado)
      if (d > 3 && d < 400 && (accuracy == null || accuracy < 60)) {
        trip.dist += d / 1000;
        trip.moving += (cur.t - trip.prev.t);
        if (kmh == null || (heading == null)) setHeading(bearing(trip.prev, cur));
      }
    }
    trip.prev = cur;

    if (kmh == null) kmh = 0;
    if (kmh < 2) kmh = 0; // umbral: parado
    renderSpeed(kmh);
    if (kmh > trip.max) trip.max = kmh;
    if (heading != null && !isNaN(heading)) setHeading(heading);

    updateMap(lat, lon);

    // clima: primera vez y luego cada 10 min
    if (!lastWx || haversine(lastWx, cur) > 3000) {
      lastWx = { lat, lon };
      fetchWeather(lat, lon);
      if (!wxTimer) wxTimer = setInterval(() => lastWx && fetchWeather(lastWx.lat, lastWx.lon), 600000);
    }
  }
  function onPosErr(err) {
    $("net").textContent = "SIN GPS"; $("net").className = "pill net off";
    $("mapMsg").textContent = err.code === 1 ? "Permite Ubicación para el mapa" : "Buscando señal…";
    $("mapMsg").classList.remove("hidden");
  }
  function startGPS() {
    if (!("geolocation" in navigator)) { onPosErr({ code: 2 }); return; }
    if (watchId != null) return;
    watchId = navigator.geolocation.watchPosition(onPos, onPosErr, {
      enableHighAccuracy: true, maximumAge: 1000, timeout: 20000,
    });
  }

  // ---------- Brújula real (iOS: pide permiso con gesto) ----------
  function startCompass() {
    const handler = (e) => {
      let h = null;
      if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading; // iOS
      else if (e.alpha != null) h = 360 - e.alpha;
      if (h != null) setHeading(h);
    };
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().then((s) => {
        if (s === "granted") window.addEventListener("deviceorientation", handler, true);
      }).catch(() => {});
    } else {
      window.addEventListener("deviceorientationabsolute", handler, true);
      window.addEventListener("deviceorientation", handler, true);
    }
  }

  // ---------- Pantalla siempre encendida ----------
  let wakeLock = null;
  async function keepAwake() {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => {});
      }
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") keepAwake();
  });

  // ---------- Radio en vivo (streams públicos, HTTPS) ----------
  const stations = [
    { name: "Groove Salad", url: "https://ice1.somafm.com/groovesalad-128-mp3" },
    { name: "Beat Blender", url: "https://ice1.somafm.com/beatblender-128-mp3" },
    { name: "Indie Pop", url: "https://ice1.somafm.com/indiepop-128-mp3" },
    { name: "Fluid · hip-hop", url: "https://ice1.somafm.com/fluid-128-mp3" },
    { name: "Drone Zone", url: "https://ice1.somafm.com/dronezone-128-mp3" },
  ];
  let sIdx = 0, playing = false;
  const audio = $("radio");
  function loadStation(i) {
    sIdx = (i + stations.length) % stations.length;
    audio.src = stations[sIdx].url;
    $("radioNow").textContent = stations[sIdx].name;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: stations[sIdx].name, artist: "Copiloto Radio" });
    }
  }
  function playRadio() { audio.play().then(() => { playing = true; $("radioToggle").textContent = "❚❚"; }).catch(() => {}); }
  function pauseRadio() { audio.pause(); playing = false; $("radioToggle").textContent = "▶"; }
  $("radioToggle").addEventListener("click", () => {
    if (!audio.src) loadStation(0);
    playing ? pauseRadio() : playRadio();
  });
  $("radioNext").addEventListener("click", () => { loadStation(sIdx + 1); if (playing) playRadio(); });
  $("radioPrev").addEventListener("click", () => { loadStation(sIdx - 1); if (playing) playRadio(); });
  $("vol").addEventListener("input", (e) => { audio.volume = parseFloat(e.target.value); });
  audio.volume = 0.7;

  // ---------- Botones de navegación con coordenadas reales ----------
  function wireNav() {
    document.getElementById("gmaps").addEventListener("click", (e) => {
      if (lastWx) { e.currentTarget.href = `https://www.google.com/maps/@${lastWx.lat},${lastWx.lon},15z`; }
    });
  }
  wireNav();

  // ---------- Arranque (un gesto desbloquea todo en iOS) ----------
  function boot() {
    $("start").classList.add("hidden");
    $("app").classList.remove("hidden");
    initMap();
    setTimeout(() => map && map.invalidateSize(), 200);
    startGPS();
    startCompass();
    keepAwake();
    loadStation(0);
    // aviso de instalar a pantalla completa (solo si NO es modo app)
    const standalone = window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    if (!standalone) {
      setTimeout(() => $("installTip").classList.remove("hidden"), 1500);
    }
  }
  $("startBtn").addEventListener("click", boot, { once: true });
  $("installClose").addEventListener("click", () => $("installTip").classList.add("hidden"));

  // ---------- Service worker (PWA offline) ----------
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
