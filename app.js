/* Copiloto v2 — tablero de auto estilo CarPlay. Vanilla JS + Leaflet. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const clamp = (n,a,b) => Math.max(a, Math.min(b,n));

  // ---------- Catálogo de apps ----------
  const APPS = [
    { id:"tablero",  name:"Tablero", type:"view", view:"dash",    emoji:"🚗", grad:["#3a7bff","#39d0ff"] },
    { id:"mapas",    name:"Mapas",   type:"view", view:"maps",    emoji:"🗺️", grad:["#34c759","#5ac8fa"] },
    { id:"musica",   name:"Música",  type:"view", view:"music",   emoji:"🎵", grad:["#fb5c74","#fa2b56"] },
    { id:"spotify",  name:"Spotify", type:"link", url:"https://open.spotify.com",     emoji:"🎧", grad:["#1ed760","#1db954"] },
    { id:"radio",    name:"Radio",   type:"view", view:"radio",   emoji:"📻", grad:["#ff9f0a","#ff375f"] },
    { id:"ytmusic",  name:"YT Music",type:"link", url:"https://music.youtube.com",    emoji:"▶️", grad:["#ff2d2d","#cc0000"] },
    { id:"podcasts", name:"Podcasts",type:"link", url:"https://podcasts.apple.com",   emoji:"🎙️", grad:["#a24cf0","#7b2ff7"] },
    { id:"waze",     name:"Waze",    type:"link", url:"https://waze.com/ul",          emoji:"🧭", grad:["#33ccff","#0aa3d6"] },
    { id:"google",   name:"Google Maps",type:"link", url:"https://maps.google.com",   emoji:"📍", grad:["#4285f4","#34a853"] },
    { id:"clima",    name:"Clima",   type:"view", view:"weather", emoji:"⛅", grad:["#4a90d9","#63b8ff"] },
    { id:"ajustes",  name:"Ajustes", type:"view", view:"settings",emoji:"⚙️", grad:["#8e8e93","#5b5b60"] },
  ];
  const APP = Object.fromEntries(APPS.map(a=>[a.id,a]));

  const ACCENTS = {
    blue:["#3a7bff","#39d0ff"], green:["#2fbf5f","#37e0a1"], purple:["#7b5bff","#b06bff"],
    orange:["#ff9f0a","#ff6b3d"], red:["#ff453a","#ff6b6b"], pink:["#ff375f","#ff7eb3"], teal:["#12b7c4","#37e0e0"],
  };
  const WALLS = ["aurora","carbon","teal","sunset","slate","ocean"];
  const WALL_PREVIEW = {
    aurora:"linear-gradient(135deg,#141b3a,#05070d)", carbon:"linear-gradient(135deg,#26282c,#050506)",
    teal:"linear-gradient(135deg,#0a2a2a,#04100f)", sunset:"linear-gradient(135deg,#2a1330,#0b0710)",
    slate:"linear-gradient(135deg,#1a2130,#080a0f)", ocean:"linear-gradient(135deg,#0a2036,#040910)",
  };

  // ---------- Estado (persistido) ----------
  const DEFAULT = { accent:"blue", wall:"aurora", mode:"auto", units:"kmh", dashLayout:"mapBig",
    order:APPS.map(a=>a.id), hidden:[] };
  let state = load();
  function load(){ try{ const s=JSON.parse(localStorage.getItem("copiloto")||"{}");
    return Object.assign({}, DEFAULT, s, { order: mergeOrder(s.order), hidden: s.hidden||[] }); }
    catch(e){ return {...DEFAULT}; } }
  function mergeOrder(saved){ const ids=APPS.map(a=>a.id); const o=(saved||[]).filter(x=>ids.includes(x));
    ids.forEach(x=>{ if(!o.includes(x)) o.push(x); }); return o; }
  function save(){ localStorage.setItem("copiloto", JSON.stringify(state)); }

  // ---------- Aplicar tema ----------
  function applyTheme(){
    const [a,a2]=ACCENTS[state.accent]||ACCENTS.blue;
    document.documentElement.style.setProperty("--accent",a);
    document.documentElement.style.setProperty("--accent2",a2);
    WALLS.forEach(w=>document.body.classList.remove("wp-"+w));
    document.body.classList.add("wp-"+state.wall);
    resolveMode();
  }
  let autoIsDay=false;
  function resolveMode(){
    const day = state.mode==="day" || (state.mode==="auto" && autoIsDay);
    document.body.classList.toggle("day", day);
    const meta=document.querySelector('meta[name=theme-color]');
    if(meta) meta.setAttribute("content", day ? "#e7ecf5" : "#05070d");
    if(map) applyMapTheme();
  }

  // ---------- Unidades ----------
  function U(){ return state.units==="mph"
    ? { f:0.621371, label:"mph", max:100, df:0.621371, dl:"mi" }
    : { f:1, label:"km/h", max:160, df:1, dl:"km" }; }

  // ---------- Reloj ----------
  const dias=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const meses=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  function tickClock(){ const d=new Date();
    const hhmm=`${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`;
    const fecha=`${dias[d.getDay()]}, ${d.getDate()} ${meses[d.getMonth()]}`;
    $("clock").textContent=hhmm;
    const pc=$("pClock"); if(pc) pc.textContent=hhmm;
    const pd=$("pDate"); if(pd) pd.textContent=fecha;
    const hh=$("homeHello"); if(hh){ const h=d.getHours();
      hh.textContent = h<12?"Buenos días":h<19?"Buenas tardes":"Buenas noches"; }
  }
  tickClock(); setInterval(tickClock,1000);

  // ---------- Velocímetro ----------
  const R=120,CX=150,CY=150,A0=135,A1=405;
  function polar(r,deg){ const rad=(deg-90)*Math.PI/180; return [CX+r*Math.cos(rad),CY+r*Math.sin(rad)]; }
  function arcPath(f,t){ const [x0,y0]=polar(R,f),[x1,y1]=polar(R,t); const large=(t-f)%360>180?1:0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; }
  const fullLen=(2*Math.PI*R)*((A1-A0)/360);
  $("gaugeTrack").setAttribute("d",arcPath(A0,A1));
  $("gaugeValue").setAttribute("d",arcPath(A0,A1));
  $("gaugeValue").style.strokeDasharray=fullLen;
  $("gaugeValue").style.strokeDashoffset=fullLen;
  let speedKmh=0;
  function renderSpeed(){ const u=U(); const disp=speedKmh*u.f;
    const v=Math.round(clamp(disp,0,999));
    $("speed").textContent=v;
    $("speedUnit").textContent=u.label;
    const ps=$("pmSpeed"); if(ps) ps.textContent=v;
    const pu=$("pmUnit"); if(pu) pu.textContent=u.label;
    const frac=clamp(disp/u.max,0,1);
    $("gaugeValue").style.strokeDashoffset=fullLen*(1-frac); }

  // ---------- Brújula ----------
  const dirs=["N","NE","E","SE","S","SO","O","NO"];
  function setHeading(deg){ if(deg==null||isNaN(deg))return;
    $("heading").textContent=dirs[Math.round(deg/45)%8];
    $("headingArrow").style.transform=`rotate(${deg}deg)`; }

  // ---------- Viaje ----------
  const trip={dist:0,max:0,moving:0,start:Date.now(),prev:null};
  function fmtTime(ms){ const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
    return h>0?`${h}:${String(m).padStart(2,"0")}`:`${m}:${String(Math.floor(s%60)).padStart(2,"0")}`; }
  function renderTrip(){ const u=U();
    $("tDist").textContent=`${(trip.dist*u.df).toFixed(1)} ${u.dl}`;
    $("tMax").textContent=`${Math.round(trip.max*u.f)}`;
    const avg=trip.moving>0?(trip.dist/(trip.moving/3600000)):0;
    $("tAvg").textContent=`${Math.round(avg*u.f)}`;
    $("tTime").textContent=fmtTime(Date.now()-trip.start); }
  setInterval(renderTrip,1000);
  $("tripReset").addEventListener("click",()=>{ trip.dist=0;trip.max=0;trip.moving=0;trip.start=Date.now();trip.prev=null; renderTrip(); });

  function haversine(a,b){ const toR=Math.PI/180,r=6371000;
    const dLat=(b.lat-a.lat)*toR,dLon=(b.lon-a.lon)*toR;
    const s=Math.sin(dLat/2)**2+Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dLon/2)**2;
    return 2*r*Math.asin(Math.sqrt(s)); }
  function bearing(a,b){ const toR=Math.PI/180,toD=180/Math.PI;
    const y=Math.sin((b.lon-a.lon)*toR)*Math.cos(b.lat*toR);
    const x=Math.cos(a.lat*toR)*Math.sin(b.lat*toR)-Math.sin(a.lat*toR)*Math.cos(b.lat*toR)*Math.cos((b.lon-a.lon)*toR);
    return (Math.atan2(y,x)*toD+360)%360; }

  // ---------- Mapa ----------
  let map=null,meMarker=null,dayTiles=null,nightTiles=null,firstFix=true,lastPos=null;
  function initMap(){ if(map||typeof L==="undefined")return;
    map=L.map("map",{zoomControl:false,attributionControl:true,preferCanvas:true}).setView([32.46,-114.77],15);
    nightTiles=L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:19,attribution:"© OpenStreetMap © CARTO"});
    dayTiles=L.tileLayer("https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:19,attribution:"© OpenStreetMap © CARTO"});
    const icon=L.divIcon({className:"",html:'<div class="me-dot"></div>',iconSize:[20,20],iconAnchor:[10,10]});
    meMarker=L.marker([32.46,-114.77],{icon}).addTo(map);
    applyMapTheme();
  }
  function applyMapTheme(){ if(!map)return; const day=document.body.classList.contains("day");
    if(day){ if(nightTiles&&map.hasLayer(nightTiles))map.removeLayer(nightTiles); dayTiles.addTo(map); }
    else { if(dayTiles&&map.hasLayer(dayTiles))map.removeLayer(dayTiles); nightTiles.addTo(map); } }
  function mountMap(slotId){ const el=$("map"); const slot=$(slotId);
    if(slot && el.parentElement!==slot){ slot.appendChild(el); }
    const fix=()=>{ if(map){ map.invalidateSize(true); if(lastPos) map.setView([lastPos.lat,lastPos.lon]); } };
    requestAnimationFrame(fix); setTimeout(fix,150); setTimeout(fix,450); }
  function stowMap(){ const el=$("map"),h=$("mapHolder"); if(el.parentElement!==h) h.appendChild(el); }
  function updateMap(lat,lon){ if(!map)return; meMarker.setLatLng([lat,lon]);
    if(currentView==="panel"||currentView==="dash"||currentView==="maps"){ map.setView([lat,lon], firstFix?16:map.getZoom(), {animate:!firstFix}); }
    firstFix=false; const mm=$("mapMsg"); if(mm) mm.classList.add("hidden"); }

  // ---------- Clima ----------
  const WMO={0:["Despejado","☀️"],1:["Mayormente despejado","🌤️"],2:["Parcial nublado","⛅"],3:["Nublado","☁️"],
    45:["Niebla","🌫️"],48:["Niebla","🌫️"],51:["Llovizna","🌦️"],53:["Llovizna","🌦️"],55:["Llovizna","🌦️"],
    61:["Lluvia","🌧️"],63:["Lluvia","🌧️"],65:["Lluvia fuerte","🌧️"],71:["Nieve","🌨️"],73:["Nieve","🌨️"],75:["Nieve","🌨️"],
    80:["Chubascos","🌦️"],81:["Chubascos","🌧️"],82:["Tormenta","⛈️"],95:["Tormenta","⛈️"],96:["Tormenta","⛈️"],99:["Tormenta","⛈️"]};
  let wxTimer=null,lastWxAt=null;
  async function fetchWeather(lat,lon){ try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
    const j=await (await fetch(url)).json(); const c=j.current||{}; const [desc,ico]=WMO[c.weather_code]||["—","·"];
    const hi=j.daily?Math.round(j.daily.temperature_2m_max[0]):null, lo=j.daily?Math.round(j.daily.temperature_2m_min[0]):null;
    const resumen=`${ico} ${Math.round(c.temperature_2m)}° · ${desc}`;
    if($("homeWx")) $("homeWx").textContent=resumen;
    if($("pWx")) $("pWx").textContent=resumen;
    $("wxHeroIco").textContent=ico; $("wxHeroTemp").textContent=`${Math.round(c.temperature_2m)}°`;
    $("wxHeroDesc").textContent=desc; if(hi!=null)$("wxMax").textContent=`${hi}°`; if(lo!=null)$("wxMin").textContent=`${lo}°`;
    $("wxWind").textContent=`${Math.round(c.wind_speed_10m)} km/h`; $("wxFeel").textContent=`${Math.round(c.apparent_temperature)}°`;
    autoIsDay=!!c.is_day; if(state.mode==="auto") resolveMode();
  }catch(e){} }

  // ---------- GPS ----------
  let watchId=null;
  function onPos(pos){ const {latitude:lat,longitude:lon,speed,heading,accuracy}=pos.coords;
    $("net").textContent="GPS"; $("net").className="dock-gps live";
    let kmh=(speed!=null&&speed>=0)?speed*3.6:null; const cur={lat,lon,t:pos.timestamp}; lastPos=cur;
    if(trip.prev){ const d=haversine(trip.prev,cur),dt=(cur.t-trip.prev.t)/1000;
      if(kmh==null&&dt>0) kmh=(d/dt)*3.6;
      if(d>3&&d<400&&(accuracy==null||accuracy<60)){ trip.dist+=d/1000; trip.moving+=(cur.t-trip.prev.t);
        if(heading==null) setHeading(bearing(trip.prev,cur)); } }
    trip.prev=cur;
    if(kmh==null)kmh=0; if(kmh<2)kmh=0; speedKmh=kmh; renderSpeed();
    if(kmh>trip.max) trip.max=kmh;
    if(heading!=null&&!isNaN(heading)) setHeading(heading);
    updateMap(lat,lon);
    if(!lastWxAt||haversine(lastWxAt,cur)>3000){ lastWxAt=cur; fetchWeather(lat,lon);
      if(!wxTimer) wxTimer=setInterval(()=>lastWxAt&&fetchWeather(lastWxAt.lat,lastWxAt.lon),600000); }
  }
  function onPosErr(err){ $("net").textContent="SIN GPS"; $("net").className="dock-gps off";
    const mm=$("mapMsg"); if(mm){ mm.textContent=err.code===1?"Permite Ubicación para el mapa":"Buscando señal…"; mm.classList.remove("hidden"); } }
  function startGPS(){ if(!("geolocation" in navigator)){onPosErr({code:2});return;} if(watchId!=null)return;
    watchId=navigator.geolocation.watchPosition(onPos,onPosErr,{enableHighAccuracy:true,maximumAge:1000,timeout:20000}); }

  function startCompass(){ const handler=(e)=>{ let h=null;
      if(typeof e.webkitCompassHeading==="number")h=e.webkitCompassHeading; else if(e.alpha!=null)h=360-e.alpha;
      if(h!=null)setHeading(h); };
    if(typeof DeviceOrientationEvent!=="undefined"&&typeof DeviceOrientationEvent.requestPermission==="function"){
      DeviceOrientationEvent.requestPermission().then(s=>{ if(s==="granted")window.addEventListener("deviceorientation",handler,true); }).catch(()=>{});
    } else { window.addEventListener("deviceorientationabsolute",handler,true); window.addEventListener("deviceorientation",handler,true); } }

  // ---------- Pantalla encendida ----------
  let wakeLock=null;
  async function keepAwake(){ try{ if("wakeLock" in navigator) wakeLock=await navigator.wakeLock.request("screen"); }catch(e){} }
  document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible")keepAwake(); });
  window.addEventListener("resize",()=>{ if(map) map.invalidateSize(); });

  // ---------- Radio ----------
  const stations=[
    {name:"Groove Salad",url:"https://ice1.somafm.com/groovesalad-128-mp3"},
    {name:"Beat Blender",url:"https://ice1.somafm.com/beatblender-128-mp3"},
    {name:"Indie Pop",url:"https://ice1.somafm.com/indiepop-128-mp3"},
    {name:"Fluid · hip-hop",url:"https://ice1.somafm.com/fluid-128-mp3"},
    {name:"Drone Zone",url:"https://ice1.somafm.com/dronezone-128-mp3"},
  ];
  let sIdx=0,playing=false; const audio=$("radio"); audio.volume=0.7;
  function renderStations(){ const w=$("stations"); w.innerHTML="";
    stations.forEach((s,i)=>{ const b=document.createElement("button"); b.className="station-chip"+(i===sIdx?" active":"");
      b.textContent=s.name; b.onclick=()=>{ loadStation(i); playRadio(); }; w.appendChild(b); }); }
  function syncNow(){ const s=stations[sIdx]; const el=$("npTitle"); if(el) el.textContent=s.name;
    const rt=$("radioToggle"); if(rt) rt.textContent=playing?"❚❚":"▶"; }
  function loadStation(i){ sIdx=(i+stations.length)%stations.length; audio.src=stations[sIdx].url;
    if("mediaSession" in navigator) navigator.mediaSession.metadata=new MediaMetadata({title:stations[sIdx].name,artist:"Copiloto Radio"});
    renderStations(); syncNow(); }
  function playRadio(){ audio.play().then(()=>{playing=true;syncNow();}).catch(()=>{}); }
  function pauseRadio(){ audio.pause(); playing=false; syncNow(); }
  function toggleRadio(){ if(!audio.src)loadStation(0); playing?pauseRadio():playRadio(); }
  $("radioToggle").addEventListener("click",toggleRadio);
  $("radioNext").addEventListener("click",()=>{ loadStation(sIdx+1); if(playing)playRadio(); });
  $("radioPrev").addEventListener("click",()=>{ loadStation(sIdx-1); if(playing)playRadio(); });
  $("vol").addEventListener("input",e=>audio.volume=parseFloat(e.target.value));

  // ---------- Música (reproductor de YouTube, en vivo) ----------
  let ytPlayer=null, ytReady=false, ytPlaying=false, ytPending=null;
  const YT_PRESETS=[ {name:"Radio Pop",id:"RDdQw4w9WgXcQ",kind:"list"}, {name:"Fiesta",id:"RDOPf0YbXqDm0",kind:"list"} ];
  window.onYouTubeIframeAPIReady=function(){ ytReady=true; };
  function ensureYT(){ if(ytPlayer||!ytReady||typeof YT==="undefined"||!YT.Player) return;
    ytPlayer=new YT.Player("ytplayer",{ height:"100%", width:"100%",
      playerVars:{ playsinline:1, rel:0, modestbranding:1 },
      events:{ onReady:()=>{ if(ytPending){ loadYT(ytPending); ytPending=null; } syncMusic(); },
               onStateChange:e=>{ ytPlaying=(e.data===1); syncMusic(); } } }); }
  function parseYT(input){ input=(input||"").trim(); let video=null,list=null;
    try{ const u=new URL(input); list=u.searchParams.get("list");
      if(u.hostname.indexOf("youtu.be")>=0) video=u.pathname.slice(1); else video=u.searchParams.get("v"); }
    catch(_){ if(/^[A-Za-z0-9_-]{11}$/.test(input)) video=input; }
    return {video,list}; }
  function loadYT(arg){ ensureYT(); if(!ytPlayer){ ytPending=arg; return; }
    if(arg.list) ytPlayer.loadPlaylist({list:arg.list}); else if(arg.video) ytPlayer.loadVideoById(arg.video); }
  function playFromInput(){ const p=parseYT($("ytInput").value);
    if(p.list) loadYT({list:p.list}); else if(p.video) loadYT({video:p.video}); }
  function syncMusic(){ let title="Música";
    try{ if(ytPlayer&&ytPlayer.getVideoData){ const d=ytPlayer.getVideoData(); if(d&&d.title) title=d.title; } }catch(_){}
    ["ytTitle","pnpTitle"].forEach(id=>{ const el=$(id); if(el) el.textContent=title; });
    const t=ytPlaying?"❚❚":"▶"; ["ytToggle","pnpToggle"].forEach(id=>{ const el=$(id); if(el) el.textContent=t; }); }
  function ytToggleFn(){ ensureYT(); if(!ytPlayer){ setView("music"); return; }
    if(ytPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo(); }
  function ytNextFn(){ if(ytPlayer&&ytPlayer.nextVideo) ytPlayer.nextVideo(); else setView("music"); }
  function ytPrevFn(){ if(ytPlayer&&ytPlayer.previousVideo) ytPlayer.previousVideo(); else setView("music"); }
  function renderPresets(){ const w=$("ytPresets"); if(!w||w.childElementCount)return;
    YT_PRESETS.forEach(p=>{ const b=document.createElement("button"); b.className="station-chip"; b.textContent=p.name;
      b.onclick=()=>{ loadYT(p.kind==="list"?{list:p.id}:{video:p.id}); }; w.appendChild(b); }); }
  $("ytLoad").addEventListener("click",playFromInput);
  $("ytInput").addEventListener("keydown",e=>{ if(e.key==="Enter")playFromInput(); });
  $("ytToggle").addEventListener("click",ytToggleFn);
  $("ytNext").addEventListener("click",ytNextFn);
  $("ytPrev").addEventListener("click",ytPrevFn);
  $("pnpToggle").addEventListener("click",ytToggleFn);
  $("pnpNext").addEventListener("click",ytNextFn);
  $("pnpPrev").addEventListener("click",ytPrevFn);

  // ---------- Navegación (OpenStreetMap + OSRM, sin llaves) ----------
  let routeLayer=null, destMarker=null;
  async function geocode(q){ try{ const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
    const j=await r.json(); if(j&&j[0]) return {lat:+j[0].lat,lon:+j[0].lon,name:j[0].display_name}; }catch(_){} return null; }
  async function fetchRoute(a,b){ try{ const u=`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
    const j=await (await fetch(u)).json(); return j.routes&&j.routes[0]; }catch(_){ return null; } }
  function showNavInfo(eta,dist){ const n=$("navInfo"); if(!n)return; n.classList.remove("hidden");
    n.innerHTML=`<div><div class="ni-eta">${eta}</div><div class="ni-dist">${dist||""}</div></div>`; }
  function clearRoute(){ if(routeLayer&&map){ map.removeLayer(routeLayer); routeLayer=null; }
    if(destMarker&&map){ map.removeLayer(destMarker); destMarker=null; }
    const n=$("navInfo"); if(n) n.classList.add("hidden"); const c=$("navCancel"); if(c) c.classList.add("hidden"); }
  async function startNav(){ const q=$("navDest").value.trim(); if(!q)return;
    if(!lastPos){ showNavInfo("Espera al GPS…","Aún sin ubicación"); return; }
    showNavInfo("Buscando…",""); const dest=await geocode(q);
    if(!dest){ showNavInfo("No lo encontré","Prueba otro nombre"); return; }
    const r=await fetchRoute(lastPos,dest); if(!r){ showNavInfo("Sin ruta","Intenta de nuevo"); return; }
    clearRoute();
    const pts=r.geometry.coordinates.map(c=>[c[1],c[0]]);
    routeLayer=L.polyline(pts,{color:"#3a7bff",weight:7,opacity:.9}).addTo(map);
    destMarker=L.marker([dest.lat,dest.lon]).addTo(map);
    map.fitBounds(routeLayer.getBounds(),{padding:[60,60]});
    showNavInfo(`${Math.round(r.duration/60)} min`, `${(r.distance/1000).toFixed(1)} km · ${dest.name.split(",")[0]}`);
    const c=$("navCancel"); if(c) c.classList.remove("hidden"); }
  $("navGo").addEventListener("click",startNav);
  $("navDest").addEventListener("keydown",e=>{ if(e.key==="Enter")startNav(); });
  $("navCancel").addEventListener("click",()=>{ $("navDest").value=""; clearRoute(); });

  // ---------- Rejilla de inicio ----------
  let editing=false;
  function iconStyle(a){ return `background:linear-gradient(145deg, ${a.grad[0]}, ${a.grad[1]})`; }
  function renderGrid(){ const g=$("grid"); g.innerHTML="";
    state.order.forEach(id=>{ const a=APP[id]; if(!a)return; const hidden=state.hidden.includes(id);
      if(hidden && !editing) return;
      const tile=document.createElement(editing?"div":(a.type==="link"?"a":"div"));
      tile.className="app-tile"+(editing?" editing":"")+(hidden?" is-hidden":"");
      if(!editing && a.type==="link"){ tile.href=a.url; tile.target="_blank"; tile.rel="noopener"; }
      tile.innerHTML=`<div class="app-ico" style="${iconStyle(a)}">${a.emoji}<div class="hide-badge">${hidden?"+":"−"}</div></div><div class="app-name">${a.name}</div>`;
      tile.onclick=(e)=>{ if(editing){ e.preventDefault(); toggleHidden(id); return; }
        if(a.type==="view"){ setView(a.view); } else { openLink(a); } };
      g.appendChild(tile); });
  }
  function openLink(a){ if(a.id==="google"&&lastPos){ window.open(`https://www.google.com/maps/@${lastPos.lat},${lastPos.lon},15z`,"_blank"); return; }
    window.open(a.url,"_blank","noopener"); }
  function toggleHidden(id){ const i=state.hidden.indexOf(id);
    if(i>=0)state.hidden.splice(i,1); else state.hidden.push(id); save(); renderGrid(); renderEditor(); }
  $("editApps").addEventListener("click",()=>{ editing=!editing; $("editApps").textContent=editing?"Listo":"Editar"; renderGrid(); });

  // ---------- Vistas ----------
  let currentView="panel";
  function setView(name){ currentView=name;
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active", v.dataset.view===name));
    document.querySelectorAll(".dock-btn").forEach(b=>b.classList.toggle("active", b.dataset.go===name));
    if(name==="panel"){ mountMap("mapSlotPanel"); }
    else if(name==="dash"){ document.querySelector(".view-dash").dataset.layout=state.dashLayout; mountMap("mapSlotDash"); }
    else if(name==="maps"){ mountMap("mapSlotMaps"); }
    else { stowMap(); }
    if(name==="radio"){ if(!audio.src)loadStation(0); renderStations(); }
    if(name==="music"){ ensureYT(); renderPresets(); }
    if(name==="weather" && lastWxAt) fetchWeather(lastWxAt.lat,lastWxAt.lon);
    if(name==="settings") renderSettings();
    if(name==="home"){ editing=false; $("editApps").textContent="Editar"; renderGrid(); }
  }
  document.querySelectorAll(".dock-btn").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.go)));
  $("recenter").addEventListener("click",()=>{ if(map&&lastPos)map.setView([lastPos.lat,lastPos.lon],16,{animate:true}); });

  // ---------- Ajustes ----------
  function renderSettings(){
    const acc=$("accents"); acc.innerHTML="";
    Object.entries(ACCENTS).forEach(([k,[c1,c2]])=>{ const s=document.createElement("div");
      s.className="swatch"+(state.accent===k?" active":""); s.style.background=`linear-gradient(135deg,${c2},${c1})`;
      s.onclick=()=>{ state.accent=k; save(); applyTheme(); renderSettings(); }; acc.appendChild(s); });
    const w=$("walls"); w.innerHTML="";
    WALLS.forEach(k=>{ const el=document.createElement("div"); el.className="wall"+(state.wall===k?" active":"");
      el.style.background=WALL_PREVIEW[k]; el.onclick=()=>{ state.wall=k; save(); applyTheme(); renderSettings(); }; w.appendChild(el); });
    seg("modeSeg","mode"); seg("unitSeg","units"); seg("layoutSeg","dashLayout");
    renderEditor();
  }
  function seg(id,key){ const el=$(id); el.querySelectorAll("button").forEach(b=>{
    b.classList.toggle("active", state[key]===b.dataset.v);
    b.onclick=()=>{ state[key]=b.dataset.v; save();
      if(key==="mode") resolveMode();
      if(key==="units"){ renderSpeed(); renderTrip(); }
      if(key==="dashLayout"){ const dv=document.querySelector(".view-dash"); if(dv)dv.dataset.layout=state.dashLayout; }
      seg(id,key); }; }); }
  function renderEditor(){ const box=$("appEditor"); box.innerHTML="";
    state.order.forEach((id,idx)=>{ const a=APP[id]; if(!a)return; const off=state.hidden.includes(id);
      const row=document.createElement("div"); row.className="ae-row"+(off?" off":"");
      row.innerHTML=`<div class="ae-ico" style="${iconStyle(a)}">${a.emoji}</div><div class="ae-name">${a.name}</div>`;
      const tg=document.createElement("button"); tg.className="ae-btn ae-toggle"+(off?"":" on"); tg.textContent=off?"○":"●";
      tg.title="Mostrar/ocultar"; tg.onclick=()=>{ toggleHidden(id); };
      const up=document.createElement("button"); up.className="ae-btn"; up.textContent="↑"; up.onclick=()=>move(idx,-1);
      const dn=document.createElement("button"); dn.className="ae-btn"; dn.textContent="↓"; dn.onclick=()=>move(idx,1);
      row.append(tg,up,dn); box.appendChild(row); });
  }
  function move(idx,dir){ const j=idx+dir; if(j<0||j>=state.order.length)return;
    const o=state.order; [o[idx],o[j]]=[o[j],o[idx]]; save(); renderEditor(); renderGrid(); }
  $("resetAll").addEventListener("click",()=>{ if(!confirm("¿Restablecer todos los ajustes?"))return;
    state={...DEFAULT, order:APPS.map(a=>a.id), hidden:[]}; save(); applyTheme(); renderSettings(); renderGrid();
    const dv=document.querySelector(".view-dash"); if(dv)dv.dataset.layout=state.dashLayout; renderSpeed(); renderTrip(); });

  // ---------- Arranque ----------
  function boot(){ $("start").classList.add("hidden"); $("app").classList.remove("hidden");
    applyTheme(); renderGrid(); initMap();
    startGPS(); startCompass(); keepAwake(); loadStation(0); renderSpeed(); renderTrip(); tickClock(); syncMusic();
    setView("panel"); // Dashboard como pantalla principal (mapa + música + vistazo)
    const standalone=window.navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches;
    if(!standalone) setTimeout(()=>$("installTip").classList.remove("hidden"),1500);
  }
  $("startBtn").addEventListener("click",boot,{once:true});
  $("installClose").addEventListener("click",()=>$("installTip").classList.add("hidden"));

  if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
