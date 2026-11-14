/* Page behaviour: hero map, illustrations, charts, timeline, scenario explorer, sources, nav. */
(function () {
  const C = window.CONTENT;
  const $ = s => document.querySelector(s);

  /* ------------------------------------------------ nav + progress + reveal */
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY, h = document.documentElement.scrollHeight - innerHeight;
    $("#progress").style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    $("#topnav").classList.toggle("hide", y > lastY && y > 320);
    lastY = y;
  }, { passive: true });
  $("#navtoggle").addEventListener("click", () => $("#navlinks").classList.toggle("open"));
  document.querySelectorAll("#navlinks a").forEach(a => a.addEventListener("click", () => $("#navlinks").classList.remove("open")));
  const secs = [...document.querySelectorAll("section[id], header[id]")];
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) document.querySelectorAll("#navlinks a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" });
  secs.forEach(s => io.observe(s));
  document.querySelectorAll(".card,.stat,.chart,.risk,.recs li,.col,.callout,.compare").forEach(el => el.classList.add("reveal"));
  const ro = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); ro.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal").forEach(el => ro.observe(el));

  /* ------------------------------------------------ hero map */
  function heroMap() {
    const el = $("#heromap");
    Promise.all(["land", "claims", "fields", "cities"].map(n => fetch(`data/${n}.json`).then(r => r.json()))).then(([land, claims, fields, cities]) => {
      const draw = () => {
        el.innerHTML = "";
        const W = el.clientWidth, H = el.clientHeight;
        const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid slice");
        const defs = svg.append("defs");
        defs.append("pattern").attr("id", "hatch").attr("patternUnits", "userSpaceOnUse").attr("width", 9).attr("height", 9).attr("patternTransform", "rotate(45)")
          .call(p => { p.append("rect").attr("width", 9).attr("height", 9).attr("fill", "rgba(255,94,122,.05)"); p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 9).attr("stroke", "rgba(255,94,122,.5)").attr("stroke-width", 1.4); });
        const g = defs.append("filter").attr("id", "glow").attr("x", "-200%").attr("y", "-200%").attr("width", "500%").attr("height", "500%");
        g.append("feGaussianBlur").attr("stdDeviation", 3).attr("result", "b");
        const m = g.append("feMerge"); m.append("feMergeNode").attr("in", "b"); m.append("feMergeNode").attr("in", "b"); m.append("feMergeNode").attr("in", "SourceGraphic");
        // ocean grid
        const bgp = defs.append("pattern").attr("id", "grid").attr("patternUnits", "userSpaceOnUse").attr("width", 48).attr("height", 48);
        bgp.append("path").attr("d", "M48 0H0V48").attr("fill", "none").attr("stroke", "rgba(255,255,255,.035)");
        svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#070b14");
        svg.append("rect").attr("width", W).attr("height", H).attr("fill", "url(#grid)");

        const proj = d3.geoMercator();
        const focus = { type: "MultiPoint", coordinates: [[99.0, 6.2], [105.2, 14.2]] };
        const wide = W > 760;
        proj.fitExtent([[wide ? W * 0.30 : 0, 0], [W, H]], focus);
        const path = d3.geoPath(proj);
        const f = id => claims.features.find(x => x.properties.id === id);

        svg.append("g").selectAll("path").data(land.features).join("path").attr("class", "land").attr("d", path);
        svg.append("path").datum(f("mtjda")).attr("class", "jda").attr("d", path);
        svg.append("path").datum(f("oca")).attr("class", "oca").attr("d", path);
        svg.append("path").datum(f("lat11")).attr("d", path).attr("fill", "none").attr("stroke", "rgba(255,255,255,.5)").attr("stroke-dasharray", "3 5").attr("stroke-width", 1);
        svg.append("path").datum(f("thai1973")).attr("class", "thai").attr("d", path);
        svg.append("path").datum(f("camb1972")).attr("class", "camb").attr("d", path);

        const lights = svg.append("g");
        fields.features.forEach((ft, i) => {
          const [x, y] = proj(ft.geometry.coordinates);
          lights.append("circle").attr("cx", x).attr("cy", y).attr("r", 9).attr("fill", "rgba(245,181,63,.12)");
          lights.append("circle").attr("cx", x).attr("cy", y).attr("r", ft.properties.type === "oil" ? 2.4 : 3).attr("class", "light pulse").style("animation-delay", (i * 0.37 % 3) + "s");
        });
        // scatter a few extra sparkles near main complexes to suggest platform density
        const rnd = d3.randomNormal.source(d3.randomLcg(7))(0, 0.16);
        [[101.5, 9.1], [101.6, 8.75], [102.6, 7.75], [101.5, 9.6]].forEach(([cx, cy]) => {
          for (let i = 0; i < 26; i++) { const [x, y] = proj([cx + rnd(), cy + rnd()]); lights.append("circle").attr("cx", x).attr("cy", y).attr("r", 1.1).attr("fill", "#f5b53f").attr("opacity", .55); }
        });

        const cityWant = { "Bangkok": [6, -8], "Phnom Penh": [6, -8], "Rayong": [6, 12], "Songkhla": [-8, 14], "Trat": [6, -6], "Chumphon": [-70, 4] };
        cities.features.filter(c => cityWant[c.properties.name]).forEach(c => {
          const [x, y] = proj(c.geometry.coordinates), [dx, dy] = cityWant[c.properties.name];
          svg.append("circle").attr("cx", x).attr("cy", y).attr("r", 2).attr("class", "citydot");
          svg.append("text").attr("x", x + dx).attr("y", y + dy).attr("class", "city").text(c.properties.name.toUpperCase());
        });
        const lbl = (lon, lat, t, cls, dx = 0, dy = 0) => { const [x, y] = proj([lon, lat]); svg.append("text").attr("x", x + dx).attr("y", y + dy).attr("class", "lbl " + (cls || "")).text(t); };
        lbl(102.57, 11.66, "Koh Kut", "", 10, -8);
        lbl(101.436, 9.152, "Erawan", "", 10, 4);
        lbl(102.58, 7.83, "Bongkot", "", 10, 4);
        lbl(101.95, 10.45, "Overlapping Claims Area", "camb", -70, 0);
        lbl(100.9, 11.72, "Cambodia's 1972 line", "camb", -40, -8);
        lbl(102.45, 9.9, "Thailand's 1973 line", "thai", 8, 0);
        lbl(103.05, 7.15, "Malaysia–Thailand JDA", "", -20, 26);
      };
      draw();
      let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(draw, 200); });
    });
  }
  heroMap();

  /* ------------------------------------------------ card illustrations */
  function ill(id, fn) { const el = $(id); if (!el) return; const s = d3.select(el).append("svg").attr("viewBox", "0 0 300 140"); fn(s); }
  ill("#ill1", s => {
    s.append("path").attr("d", "M0 30 Q 60 40 90 20 T 180 30 T 300 10 L300 0 L0 0Z").attr("fill", "#1a2540");
    s.append("circle").attr("cx", 120).attr("cy", 48).attr("r", 7).attr("fill", "#1a2540").attr("stroke", "#ff5e7a").attr("stroke-width", 1.5);
    s.append("text").attr("x", 132).attr("y", 52).attr("fill", "#a4afc8").attr("font-size", 10).attr("font-family", "IBM Plex Mono, monospace").text("Koh Kut");
    s.append("path").attr("d", "M180 30 L 40 48 L 95 135").attr("fill", "none").attr("stroke", "#ff5e7a").attr("stroke-width", 2);
    s.append("path").attr("d", "M180 30 L 150 60 L 100 135").attr("fill", "none").attr("stroke", "#4cc9f0").attr("stroke-width", 2);
    s.append("path").attr("d", "M180 30 L 40 48 L 95 135 L 100 135 L 150 60Z").attr("fill", "rgba(255,94,122,.12)");
    s.append("text").attr("x", 95).attr("y", 90).attr("fill", "#ffb0bd").attr("font-size", 11).attr("font-family", "Fraunces, serif").attr("font-style", "italic").attr("text-anchor", "middle").text("OCA");
  });
  ill("#ill2", s => {
    const x = d3.scaleLinear([2010, 2026], [20, 280]), y = d3.scaleLinear([0, 4500], [120, 15]);
    const dom = [[2010, 3700], [2014, 4000], [2018, 3500], [2020, 3260], [2022, 2500], [2024, 2640], [2026, 2550]];
    const lng = [[2011, 100], [2014, 190], [2018, 600], [2020, 750], [2022, 1100], [2023, 1540], [2024, 1500], [2026, 1550]];
    const line = d3.line().x(d => x(d[0])).y(d => y(d[1])).curve(d3.curveMonotoneX);
    s.append("path").datum(dom).attr("d", line).attr("fill", "none").attr("stroke", "#f5b53f").attr("stroke-width", 2.2);
    s.append("path").datum(lng).attr("d", line).attr("fill", "none").attr("stroke", "#4cc9f0").attr("stroke-width", 2.2);
    s.append("text").attr("x", 24).attr("y", 20).attr("fill", "#f5b53f").attr("font-size", 10).attr("font-family", "IBM Plex Mono, monospace").text("Gulf gas output ↓");
    s.append("text").attr("x", 180).attr("y", 128).attr("fill", "#4cc9f0").attr("font-size", 10).attr("font-family", "IBM Plex Mono, monospace").text("LNG imports ↑");
    s.append("text").attr("x", 290).attr("y", 134).attr("fill", "#6f7b98").attr("font-size", 8).attr("text-anchor", "end").attr("font-family", "IBM Plex Mono, monospace").text("indicative shape, MMscfd");
  });
  ill("#ill3", s => {
    s.append("rect").attr("x", 70).attr("y", 20).attr("width", 160).attr("height", 100).attr("rx", 6).attr("fill", "#1a2540").attr("stroke", "#2b3a5c");
    [40, 56, 72, 88].forEach(yy => s.append("rect").attr("x", 86).attr("y", yy).attr("width", yy === 88 ? 70 : 128).attr("height", 6).attr("rx", 3).attr("fill", "#2b3a5c"));
    s.append("text").attr("x", 86).attr("y", 33).attr("fill", "#a4afc8").attr("font-size", 9).attr("font-family", "IBM Plex Mono, monospace").text("MOU 2544 · 2001");
    s.append("path").attr("d", "M150 14 L 158 44 L 146 70 L 160 98 L 150 126").attr("fill", "none").attr("stroke", "#070b14").attr("stroke-width", 7);
    s.append("path").attr("d", "M150 14 L 158 44 L 146 70 L 160 98 L 150 126").attr("fill", "none").attr("stroke", "#ff5e7a").attr("stroke-width", 1.5).attr("stroke-dasharray", "4 3");
    s.append("text").attr("x", 150).attr("y", 136).attr("fill", "#ff5e7a").attr("font-size", 9).attr("text-anchor", "middle").attr("font-family", "IBM Plex Mono, monospace").text("terminated 5 May 2026");
  });

  /* ------------------------------------------------ charts */
  function frame(sel, mL = 44, mR = 16, mT = 18, mB = 30) {
    const el = $(sel), W = el.clientWidth || 500, H = el.clientHeight || 280;
    el.innerHTML = "";
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    return { svg, W, H, iw: W - mL - mR, ih: H - mT - mB, g: svg.append("g").attr("transform", `translate(${mL},${mT})`) };
  }
  const MONO = "IBM Plex Mono, monospace";

  function chErawan() {
    const { g, iw, ih } = frame("#ch-erawan", 46, 24);
    const pts = [[2020.5, 1185, "2020 avg"], [2021.04, 1036, "Jan 2021"], [2021.45, 1040, ""], [2021.54, 801, ""], [2021.62, 780, ""], [2022.3, 380, "Apr 2022 hand-over"], [2023.5, 200, "2023"], [2024.25, 800, "Apr 2024"], [2025.6, 800, ""]];
    const x = d3.scaleLinear([2020.2, 2025.9], [0, iw]), y = d3.scaleLinear([0, 1500], [ih, 0]);
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat("")).select(".domain").remove();
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).tickValues([2021, 2022, 2023, 2024, 2025]).tickFormat(d3.format("d")));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d => d3.format(",")(d))).select(".domain").remove();
    g.append("line").attr("x1", 0).attr("x2", iw).attr("y1", y(1400)).attr("y2", y(1400)).attr("class", "ann-line");
    g.append("text").attr("x", iw).attr("y", y(1400) - 5).attr("text-anchor", "end").attr("class", "anno m").text("Chevron-era peak ≈1,400");
    g.append("line").attr("x1", 0).attr("x2", iw).attr("y1", y(800)).attr("y2", y(800)).attr("stroke", "#f5b53f").attr("stroke-opacity", .35).attr("stroke-dasharray", "2 4");
    g.append("text").attr("x", x(2023.0)).attr("y", y(800) - 6).attr("text-anchor", "middle").attr("class", "anno m").text("Contracted level 800");
    const area = d3.area().x(d => x(d[0])).y0(ih).y1(d => y(d[1])).curve(d3.curveMonotoneX);
    const line = d3.line().x(d => x(d[0])).y(d => y(d[1])).curve(d3.curveMonotoneX);
    const grad = g.append("defs").append("linearGradient").attr("id", "era-grad").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
    grad.append("stop").attr("offset", 0).attr("stop-color", "#f5b53f").attr("stop-opacity", .35); grad.append("stop").attr("offset", 1).attr("stop-color", "#f5b53f").attr("stop-opacity", 0);
    g.append("path").datum(pts).attr("d", area).attr("fill", "url(#era-grad)");
    g.append("path").datum(pts).attr("d", line).attr("fill", "none").attr("stroke", "#f5b53f").attr("stroke-width", 2.5);
    g.selectAll("circle").data(pts).join("circle").attr("cx", d => x(d[0])).attr("cy", d => y(d[1])).attr("r", 3.5).attr("fill", "#070b14").attr("stroke", "#ffd57a").attr("stroke-width", 2);
    g.selectAll("text.p").data(pts.filter(d => d[2])).join("text").attr("class", "anno p").attr("x", d => x(d[0])).attr("y", d => y(d[1]) + (d[1] < 500 ? 18 : -10)).attr("text-anchor", "middle").attr("font-size", 10.5)
      .text(d => `${d3.format(",")(d[1])}`);
    g.append("text").attr("x", x(2022.3)).attr("y", y(380) + 32).attr("text-anchor", "middle").attr("class", "anno m").text("PTTEP takes over");
    g.append("text").attr("x", x(2023.5)).attr("y", y(200) + 32).attr("text-anchor", "middle").attr("class", "anno m").text("low point");
    g.append("text").attr("x", -34).attr("y", -6).attr("class", "anno m").text("MMscfd");
  }

  function chLNG() {
    const { g, iw, ih } = frame("#ch-lng", 40, 16);
    const d = [["2021", 6.6, "est."], ["2022", 8.25, "derived"], ["2023", 11.55, ""], ["2024", 11.3, ""], ["2025", 10.0, "forecast"]];
    const x = d3.scaleBand(d.map(v => v[0]), [0, iw]).padding(.3), y = d3.scaleLinear([0, 13], [ih, 0]);
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-iw).tickFormat("")).select(".domain").remove();
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5)).select(".domain").remove();
    const defs = g.append("defs");
    defs.append("pattern").attr("id", "bar-hatch").attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6).attr("patternTransform", "rotate(45)")
      .call(p => { p.append("rect").attr("width", 6).attr("height", 6).attr("fill", "rgba(76,201,240,.25)"); p.append("line").attr("y2", 6).attr("stroke", "#4cc9f0").attr("stroke-width", 1.5); });
    g.selectAll("rect.b").data(d).join("rect").attr("class", "b").attr("x", v => x(v[0])).attr("width", x.bandwidth()).attr("y", v => y(v[1])).attr("height", v => ih - y(v[1])).attr("rx", 3)
      .attr("fill", v => v[2] ? "url(#bar-hatch)" : "#4cc9f0");
    g.selectAll("text.v").data(d).join("text").attr("class", "anno v").attr("x", v => x(v[0]) + x.bandwidth() / 2).attr("y", v => y(v[1]) - 8).attr("text-anchor", "middle").attr("font-weight", 600).text(v => v[1].toFixed(v[1] % 1 ? 2 : 1).replace(/\.?0+$/, "") + " Mt");
    g.selectAll("text.n").data(d.filter(v => v[2])).join("text").attr("class", "anno m").attr("x", v => x(v[0]) + x.bandwidth() / 2).attr("y", v => y(v[1]) - 22).attr("text-anchor", "middle").attr("font-size", 10).text(v => v[2]);
    g.append("text").attr("x", -30).attr("y", -6).attr("class", "anno m").text("Mt/yr");
    g.append("text").attr("x", x("2023") + x.bandwidth() / 2).attr("y", ih - 10).attr("text-anchor", "middle").attr("class", "anno").attr("fill", "#070b14").attr("font-weight", 700).text("+40%");
  }

  function chMix() {
    const { g, iw, ih } = frame("#ch-mix", 118, 16, 10, 28);
    const rows = [
      { k: "2020", v: [["Gulf of Thailand", 70], ["Myanmar pipeline", 15], ["LNG", 15]] },
      { k: "2024 (derived)", v: [["Gulf of Thailand", 56], ["Myanmar pipeline", 12], ["LNG", 32]] },
      { k: "mid-2030s (projection)", v: [["Other", 40], ["LNG", 60]] }
    ];
    const col = { "Gulf of Thailand": "#f5b53f", "Myanmar pipeline": "#c9a0ff", "LNG": "#4cc9f0", "Other": "#2b3a5c" };
    const y = d3.scaleBand(rows.map(r => r.k), [0, ih]).padding(.42), x = d3.scaleLinear([0, 100], [0, iw]);
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0)).select(".domain").remove();
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => d + "%"));
    rows.forEach(r => {
      let acc = 0;
      r.v.forEach(([k, v]) => {
        g.append("rect").attr("x", x(acc)).attr("y", y(r.k)).attr("width", x(v) - 1).attr("height", y.bandwidth()).attr("fill", col[k]).attr("rx", 2);
        if (v >= 12) g.append("text").attr("x", x(acc) + x(v) / 2).attr("y", y(r.k) + y.bandwidth() / 2 + 4).attr("text-anchor", "middle").attr("class", "anno").attr("fill", k === "Other" ? "#a4afc8" : "#070b14").attr("font-weight", 600).attr("font-size", 11).text(k === "Other" ? "domestic + pipeline" : `${k} ${v}%`);
        acc += v;
      });
    });
  }

  function chExposure() {
    const { g, iw, ih } = frame("#ch-exposure", 190, 44, 6, 24);
    const d = [["Crude imports via Hormuz", 59, "#ff5e7a"], ["LNG imports via Hormuz", 28, "#ff5e7a"], ["Electricity generated from gas (2025)", 55, "#f5b53f"], ["LNG share of gas supply (2024)", 32, "#4cc9f0"], ["LNG share, mid-2030s (projection)", 60, "#4cc9f0"]];
    const y = d3.scaleBand(d.map(v => v[0]), [0, ih]).padding(.38), x = d3.scaleLinear([0, 100], [0, iw]);
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0)).select(".domain").remove();
    g.selectAll(".axis text").attr("font-family", "Inter Tight, sans-serif").attr("font-size", 11.5);
    g.append("g").attr("class", "grid").call(d3.axisBottom(x).ticks(5).tickSize(ih).tickFormat("")).select(".domain").remove();
    g.selectAll("rect").data(d).join("rect").attr("x", 0).attr("y", v => y(v[0])).attr("height", y.bandwidth()).attr("width", 0).attr("rx", 3).attr("fill", v => v[2])
      .transition().duration(900).delay((_, i) => i * 80).attr("width", v => x(v[1]));
    g.selectAll("text.v").data(d).join("text").attr("class", "anno").attr("x", v => x(v[1]) + 8).attr("y", v => y(v[0]) + y.bandwidth() / 2 + 4).attr("font-weight", 600).attr("font-family", MONO).text(v => v[1] + "%");
  }

  function charts() { chErawan(); chLNG(); chMix(); chExposure(); }
  // draw when visible (so widths are right) and on resize
  const chartIO = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { charts(); chartIO.disconnect(); } }, { threshold: .05 });
  chartIO.observe($("#gas"));
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(charts, 250); });

  /* ------------------------------------------------ timeline */
  const tl = $("#timeline");
  tl.innerHTML = C.timeline.map(e => e.era ? `<li class="era">${e.era}</li>` :
    `<li class="${e.t}"><div class="date">${e.d}</div><h3>${e.h}</h3><p>${e.p}${e.s ? " " + e.s.map(s => `<a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a>`).join(" · ") : ""}</p></li>`).join("");
  document.querySelectorAll("#tlfilters button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#tlfilters button").forEach(x => x.classList.toggle("on", x === b));
    const f = b.dataset.f;
    tl.querySelectorAll("li:not(.era)").forEach(li => li.classList.toggle("dim", f !== "all" && !li.classList.contains(f)));
  }));

  /* ------------------------------------------------ paths */
  const tabs = $("#pathtabs");
  tabs.innerHTML = C.paths.map((p, i) => `<button data-i="${i}" class="${i === 2 ? "on" : ""}"><span class="k">${p.k}</span><span class="t">${p.t}</span></button>`).join("");
  function showPath(i) {
    const p = C.paths[i];
    tabs.querySelectorAll("button").forEach(b => b.classList.toggle("on", +b.dataset.i === i));
    $("#pathtext").innerHTML = `<h3>${p.h}</h3><p>${p.p}</p><div class="verdict"><strong>Verdict.</strong> ${p.verdict}</div>`;
    $("#pathmeters").innerHTML = p.m.map(m => `<div class="meter ${m[3]}"><div class="m-lbl"><b>${m[0]}</b><span>${m[1]}</span></div><div class="bar"><div class="fill" style="width:0"></div></div></div>`).join("");
    requestAnimationFrame(() => requestAnimationFrame(() => { $("#pathmeters").querySelectorAll(".fill").forEach((f, j) => f.style.width = p.m[j][2] + "%"); }));
  }
  tabs.addEventListener("click", e => { const b = e.target.closest("button"); if (b) showPath(+b.dataset.i); });
  showPath(2);

  /* ------------------------------------------------ sources */
  $("#sources").innerHTML = C.sources.map(s => `<li><a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a><span class="meta">${s[2]}</span></li>`).join("");
})();
