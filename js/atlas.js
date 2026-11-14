/* Interactive atlas (Leaflet). Vector base always works; satellite & night tiles stream from Esri / NASA. */
(function () {
  const TRANSPARENT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const GULF_BOUNDS = [[6.3, 99.2], [13.6, 104.8]];

  const map = L.map("map", {
    zoomControl: true, attributionControl: true, minZoom: 5, maxZoom: 13,
    worldCopyJump: false, zoomSnap: 0.5, preferCanvas: false
  });
  map.fitBounds(GULF_BOUNDS, { padding: [10, 10] });
  map.attributionControl.setPrefix("");
  map.attributionControl.addAttribution("Base: Natural Earth · Claim lines reconstructed");

  const renderer = L.svg({ padding: 0.6 });
  map.addLayer(renderer);

  // --- tile bases -------------------------------------------------------
  const bases = {
    sat: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 17, attribution: "Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community", errorTileUrl: TRANSPARENT
    }),
    nightComposite: null,
    nightDaily: null
  };
  const NIGHT_LAYERS = {
    "VIIRS_CityLights_2012": { title: "Earth at Night 2012 (VIIRS, 500 m)", fmt: "jpg", time: "2012-01-01" },
    "BlackMarble_2016_3km": { title: "Black Marble 2016 (3 km)", fmt: "jpg", time: "2016-01-01" }
  };
  function gibs(layer, time, fmt) {
    return L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.${fmt}`, {
      maxNativeZoom: 8, maxZoom: 13, attribution: "Night lights: NASA EOSDIS GIBS / VIIRS", errorTileUrl: TRANSPARENT, opacity: 1
    });
  }
  let nightMode = "composite", nightLayerId = "VIIRS_CityLights_2012", nightDate = "2026-03-15";
  function buildNight() {
    if (bases.nightComposite) map.removeLayer(bases.nightComposite);
    if (bases.nightDaily) map.removeLayer(bases.nightDaily);
    if (nightMode === "composite") {
      const cfg = NIGHT_LAYERS[nightLayerId];
      bases.nightComposite = gibs(nightLayerId, cfg.time, cfg.fmt).addTo(map);
    } else {
      bases.nightDaily = gibs("VIIRS_SNPP_DayNightBand_ENCC", nightDate, "png").addTo(map);
    }
  }

  // --- panes ------------------------------------------------------------
  ["land", "claims", "pipes", "plants", "fields", "labels"].forEach((p, i) => {
    map.createPane(p); map.getPane(p).style.zIndex = 400 + i * 5;
  });

  const groups = {};
  const data = {};
  const style = {
    land: { pane: "land", renderer, color: "#2a3a5c", weight: .8, fillColor: "#141d31", fillOpacity: 1 },
    landOutline: { pane: "land", renderer, color: "rgba(255,255,255,.35)", weight: .8, fill: false },
    oca: { pane: "claims", renderer, color: "rgba(255,94,122,.9)", weight: 1.2, fillColor: "url(#oca-hatch)", fillOpacity: 1, className: "oca-poly" },
    ocaN: { pane: "claims", renderer, color: "rgba(255,255,255,0)", weight: 0, fillColor: "#4cc9f0", fillOpacity: .07 },
    ocaS: { pane: "claims", renderer, color: "rgba(255,255,255,0)", weight: 0, fillColor: "#f5b53f", fillOpacity: .07 },
    thai: { pane: "claims", renderer, color: "#4cc9f0", weight: 2.4 },
    camb: { pane: "claims", renderer, color: "#ff5e7a", weight: 2.4 },
    lat11: { pane: "claims", renderer, color: "#ffffff", weight: 1.2, dashArray: "4 5", opacity: .8 },
    thavnm: { pane: "claims", renderer, color: "#9fb3d9", weight: 1.4, dashArray: "1 4", opacity: .9 },
    jda: { pane: "claims", renderer, color: "#7ee787", weight: 1.4, fillColor: "#7ee787", fillOpacity: .14 },
    pipe: { pane: "pipes", renderer, color: "#c9a0ff", weight: 2, dashArray: "6 5", opacity: .9 }
  };

  function popup(title, tag, tagClass, body) {
    return `<h5>${title}</h5>${tag ? `<span class="tag ${tagClass || ""}">${tag}</span>` : ""}${body}`;
  }

  Promise.all(["land", "claims", "fields", "pipelines", "plants", "poi", "cities"].map(n =>
    fetch(`data/${n}.json`).then(r => r.json()).then(j => data[n] = j)
  )).then(init).catch(err => {
    document.getElementById("mapcaption").innerHTML = "<strong>Map data failed to load.</strong> " + err;
  });

  function init() {
    injectHatch();

    groups.land = L.geoJSON(data.land, { style: style.land, interactive: false }).addTo(map);
    groups.landOutline = L.geoJSON(data.land, { style: style.landOutline, interactive: false });

    const f = id => data.claims.features.find(x => x.properties.id === id);
    groups.oca = L.layerGroup([
      L.geoJSON(f("oca_north"), { style: style.ocaN, interactive: false }),
      L.geoJSON(f("oca_south"), { style: style.ocaS, interactive: false }),
      L.geoJSON(f("oca"), { style: style.oca }).bindPopup(popup("Overlapping Claims Area",
        `~${f("oca").properties.area_km2.toLocaleString()} km² in this reconstruction`, "approx",
        `<p>Sea claimed by both Thailand (1973 line) and Cambodia (1972 line). Published size: about 26,000–27,000 km². No well has ever been drilled here.</p><p>North of 11°N (blue tint): ~10,000 km² that MOU 2544 said should be <em>delimited</em>. South (amber tint): ~16,000 km² for <em>joint development</em>.</p>`)),
      L.geoJSON(f("tha_vnm"), { style: style.thavnm }).bindPopup(popup("Thailand–Vietnam boundary (1997)", "agreed", "ok",
        "<p>A single line from Point C (the northern tip of the Malaysia–Thailand JDA) to Point K. Point K lies on Cambodia's claim limit and marks the southern tip of the overlapping area.</p>")),
      L.geoJSON(f("point_k"), { pointToLayer: (_, ll) => L.circleMarker(ll, { pane: "claims", renderer, radius: 4, color: "#fff", weight: 1.5, fillColor: "#06101f", fillOpacity: 1 }) })
        .bindPopup(popup("Point K", "8°46′54.8″N 102°12′11.7″E", "ok", "<p>Northern end of the 1997 Thailand–Vietnam boundary. It sits on the Cambodia–Vietnam working-arrangement line of 1991, so it is the one documented point where all three claims meet.</p>"))
    ]).addTo(map);

    groups.thai = L.geoJSON(f("thai1973"), { style: style.thai }).bindPopup(popup("Thailand's 1973 claim line", "reconstructed", "approx",
      "<p>Proclaimed 18 May 1973 as a median line between the Thai and Cambodian coasts, giving Koh Kut full effect. Reconstructed here from the 1907 treaty point via the Koh Kut–Koh Kong midpoint to Point K.</p>")).addTo(map);
    groups.camb = L.geoJSON(f("camb1972"), { style: style.camb }).bindPopup(popup("Cambodia's 1972 claim line", "reconstructed", "approx",
      "<p>Decreed 1 July 1972. It runs due west from the land boundary through the highest point of Koh Kut, into the Gulf, then turns south. Cambodia bases the westward line on its reading of the 1907 treaty. Reconstructed here to the published zone sizes.</p>")).addTo(map);
    groups.lat11 = L.geoJSON(f("lat11"), { style: style.lat11 }).bindPopup(popup("11°N", "MOU 2544", "", "<p>The 2001 memorandum split the OCA along this parallel: delimitation to the north, joint development to the south, negotiated as one package. Terminated 5 May 2026.</p>")).addTo(map);
    groups.jda = L.geoJSON(f("mtjda"), { style: style.jda }).bindPopup(popup("Malaysia–Thailand Joint Development Area", "7,250 km² · since 1979", "ok",
      "<p>Both countries set sovereignty aside, created a Joint Authority (1991) and split revenue 50:50. First gas 2005. About 8.5 tcf proved and probable. The template this atlas proposes for the OCA.</p>")).addTo(map);

    // Koh Kut & treaty point
    const kk = f("koh_kut").geometry.coordinates, tp = f("terminus").geometry.coordinates;
    groups.kohkut = L.layerGroup([
      L.circleMarker([kk[1], kk[0]], { pane: "fields", renderer, radius: 7, color: "#fff", weight: 2, fillColor: "#ff5e7a", fillOpacity: .9 })
        .bindPopup(popup("Koh Kut (Ko Kood)", "105 km² · 2,600 residents · Thai", "ok",
          "<p>The whole dispute pivots on this island. Cambodia's 1972 line passes through it; Thailand's 1973 line gives it full effect. Thailand's sovereignty is not seriously contested, but any maritime deal that ignores the line through the island is politically impossible in Bangkok.</p>")),
      L.circleMarker([tp[1], tp[0]], { pane: "fields", renderer, radius: 4, color: "#fff", weight: 1.5, fillColor: "#06101f", fillOpacity: 1 })
        .bindPopup(popup("1907 treaty boundary point", "11°38.8′N 102°54.3′E", "ok", "<p>Where the Franco-Siamese land boundary meets the sea at Hat Lek. Both claim lines start here; they disagree about which direction to go.</p>"))
    ]).addTo(map);

    // fields
    groups.fields = L.layerGroup(data.fields.features.map(ft => {
      const [x, y] = ft.geometry.coordinates, p = ft.properties;
      const halo = L.circleMarker([y, x], { pane: "fields", renderer, radius: 11, stroke: false, fillColor: "#f5b53f", fillOpacity: .18, interactive: false });
      const core = L.circleMarker([y, x], { pane: "fields", renderer, radius: p.type === "oil" ? 4 : 5, color: "#fff2c7", weight: 1, fillColor: p.type === "oil" ? "#ffd57a" : "#f5b53f", fillOpacity: 1 });
      core.bindTooltip(p.name, { className: "fieldtip", direction: "top", offset: [0, -6] });
      core.bindPopup(popup(p.name, p.verified ? "verified position" : "approximate position", p.verified ? "ok" : "approx",
        `<p><b>${p.type === "oil" ? "Oil" : "Gas"} field</b> · ${p.operator}${p.start ? ` · producing since ${p.start}` : ""}</p><p>${p.note}</p>`));
      return L.layerGroup([halo, core]);
    })).addTo(map);

    // pipelines
    groups.pipes = L.geoJSON(data.pipelines, { style: style.pipe, onEachFeature: (ft, l) => l.bindPopup(popup(ft.properties.name, "schematic route", "approx", "<p>Indicative route only. Gulf gas lands at Rayong (Map Ta Phut) and Khanom; JDA gas lands at Songkhla; Myanmar gas enters at Ratchaburi.</p>")) });

    // plants
    groups.plants = L.layerGroup(data.plants.features.map(ft => {
      const [x, y] = ft.geometry.coordinates, p = ft.properties;
      const s = Math.max(8, Math.sqrt(p.mw) / 2.2);
      return L.marker([y, x], { pane: "plants", icon: L.divIcon({ className: "", html: `<div style="width:${s}px;height:${s}px;background:#ff9f6e;transform:rotate(45deg);border:1px solid #fff;opacity:.9"></div>`, iconSize: [s, s], iconAnchor: [s / 2, s / 2] }) })
        .bindPopup(popup(p.name, `${p.mw.toLocaleString()} MW · gas-fired`, "", "<p>Gas-fired power plant (WRI Global Power Plant Database). Gas made about 55% of Thai electricity in 2025.</p>"));
    }).concat(data.poi.features.map(ft => {
      const [x, y] = ft.geometry.coordinates, p = ft.properties;
      return L.marker([y, x], { pane: "plants", icon: L.divIcon({ className: "", html: `<div style="width:14px;height:14px;border-radius:3px;background:#4cc9f0;border:2px solid #fff"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] }) })
        .bindPopup(popup(p.name, p.kind === "lng" ? "LNG import terminal" : "gas landing point", "", `<p>${p.note}</p>`));
    })));

    // labels
    const labelMarkers = data.cities.features.map(ft => {
      const [x, y] = ft.geometry.coordinates, n = ft.properties.name, big = ["Bangkok", "Phnom Penh", "Ho Chi Minh City"].includes(n);
      return L.marker([y, x], { pane: "labels", interactive: false, icon: L.divIcon({ className: "place-label" + (big ? " big" : ""), html: `${big ? "●" : "·"} ${n}`, iconAnchor: [-4, 8] }) });
    });
    labelMarkers.push(L.marker([9.9, 100.6], { pane: "labels", interactive: false, icon: L.divIcon({ className: "place-label sea", html: "Gulf of Thailand", iconAnchor: [60, 8] }) }));
    labelMarkers.push(L.marker([10.6, 101.95], { pane: "labels", interactive: false, icon: L.divIcon({ className: "place-label sea", html: "Overlapping<br>Claims Area", iconAnchor: [45, 14] }) }));
    labelMarkers.push(L.marker([7.25, 103.1], { pane: "labels", interactive: false, icon: L.divIcon({ className: "place-label sea", html: "MT JDA", iconAnchor: [22, 8] }) }));
    groups.labels = L.layerGroup(labelMarkers).addTo(map);

    // legend
    const legend = L.DomUtil.create("div", "legend");
    legend.innerHTML = `<span><i class="sw light"></i>Producing field (centre)</span><span><i class="sw thai"></i>Thailand 1973</span><span><i class="sw camb"></i>Cambodia 1972</span><span><i class="sw oca"></i>Overlapping Claims Area</span><span><i class="sw jda"></i>Malaysia–Thailand JDA</span>`;
    document.getElementById("map").appendChild(legend);

    // night bar
    const nb = L.DomUtil.create("div", "nightbar");
    nb.innerHTML = `<label>Show <select id="nightsel"><option value="composite">annual composite</option><option value="daily">one night</option></select></label>
      <select id="nightlayer">${Object.entries(NIGHT_LAYERS).map(([k, v]) => `<option value="${k}">${v.title}</option>`).join("")}</select>
      <input type="date" id="nightdate" value="${nightDate}" min="2012-04-01" style="display:none">`;
    document.getElementById("map").appendChild(nb);
    L.DomEvent.disableClickPropagation(nb);
    nb.querySelector("#nightsel").addEventListener("change", e => { nightMode = e.target.value; nb.querySelector("#nightlayer").style.display = nightMode === "composite" ? "" : "none"; nb.querySelector("#nightdate").style.display = nightMode === "daily" ? "" : "none"; if (currentBase === "night") buildNight(); });
    nb.querySelector("#nightlayer").addEventListener("change", e => { nightLayerId = e.target.value; if (currentBase === "night") buildNight(); });
    nb.querySelector("#nightdate").addEventListener("change", e => { nightDate = e.target.value; if (currentBase === "night") buildNight(); });

    wireControls();
  }

  function injectHatch() {
    const svg = renderer._container;
    if (!svg || svg.querySelector("#oca-hatch")) return;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `<pattern id="oca-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="rgba(255,94,122,0.06)"/><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,94,122,0.55)" stroke-width="1.6"/></pattern>`;
    svg.insertBefore(defs, svg.firstChild);
  }

  // --- controls -----------------------------------------------------------
  let currentBase = "vector";
  const hints = {
    vector: "Vector base built from Natural Earth. Always available.",
    sat: "Esri World Imagery, streamed live. Platforms are too small to see from this height, but coasts and islands are real.",
    night: "NASA VIIRS night-time imagery, streamed live. The bright cluster in the central Gulf is gas flaring and platform lighting. Switch to a single night to see recent conditions (clouds included)."
  };
  function setBase(b) {
    currentBase = b;
    document.querySelectorAll("#basesel button").forEach(x => x.classList.toggle("on", x.dataset.base === b));
    document.getElementById("basehint").textContent = hints[b];
    document.getElementById("map").classList.toggle("sat", b !== "vector");
    document.querySelector(".nightbar").classList.toggle("show", b === "night");
    if (bases.sat) map.removeLayer(bases.sat);
    if (bases.nightComposite) map.removeLayer(bases.nightComposite);
    if (bases.nightDaily) map.removeLayer(bases.nightDaily);
    if (groups.land) map.removeLayer(groups.land);
    if (groups.landOutline) map.removeLayer(groups.landOutline);
    if (b === "vector") groups.land.addTo(map);
    if (b === "sat") { bases.sat.addTo(map); groups.landOutline.addTo(map); }
    if (b === "night") { buildNight(); groups.landOutline.addTo(map); }
    // keep overlays on top
    Object.keys(groups).forEach(k => { if (k !== "land" && k !== "landOutline" && map.hasLayer(groups[k]) && groups[k].bringToFront) groups[k].bringToFront(); });
  }
  function setLayer(k, on) {
    const g = groups[k]; if (!g) return;
    if (on && !map.hasLayer(g)) g.addTo(map);
    if (!on && map.hasLayer(g)) map.removeLayer(g);
    const cb = document.querySelector(`[data-layer="${k}"]`); if (cb) cb.checked = on;
  }

  const TOUR = [
    { c: [11.62, 102.72], z: 9.5, base: "sat", on: ["thai", "camb", "oca", "labels"], off: ["pipes", "plants"],
      cap: "<strong>1 · Koh Kut.</strong> Both lines begin at the same point on the coast at Hat Lek. Cambodia's (red) runs due west straight through this Thai island. Thailand's (blue) turns south-west between Koh Kut and Cambodia's Koh Kong. Everything else follows from that disagreement." },
    { c: [9.1, 101.7], z: 7.5, base: "night", on: ["fields", "oca"], off: ["pipes", "plants", "labels"],
      cap: "<strong>2 · The lights.</strong> This is NASA night-time imagery. The glow in open sea is Thailand's gas province: Erawan, Pailin, Funan, Bongkot and several hundred platforms, lit and flaring. Zoom in. Then look east." },
    { c: [10.2, 102.0], z: 7, base: "night", on: ["fields", "oca", "thai", "camb", "lat11"], off: ["pipes", "plants"],
      cap: "<strong>3 · The dark wedge.</strong> The hatched area is the OCA. The lights stop at its western edge. Fifty years of claims, two governments, one memorandum, zero wells. The dashed line at 11°N is where the 2001 MOU split delimitation (north) from joint development (south)." },
    { c: [7.3, 103.0], z: 8, base: "vector", on: ["jda", "fields", "labels"], off: ["pipes", "plants"],
      cap: "<strong>4 · The model next door.</strong> The green polygon is the Malaysia–Thailand Joint Development Area, agreed in 1979 over an overlap just like this one. Sovereignty shelved, revenue split 50:50, gas flowing to Songkhla since 2005, a new contract signed in September 2026." },
    { c: [11.3, 101.3], z: 6.8, base: "vector", on: ["pipes", "plants", "fields", "labels"], off: [],
      cap: "<strong>5 · Where the gas goes.</strong> Purple lines are the trunklines to Rayong and Khanom; orange diamonds are gas power plants, clustered around Bangkok. The OCA sits 60–100 km from pipelines that already exist. The blue square at Map Ta Phut is the LNG terminal that fills the gap today." }
  ];
  const DEFAULT_CAP = document.getElementById("mapcaption").innerHTML;

  function wireControls() {
    document.querySelectorAll("#basesel button").forEach(b => b.addEventListener("click", () => setBase(b.dataset.base)));
    document.querySelectorAll("[data-layer]").forEach(cb => cb.addEventListener("change", () => setLayer(cb.dataset.layer, cb.checked)));
    document.querySelectorAll("#tour button").forEach(b => b.addEventListener("click", () => {
      const s = TOUR[+b.dataset.stop];
      document.querySelectorAll("#tour button").forEach(x => x.classList.toggle("on", x === b));
      setBase(s.base); s.on.forEach(k => setLayer(k, true)); s.off.forEach(k => setLayer(k, false));
      map.flyTo(s.c, s.z, { duration: 1.6 });
      document.getElementById("mapcaption").innerHTML = s.cap;
    }));
    document.getElementById("resetview").addEventListener("click", () => {
      document.querySelectorAll("#tour button").forEach(x => x.classList.remove("on"));
      setBase("vector"); ["oca", "thai", "camb", "lat11", "fields", "jda", "labels"].forEach(k => setLayer(k, true)); ["pipes", "plants"].forEach(k => setLayer(k, false));
      map.flyToBounds(GULF_BOUNDS, { padding: [10, 10], duration: 1.2 });
      document.getElementById("mapcaption").innerHTML = DEFAULT_CAP;
    });
  }
  window.ATLAS = { map, setBase, setLayer, groups };
})();
