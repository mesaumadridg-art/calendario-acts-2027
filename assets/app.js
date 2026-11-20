/* ==========================================================================
   Calendario 2027 · Equipo Facilitador ACTS
   App sin dependencias. Lee data/calendario.json y data/manual.json.
   ========================================================================== */

window.__ERRS = [];
addEventListener("error", (ev) => window.__ERRS.push("error: " + ev.message));
addEventListener("unhandledrejection", (ev) => window.__ERRS.push("promesa: " + (ev.reason?.stack || ev.reason)));

const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_C = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const CLAVE = "acts2027:v1";

const ESTADO = {
  datos: null,
  manual: null,
  eventos: [],          // base + cambios locales
  filtros: { q: "", grupo: "", tipo: "" },
  reunion: false,
  cambios: { creados: [], editados: {}, borrados: [] },
  historial: [],
  autor: "",
  tema: "",
};

/* ------------------------------------------------------------------ datos */

const iso = (d) => d.toISOString().slice(0, 10);
const fechaDe = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };
const diaSemana = (s) => DIAS[(fechaDe(s).getDay() + 6) % 7];

function fmtLargo(s) {
  const f = fechaDe(s);
  return `${DIAS[(f.getDay() + 6) % 7]} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}
function fmtCorto(s) {
  const f = fechaDe(s);
  return `${f.getDate()} ${MESES_C[f.getMonth()].toLowerCase()}`;
}

async function cargar() {
  const [cal, man] = await Promise.all([
    fetch("data/calendario.json", { cache: "no-cache" }).then((r) => r.json()),
    fetch("data/manual.json", { cache: "no-cache" }).then((r) => r.json()).catch(() => ({ entradas: [] })),
  ]);
  ESTADO.datos = cal;
  ESTADO.manual = man;
  leerLocal();
  aplicarCambios();
}

function leerLocal() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || "{}");
    ESTADO.cambios = g.cambios || ESTADO.cambios;
    ESTADO.historial = g.historial || [];
    ESTADO.autor = g.autor || "";
    ESTADO.tema = g.tema || "";
    ESTADO.reunion = !!g.reunion;
  } catch { /* arranque limpio */ }
}

function guardarLocal() {
  localStorage.setItem(CLAVE, JSON.stringify({
    cambios: ESTADO.cambios,
    historial: ESTADO.historial,
    autor: ESTADO.autor,
    tema: ESTADO.tema,
    reunion: ESTADO.reunion,
  }));
}

function aplicarCambios() {
  const base = ESTADO.datos.eventos.filter((e) => !ESTADO.cambios.borrados.includes(e.id));
  const mapa = new Map(base.map((e) => [e.id, { ...e }]));
  for (const [id, parche] of Object.entries(ESTADO.cambios.editados)) {
    if (mapa.has(id)) Object.assign(mapa.get(id), parche);
  }
  for (const nuevo of ESTADO.cambios.creados) mapa.set(nuevo.id, { ...nuevo });
  // un cambio viejo pudo dejar el tipo vacío: nunca se deja sin categoría
  for (const e of mapa.values()) if (!ESTADO.datos.tipos[e.tipo]) e.tipo = "EF";
  const lista = [...mapa.values()].map((e) => {
    const f = fechaDe(e.fecha);
    return {
      ...e,
      dia: f.getDate(),
      mes: f.getMonth() + 1,
      anio: f.getFullYear(),
      diaSemana: diaSemana(e.fecha),
      horaMin: horaMin(e.hora),
      tipoNombre: ESTADO.datos.tipos[e.tipo]?.nombre || e.tipo,
      color: ESTADO.datos.tipos[e.tipo]?.color || "#7a1b36",
    };
  });
  lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaMin - b.horaMin);
  ESTADO.eventos = lista;
}

function horaMin(h = "") {
  const m = String(h).replace(/\./g, "").replace(/\u00a0/g, " ").trim().match(/(\d{1,2}):(\d{2})\s*(am|pm|m)?/i);
  if (!m) return 0;
  let hh = +m[1];
  const suf = (m[3] || "").toLowerCase();
  if (suf === "pm" && hh !== 12) hh += 12;
  if (suf === "am" && hh === 12) hh = 0;
  return hh * 60 + +m[2];
}

/* ------------------------------------------------------------------ tema */

function aplicarTema() {
  const oscuro = ESTADO.tema ? ESTADO.tema === "oscuro"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.tema = oscuro ? "oscuro" : "claro";
  $('meta[name="theme-color"]').setAttribute("content", oscuro ? "#151110" : "#7a1b36");
}

/* ------------------------------------------------------------------ hero */

function pintarHero() {
  const d = ESTADO.datos;
  const n = d.eventos.length;
  const stats = [
    [n, "actividades"],
    [d.resumen.juntasFormacion, "de formación"],
    [2, "retiros"],
    [d.resumen.economia, "ventas y rifas"],
  ];
  const caja = $("#cifras");
  const ya = ESTADO.animado;
  caja.innerHTML = stats.map(([v, t]) =>
    `<div class="cifra"><b ${ya ? "" : `data-contar="${v}"`}>${ya ? v : 0}</b><span>${t}</span></div>`).join("");

  $("#heroRetiros").innerHTML = d.retiros.map((r) => {
    const a = fechaDe(r.desde), b = fechaDe(r.hasta);
    const romano = r.nombre.split(" ")[0];
    const dias = Math.round((b - a) / 86400000) + 1;
    return `<article class="retiro" style="--c:#a3232b;--t:${r.color}">
      <span class="retiro__num">${romano}</span>
      <div class="retiro__txt"><b>${r.nombre.replace(/^\S+\s/, "")}</b>
        <span>${a.getDate()}–${b.getDate()} de ${MESES[b.getMonth()]} · ${dias} días</span></div>
    </article>`;
  }).join("");

  $("#heroFecha").textContent = `Propuesta para la reunión del ${d.meta.reunion}`;
  $("#pieNota").textContent = d.meta.nota;
  $("#pieMeta").textContent = `Datos generados el ${new Date().toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" })}`;
}

function animarCifras() {
  ESTADO.animado = true;
  $$("[data-contar]").forEach((el) => {
    const fin = +el.dataset.contar;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = fin; return; }
    const t0 = performance.now(), dur = 1100;
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(fin * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    // si la pestaña no pinta (segundo plano, captura headless), el número igual aparece
    setTimeout(() => { el.textContent = fin; }, 700);
  });
}

/* ------------------------------------------------------------------ mapa */

function pintarLeyenda() {
  const d = ESTADO.datos;
  const orden = ["EF", "FORV", "FORM", "ECO", "CAP", "RET", "POST", "HITO"];
  $("#leyenda").innerHTML = orden.filter((t) => d.tipos[t]).map((t) => {
    const x = d.tipos[t];
    return `<li style="--c:${x.color}"><i></i>${x.nombre}</li>`;
  }).join("") + `<li><i class="blq"></i>Día bloqueado</li>`;
}

function pintarMapa() {
  const d = ESTADO.datos;
  const porMes = Array.from({ length: 12 }, () => []);
  for (const e of ESTADO.eventos) porMes[e.mes - 1].push(e);
  const bloq = new Set(d.bloqueos.map((b) => b.fecha));

  $("#mapaAnio").innerHTML = porMes.map((lista, i) => {
    const m = i + 1;
    const primero = new Date(2027, i, 1);
    const dias = new Date(2027, i + 1, 0).getDate();
    const hueco = (primero.getDay() + 6) % 7;
    const porDia = new Map();
    for (const e of lista) {
      const k = e.dia;
      if (!porDia.has(k)) porDia.set(k, []);
      porDia.get(k).push(e);
    }
    const retiro = lista.find((e) => e.tipo === "RET");
    const tipos = [...new Set(lista.map((e) => e.tipo))];

    let celdas = "";
    for (let k = 0; k < hueco; k++) celdas += `<span class="dia vacio"></span>`;
    for (let dd = 1; dd <= dias; dd++) {
      const evs = porDia.get(dd) || [];
      const fecha = `2027-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      const clases = ["dia"];
      let estilo = "";
      if (evs.length) {
        clases.push("tiene");
        if (evs.length > 1) clases.push("multi");
        if (evs.some((e) => e.tipo === "RET")) clases.push("ret");
        const principal = evs.find((e) => e.tipo === "RET") || evs[0];
        estilo = `--c:${principal.color}`;
        if (evs[1]) estilo += `;--c2:${evs[1].color}`;
      } else if (bloq.has(fecha)) clases.push("blq");
      const titulo = evs.map((e) => `${e.hora} · ${e.actividad}`).join(" | ")
        || (bloq.has(fecha) ? d.bloqueos.find((b) => b.fecha === fecha)?.nombre : "");
      celdas += `<span class="${clases.join(" ")}" style="${estilo}" title="${esc(titulo)}">${dd}</span>`;
    }

    const puntos = tipos.slice(0, 4).map((t) =>
      `<span class="punto-t" style="--c:${d.tipos[t]?.color || '#666'}"><i></i>${abrev(t)}</span>`).join("");

    return `<button class="mes-mapa" data-ir="${m}" ${retiro ? `style="--c:${retiro.color}"` : ""}
        aria-label="${MESES[i]}: ${lista.length} actividades">
      <span class="mes-mapa__cab"><span class="mes-mapa__nom">${MESES[i]}</span>
        ${retiro ? `<span class="mes-mapa__retiro">Retiro</span>` : ""}
        <span class="mes-mapa__n" title="${lista.length} actividades">${lista.length}</span></span>
      <span class="dias">
        ${["L", "M", "M", "J", "V", "S", "D"].map((x) => `<span class="dh">${x}</span>`).join("")}
        ${celdas}
      </span>
      <span class="mes-mapa__pie">${puntos}</span>
    </button>`;
  }).join("");

  $("#focos").innerHTML = Object.entries(d.focos).map(([k, f], i) => `
    <article class="foco">
      <span>${["Primer", "Segundo", "Tercer", "Cuarto"][+k - 1]} trimestre</span>
      <b>${f.titulo}</b>
      <p>${f.texto}</p>
    </article>`).join("");
}

function abrev(t) {
  return { EF: "EF", FORV: "Varones", FORM: "Mujeres", ECO: "Ventas", CAP: "Escuela",
           RET: "Retiro", POST: "Después", HITO: "Hitos" }[t] || t;
}

/* ------------------------------------------------------------------ agenda */

function pintarFiltros() {
  const d = ESTADO.datos;
  const equipos = [
    ["", "Todo el año", "#7a1b36"],
    ["equipo-facilitador", "Equipo Facilitador", d.tipos.EF.color],
    ["varones", "Varones", d.tipos.FORV.color],
    ["mujeres", "Mujeres", d.tipos.FORM.color],
    ["economia", "Economía", d.tipos.ECO.color],
    ["escuela", "Escuela", d.tipos.CAP.color],
  ];
  $("#chipsEquipo").innerHTML = equipos.map(([v, t, c]) =>
    `<button class="chip" data-grupo="${v}" style="--c:${c}" aria-pressed="${ESTADO.filtros.grupo === v}">
      <i></i>${t}</button>`).join("");

  const tipos = ["EF", "FORV", "FORM", "ECO", "CAP", "RET", "POST", "HITO"].filter((t) => d.tipos[t]);
  $("#chipsTipo").innerHTML = tipos.map((t) =>
    `<button class="chip" data-tipo="${t}" style="--c:${d.tipos[t]?.color || '#666'}" aria-pressed="${ESTADO.filtros.tipo === t}">
      ${d.tipos[t].nombre}</button>`).join("");
}

const sinAcentos = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function visibles() {
  const { q, grupo, tipo } = ESTADO.filtros;
  const texto = sinAcentos(q.trim());
  return ESTADO.eventos.filter((e) => {
    if (grupo && e.grupo !== grupo && !(grupo === "escuela" && e.tipo === "CAP")) return false;
    if (tipo && e.tipo !== tipo) return false;
    if (texto) {
      const pajar = sinAcentos([e.actividad, e.responsable, e.lugar, e.nota, e.tipoNombre, e.diaSemana].join(" "));
      if (!texto.split(/\s+/).every((w) => pajar.includes(w))) return false;
    }
    return true;
  });
}

function pintarAgenda() {
  const d = ESTADO.datos;
  const evs = visibles();
  const porMes = Array.from({ length: 12 }, () => []);
  for (const e of evs) porMes[e.mes - 1].push(e);

  const foco = (m) => d.focos[String(Math.floor((m - 1) / 3) + 1)]?.titulo || "";

  $("#meses").innerHTML = porMes.map((lista, i) => {
    const m = i + 1;
    const cuerpo = lista.length ? lista.map(tarjeta).join("")
      : `<p class="vacio-mes">Sin actividades con este filtro.</p>`;
    return `<section class="mes" id="mes-${m}" data-mes="${m}">
      <header class="mes__cab">
        <span class="mes__n">${String(m).padStart(2, "0")}</span>
        <div><h3 class="mes__nom">${MESES[i]}</h3>
          <p class="mes__sub">${lista.length} ${lista.length === 1 ? "actividad" : "actividades"}</p></div>
        <p class="mes__foco">${foco(m)}</p>
      </header>
      <div class="lista-eventos">${cuerpo}</div>
      <button class="agregar" data-agregar="${m}">+ Agregar actividad en ${MESES[i]}</button>
    </section>`;
  }).join("");

  const total = evs.length;
  $("#cuenta").textContent = `${total} de ${ESTADO.eventos.length} actividades`;
  $("#btnLimpiar").hidden = !(ESTADO.filtros.q || ESTADO.filtros.grupo || ESTADO.filtros.tipo);
  observar();
}

function tarjeta(e) {
  const editado = !!ESTADO.cambios.editados[e.id];
  const nuevo = e.id.startsWith("nuevo-");
  const nota = e.nota ? `<p class="ev-nota">${esc(e.nota)}</p>` : "";
  return `<article class="evento ${editado ? "editado" : ""} ${nuevo ? "nuevo" : ""}"
      data-id="${e.id}" style="--c:${e.color}" tabindex="0" role="button" aria-label="${esc(e.actividad)}">
    <div class="ev-fecha ${e.finde ? "ev-finde" : ""}">
      <span class="ev-dia">${e.dia}</span>
      <span class="ev-dow">${e.diaSemana.slice(0, 3)}</span>
    </div>
    <div class="ev-cuerpo">
      <h4 class="ev-tit">${esc(e.actividad)}</h4>
      <div class="ev-meta">
        ${e.responsable ? `<span><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4"/></svg>${esc(e.responsable)}</span>` : ""}
        ${e.lugar ? `<span><svg viewBox="0 0 24 24"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>${esc(e.lugar)}</span>` : ""}
      </div>
      ${nota}
    </div>
    <div class="ev-lado">
      <span class="etiqueta" style="--c:${e.color}">${e.tipoNombre}</span>
      <span class="ev-hora">${esc(e.hora || "—")}</span>
      <div class="ev-acciones">
        <button data-editar="${e.id}" title="Editar" aria-label="Editar ${esc(e.actividad)}">
          <svg viewBox="0 0 24 24"><path d="M4 20h4L20 8l-4-4L4 16Z"/><path d="m14 6 4 4"/></svg>
        </button>
        <button data-borrar="${e.id}" title="Borrar" aria-label="Borrar ${esc(e.actividad)}">
          <svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>
        </button>
      </div>
    </div>
  </article>`;
}

/* ------------------------------------------------------------------ ciclos */

function pintarCiclos() {
  const d = ESTADO.datos;
  $("#ciclos").innerHTML = d.ciclos.map((c) => {
    const color = d.tipos[c.tipo].color;
    const retiroA = fmtCorto(c.retiro.desde), retiroB = fmtCorto(c.retiro.hasta);
    return `<article class="ciclo" style="--c:${color}">
      <header class="ciclo__cab">
        <span class="ciclo__canal">${c.tipo === "FORV" ? "Ciclo de varones" : "Ciclo de mujeres"}</span>
        <h3 class="ciclo__nom">${c.nombre}</h3>
        <span class="ciclo__retiro">Retiro <b>${retiroA} → ${retiroB}</b></span>
      </header>
      <div class="juntas">
        ${c.juntas.map((j) => `<button class="junta" data-junta="${c.tipo}-${j.n}" data-ciclo="${c.tipo}">
          <span class="junta__top"><span class="junta__n">${j.n}</span>
            <span class="junta__fecha">${fmtCorto(j.fecha)}</span></span>
          <span class="junta__txt">${esc(j.corta)}</span>
          ${j.nota ? `<span class="junta__nota">${esc(j.nota)}</span>` : ""}
        </button>`).join("")}
      </div>
      <footer class="ciclo__pie">
        ${c.extra.map((x) => `<div class="extra"><time>${fmtCorto(x.fecha)}</time>
          <div><b>${esc(x.actividad)}</b>${esc(x.detalle)}</div></div>`).join("")}
      </footer>
    </article>`;
  }).join("");
}

/* ------------------------------------------------------------------ escuela */

function pintarEscuela() {
  const d = ESTADO.datos;
  $("#escuelaLista").innerHTML = d.capacitacion.map((c, i) => `
    <article class="clase">
      <span class="clase__n">${String(i + 1).padStart(2, "0")}</span>
      <p class="clase__fecha">${fmtLargo(c.fecha)} · 9:00 a 11:00 a.m.</p>
      <h3 class="clase__tema">${esc(c.tema)}</h3>
      <p class="clase__det">${esc(c.detalle)}</p>
      <p class="clase__resp">${esc(c.responsable)}</p>
    </article>`).join("");
}

/* ------------------------------------------------------------------ economía */

function pintarEconomia() {
  const d = ESTADO.datos;
  const filas = d.economia.map((e) => `<div class="eco-fila">
      <span class="eco-fecha">${fmtCorto(e.fecha)} · ${diaSemana(e.fecha).slice(0, 3)}</span>
      <span class="eco-nom">${esc(e.nombre)}${e.nota ? `<small>${esc(e.nota)}</small>` : ""}</span>
      <span class="eco-resp">${esc(e.responsable)}</span>
      <span class="eco-meta">Meta por definir</span>
    </div>`).join("");
  $("#economiaTabla").innerHTML = `
    <div class="eco-fila eco-fila--cab"><span>Fecha</span><span>Actividad</span><span>Responsable</span><span>Meta</span></div>
    ${filas}`;
}

/* ------------------------------------------------------------------ bloqueos */

function pintarBloqueos() {
  const d = ESTADO.datos;
  const clases = ["Litúrgico", "Cívico", "Parroquial"];
  const color = { "Litúrgico": "#7a1b36", "Cívico": "#2f5d7c", "Parroquial": "#a8842f" };
  const grupos = clases.map((c) => {
    const lista = d.bloqueos.filter((b) => b.clase === c);
    if (!lista.length) return "";
    return `<section class="bloqueo-grupo" style="--c:${color[c]}">
      <h3><i></i>${c}${c === "Litúrgico" ? "s" : "s"}</h3>
      ${lista.map((b) => `<div class="bloqueo">
        <time>${fmtCorto(b.fecha)}</time>
        <div><b>${esc(b.nombre)}</b>${b.nota ? `<small>${esc(b.nota)}</small>` : ""}</div>
      </div>`).join("")}
    </section>`;
  });
  $("#bloqueosLista").innerHTML = grupos.join("");
}

/* ------------------------------------------------------------------ hitos */

function pintarHitos() {
  const d = ESTADO.datos;
  $("#hitosLista").innerHTML = d.hitos.map((h) => `
    <article class="hito">
      <span class="hito__mar"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7"/></svg></span>
      <div><b>${esc(h.hito)}</b><span>${esc(h.responsable)}${h.con ? ` · ${esc(h.con)}` : ""}</span>
        <span class="mes-chip">${esc(h.mes)}</span></div>
    </article>`).join("");
}

/* ------------------------------------------------------------------ cajón */

function abrirCajon(html) {
  $("#cajonCuerpo").innerHTML = html;
  $("#cajon").classList.add("abierto");
  $("#cajon").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  $("#cajon .cerrar").focus();
}
function cerrarCajon() {
  $("#cajon").classList.remove("abierto");
  $("#cajon").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function abrirManual(id) {
  const m = ESTADO.manual?.entradas?.find((x) => x.id === id);
  if (!m) return;
  abrirCajon(`
    <p class="manual__fuente">Manual del Retiro de ACTS · ${esc(m.fuente)}</p>
    <h2 class="manual__tema" id="cajonTitulo">${esc(m.tema)}</h2>
    <blockquote class="manual__cita">${m.cita.map((p) => `<p>${esc(p)}</p>`).join("")}</blockquote>
    <p class="manual__aplica">${m.aplica}</p>
    <p class="manual__pag">
      <svg viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M20 18v3H6.5A2.5 2.5 0 0 1 4 18.5"/></svg>
      ${esc(m.fuente)} — consulta esa página en el Manual impreso del equipo.
    </p>`);
}

function abrirEvento(id) {
  const e = ESTADO.eventos.find((x) => x.id === id);
  if (!e) return;
  abrirCajon(`
    <p class="det__tipo" style="--c:${e.color}">${e.tipoNombre}</p>
    <h2 class="det__tit" id="cajonTitulo">${esc(e.actividad)}</h2>
    <div class="det__fila"><b>Fecha</b><span>${fmtLargo(e.fecha)} de 2027${e.finde ? " · fin de semana" : ""}</span></div>
    <div class="det__fila"><b>Hora</b><span>${esc(e.hora || "—")}</span></div>
    ${e.responsable ? `<div class="det__fila"><b>Responsable</b><span>${esc(e.responsable)}</span></div>` : ""}
    ${e.lugar ? `<div class="det__fila"><b>Lugar</b><span>${esc(e.lugar)}</span></div>` : ""}
    ${e.nota ? `<div class="det__fila"><b>Nota</b><span>${esc(e.nota)}</span></div>` : ""}
    <div class="det__fila"><b>Referencia</b><span>${refDe(e.tipo)}</span></div>
    <p style="margin-top:22px"><button class="btn solo-lectura" data-editar="${e.id}">Editar esta actividad</button></p>`);
}

function refDe(tipo) {
  const r = {
    FORV: ["formacion-13", "Manual · cap. 3, p. 47"],
    FORM: ["formacion-13", "Manual · cap. 3, p. 47"],
    EF: ["tabla-3-2", "Manual · cap. 3, Tabla 3.2"],
    RET: ["formacion-13", "Manual · cap. 8"],
    POST: ["pentecostes", "Manual · cap. 8, p. 130"],
    ECO: ["presupuesto-final", "Manual · cap. 9, p. 140"],
    CAP: ["agenda-junta", "Manual · cap. 3, p. 48"],
    HITO: ["reporte-final", "Manual · cap. 9"],
  }[tipo] || ["formacion-13", "Manual del Retiro de ACTS"];
  return `<a href="#" data-manual="${r[0]}" style="color:var(--oro);text-decoration:none;border-bottom:1px dashed currentColor">${r[1]}</a>`;
}

/* ------------------------------------------------------------------ edición */

let EDITANDO = null;

function abrirEditor(id, fechaPorDefecto, mes) {
  const d = ESTADO.datos;
  EDITANDO = id;
  const e = id ? ESTADO.eventos.find((x) => x.id === id) : null;
  if (!$("#f_tipo").options.length) {
    $("#f_tipo").innerHTML = Object.entries(ESTADO.datos.tipos)
      .map(([k, v]) => `<option value="${k}">${v.nombre}</option>`).join("");
  }
  $("#modalTitulo").textContent = e ? "Editar actividad" : "Nueva actividad";
  $("#f_actividad").value = e?.actividad || "";
  $("#f_fecha").value = e?.fecha || fechaPorDefecto || "2027-01-10";
  $("#f_hora").value = e?.hora || "10:00 a.m.";
  $("#f_tipo").value = e?.tipo || "FORV";
  $("#f_responsable").value = e?.responsable || "";
  $("#f_lugar").value = e?.lugar || "";
  $("#f_nota").value = e?.nota || "";
  $("#f_motivo").value = "";
  $("#btnBorrar").hidden = !e;

  $("#responsables").innerHTML = [...new Set(ESTADO.eventos.map((x) => x.responsable).filter(Boolean))]
    .sort().map((r) => `<option>${esc(r)}</option>`).join("");

  $("#modal").showModal();
  setTimeout(() => $("#f_actividad").focus(), 60);
}

function guardarEditor(ev) {
  ev.preventDefault();
  const f = ev.target;
  const datos = {
    actividad: $("#f_actividad").value.trim(),
    fecha: $("#f_fecha").value,
    hora: $("#f_hora").value.trim() || "—",
    tipo: $("#f_tipo").value,
    responsable: $("#f_responsable").value.trim(),
    lugar: $("#f_lugar").value.trim(),
    nota: $("#f_nota").value.trim(),
  };
  if (!datos.actividad || !datos.fecha) return;
  if (!ESTADO.datos.tipos[datos.tipo]) datos.tipo = "EF";
  const motivo = $("#f_motivo").value.trim();
  const autor = ESTADO.autor || "Sin nombre";

  const base = ESTADO.datos.eventos.find((x) => x.id === EDITANDO);
  if (EDITANDO && base) {
    const antes = { ...base, ...(ESTADO.cambios.editados[EDITANDO] || {}) };
    ESTADO.cambios.editados[EDITANDO] = datos;
    ESTADO.historial.push({ accion: "editar", id: EDITANDO, antes, despues: datos, motivo, autor, fecha: new Date().toISOString() });
    toast("Cambio guardado");
  } else {
    const id = `nuevo-${Date.now()}`;
    const nuevo = {
      ...datos, id, dia: 0, mes: 0, anio: 2027,
      diaSemana: diaSemana(datos.fecha), finde: [0, 6].includes(fechaDe(datos.fecha).getDay()),
      tipoNombre: ESTADO.datos.tipos[datos.tipo].nombre,
      grupo: ESTADO.datos.tipos[datos.tipo].grupo, horaMin: horaMin(datos.hora), color: ESTADO.datos.tipos[datos.tipo].color,
    };
    ESTADO.cambios.creados.push(nuevo);
    ESTADO.historial.push({ accion: "crear", id, antes: null, despues: nuevo, motivo, autor, fecha: new Date().toISOString() });
    toast("Actividad agregada", "ok");
  }
  guardarLocal();
  aplicarCambios();
  refrescar();
  $("#modal").close();
}

function borrarEvento(id) {
  const e = ESTADO.eventos.find((x) => x.id === id);
  if (!e) return;
  if (!confirm(`¿Borrar «${e.actividad}» del ${fmtLargo(e.fecha)}?\n\nQuedará registrado en el acta.`)) return;
  if (id.startsWith("nuevo-")) {
    ESTADO.cambios.creados = ESTADO.cambios.creados.filter((x) => x.id !== id);
  } else {
    ESTADO.cambios.borrados.push(id);
    delete ESTADO.cambios.editados[id];
  }
  ESTADO.historial.push({ accion: "borrar", id, antes: e, despues: null, motivo: "Borrada en modo reunión", autor: ESTADO.autor || "Sin nombre", fecha: new Date().toISOString() });
  guardarLocal();
  aplicarCambios();
  refrescar();
  toast("Actividad borrada");
}

function deshacer() {
  const ultimo = ESTADO.historial.pop();
  if (!ultimo) return toast("No hay nada que deshacer");
  if (ultimo.accion === "editar") delete ESTADO.cambios.editados[ultimo.id];
  if (ultimo.accion === "crear") ESTADO.cambios.creados = ESTADO.cambios.creados.filter((x) => x.id !== ultimo.id);
  if (ultimo.accion === "borrar") ESTADO.cambios.borrados = ESTADO.cambios.borrados.filter((x) => x !== ultimo.id);
  guardarLocal();
  aplicarCambios();
  refrescar();
  toast("Deshecho");
}

function contarCambios() {
  return ESTADO.cambios.creados.length + Object.keys(ESTADO.cambios.editados).length + ESTADO.cambios.borrados.length;
}

function pintarBarra() {
  const n = contarCambios();
  const barra = $("#cambiosBarra");
  $("#cambiosN").textContent = n;
  $("#cambiosTxt").textContent = n === 1 ? "cambio sin publicar" : "cambios sin publicar";
  $("#cambiosAutor").textContent = ESTADO.autor ? `· ${ESTADO.autor}` : "";
  barra.hidden = n === 0;
  barra.classList.toggle("visible", n > 0);
}

/* ------------------------------------------------------------------ acta */

function actaMarkdown() {
  const d = ESTADO.datos;
  const filas = ESTADO.historial.map((h) => {
    const t = h.accion === "crear" ? "Agregada" : h.accion === "borrar" ? "Borrada" : "Modificada";
    const f = h.despues || h.antes;
    const cuando = fmtLargo(f.fecha) + (f.hora ? ` · ${f.hora}` : "");
    const detalle = h.accion === "editar"
      ? Object.keys(h.despues).filter((k) => JSON.stringify(h.antes?.[k]) !== JSON.stringify(h.despues[k]))
          .map((k) => `\`${k}\`: ${JSON.stringify(h.antes?.[k] ?? "")} → ${JSON.stringify(h.despues[k])}`).join("; ")
      : `${f.tipo} · ${f.responsable || "sin responsable"}`;
    return `| ${cuando} | ${t} | ${f.actividad} | ${detalle} | ${h.motivo || ""} | ${h.autor} |`;
  }).join("\n");

  const total = ESTADO.eventos.length;
  return `# Acta de cambios · Calendario 2027

**Parroquia El Salvador del Mundo · Equipo Facilitador de Retiros ACTS**
Generada: ${new Date().toLocaleString("es-HN")}
${ESTADO.autor ? `**Quien anota:** ${ESTADO.autor}\n` : ""}
Actividades después de los cambios: **${total}** · Cambios registrados: **${ESTADO.historial.length}**

| Cuándo | Acción | Actividad | Detalle | Motivo | Autor |
|---|---|---|---|---|---|
${filas || "| — | — | Sin cambios registrados | — | — | — |"}

## Notas de la reunión

_Escribe aquí lo que se acordó y no cabe en una fila._

---

## Para el documento imprimible

Este archivo es la fuente que Hermes lee para actualizar \`datos_calendario.py\`, el Excel y los PDF.
Los cambios de fecha, responsable y concepto se aplican tal como están en \`cambios.json\`.
`;
}

function cambiosJSON() {
  return {
    version: 1,
    actualizado: new Date().toISOString(),
    autor: ESTADO.autor || "Sin nombre",
    base: "calendario-acts-2027",
    resumen: { totalEventos: ESTADO.eventos.length, cambios: ESTADO.historial.length },
    eventos: ESTADO.eventos.map((e) => ({
      id: e.id, fecha: e.fecha, hora: e.hora, actividad: e.actividad, tipo: e.tipo,
      responsable: e.responsable, lugar: e.lugar, nota: e.nota,
    })),
    cambios: { creados: ESTADO.cambios.creados.map((e) => e.id), editados: ESTADO.cambios.editados, borrados: ESTADO.cambios.borrados },
    historial: ESTADO.historial,
  };
}

function verActa() {
  const md = actaMarkdown();
  abrirCajon(`<p class="manual__fuente">Acta de la reunión</p>
    <h2 class="manual__tema" id="cajonTitulo">${ESTADO.historial.length} cambios registrados</h2>
    <div class="manual__cita" style="font-family:var(--sans);font-size:12.5px;white-space:pre-wrap;max-height:52vh;overflow:auto">${esc(md.slice(0, 6000))}</div>
    <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">
      <button class="btn btn--solido" data-descargar="md">Descargar acta</button>
      <button class="btn" data-descargar="json">Descargar JSON</button>
    </div>`);
}

function descargar(tipo = "json") {
  const esMd = tipo === "md";
  const contenido = esMd ? actaMarkdown() : JSON.stringify(cambiosJSON(), null, 1);
  const blob = new Blob([contenido], { type: esMd ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = esMd ? "acta-reunion-2027.md" : "cambios.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Archivo descargado", "ok");
}

/* ------------------------------------------------------------------ publicar */

const b64 = (txt) => {
  const bytes = new TextEncoder().encode(txt);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};

async function publicar() {
  const token = $("#p_token").value.trim();
  const owner = $("#p_owner").value.trim();
  const repo = $("#p_repo").value.trim();
  const rama = $("#p_rama").value.trim() || "main";
  ESTADO.autor = $("#p_autor").value.trim() || ESTADO.autor;
  const estado = $("#pubEstado");

  if (!token) { estado.textContent = "Falta el token de GitHub."; return; }
  if (!ESTADO.autor) { estado.textContent = "Escribe tu nombre para que quede en el acta."; return; }
  guardarLocal();

  const archivos = [
    ["data/cambios.json", JSON.stringify(cambiosJSON(), null, 1)],
    ["data/acta.md", actaMarkdown()],
  ];

  try {
    estado.textContent = "Publicando…";
    for (const [ruta, texto] of archivos) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${ruta}`;
      let sha;
      const r = await fetch(`${url}?ref=${rama}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (r.ok) sha = (await r.json()).sha;
      const put = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Acta de la reunión · ${new Date().toLocaleDateString("es-HN")}${ESTADO.autor ? ` (${ESTADO.autor})` : ""}`,
          content: b64(texto),
          branch: rama,
          ...(sha ? { sha } : {}),
        }),
      });
      if (!put.ok) throw new Error(`${ruta}: ${put.status} ${(await put.json()).message || ""}`);
    }
    localStorage.setItem("acts2027:token", token);
    estado.textContent = "Publicado. GitHub Pages tarda un minuto en actualizarse.";
    toast("Cambios publicados en GitHub", "ok");
    $("#modalPublicar").close();
  } catch (e) {
    estado.textContent = `No se pudo publicar: ${e.message}`;
    toast("Error al publicar", "mal");
  }
}

/* ------------------------------------------------------------------ UI */

let TOBS = null;

function observar() {
  // escalona la entrada de las tarjetas; nunca las deja ocultas
  $$(".mes-mapa, .evento, .clase").forEach((el, i) => {
    el.style.setProperty("--i", String(i % 26));
  });
}

function refrescar() {
  aplicarCambios();
  pintarHero();
  pintarMapa();
  pintarAgenda();
  pintarBarra();
  observar();
}

function toast(msg, tipo = "") {
  const el = document.createElement("div");
  el.className = `toast ${tipo ? "toast--" + tipo : ""}`;
  el.textContent = msg;
  $("#toasts").append(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; }, 2600);
  setTimeout(() => el.remove(), 3200);
}

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------------------------------------------ eventos UI */

function enganchar() {
  // navegación
  $("#mesesNav").innerHTML = MESES.map((m, i) =>
    `<a href="#mes-${i + 1}" data-mes="${i + 1}">${MESES_C[i]}</a>`).join("");

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-manual],[data-ir],[data-editar],[data-borrar],[data-agregar],[data-descargar],[data-junta],[data-cerrar-cajon]");
    if (!t) return;
    if (t.dataset.manual) { ev.preventDefault(); abrirManual(t.dataset.manual); }
    if (t.dataset.ir) { ev.preventDefault(); document.getElementById(`mes-${t.dataset.ir}`)?.scrollIntoView({ behavior: "smooth" }); }
    if (t.dataset.editar) { ev.stopPropagation(); abrirEditor(t.dataset.editar); }
    if (t.dataset.borrar) { ev.stopPropagation(); borrarEvento(t.dataset.borrar); }
    if (t.dataset.agregar) { ev.preventDefault(); abrirEditor(null, `2027-${String(t.dataset.agregar).padStart(2, "0")}-10`); }
    if (t.dataset.descargar) descargar(t.dataset.descargar);
    if (t.dataset.junta) abrirJunta(t.dataset.ciclo, t.dataset.junta.split("-").pop());
    if (t.hasAttribute("data-cerrar-cajon")) cerrarCajon();
  });

  // tarjetas de evento
  $("#meses").addEventListener("click", (ev) => {
    if (ev.target.closest("[data-editar],[data-borrar]")) return;
    const card = ev.target.closest(".evento");
    if (card) abrirEvento(card.dataset.id);
  });
  $("#meses").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target.classList.contains("evento")) abrirEvento(ev.target.dataset.id);
  });

  // filtros
  $("#chipsEquipo").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-grupo]");
    if (!b) return;
    ESTADO.filtros.grupo = ESTADO.filtros.grupo === b.dataset.grupo ? "" : b.dataset.grupo;
    pintarFiltros();
    transicion(pintarAgenda);
  });
  $("#chipsTipo").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-tipo]");
    if (!b) return;
    ESTADO.filtros.tipo = ESTADO.filtros.tipo === b.dataset.tipo ? "" : b.dataset.tipo;
    pintarFiltros();
    transicion(pintarAgenda);
  });
  let tempo;
  $("#buscar").addEventListener("input", (ev) => {
    clearTimeout(tempo);
    tempo = setTimeout(() => {
      ESTADO.filtros.q = ev.target.value;
      transicion(pintarAgenda);
    }, 130);
  });
  $("#btnLimpiar").addEventListener("click", () => {
    ESTADO.filtros = { q: "", grupo: "", tipo: "" };
    $("#buscar").value = "";
    pintarFiltros();
    transicion(pintarAgenda);
  });
  $("#btnBuscar").addEventListener("click", () => { $("#agenda").scrollIntoView(); setTimeout(() => $("#buscar").focus(), 400); });

  // tema
  $("#btnTema").addEventListener("click", () => {
    ESTADO.tema = (document.documentElement.dataset.tema === "oscuro") ? "claro" : "oscuro";
    aplicarTema();
    guardarLocal();
  });

  // modo reunión
  $("#btnReunion").addEventListener("click", () => {
    ESTADO.reunion = !ESTADO.reunion;
    document.body.classList.toggle("reunion", ESTADO.reunion);
    $("#btnReunion").setAttribute("aria-pressed", String(ESTADO.reunion));
    guardarLocal();
    pintarBarra();
    toast(ESTADO.reunion
      ? "Modo reunión: puedes editar, borrar y agregar. Todo queda en el acta."
      : "Modo lectura");
    if (ESTADO.reunion && !ESTADO.autor) {
      setTimeout(() => {
        $("#p_autor").value = "";
        $("#modalPublicar").showModal();
      }, 500);
    }
  });

  // modal
  $("#formEvento").addEventListener("submit", guardarEditor);
  $("#btnBorrar").addEventListener("click", () => {
    if (!EDITANDO) return;
    const id = EDITANDO;
    $("#modal").close();
    borrarEvento(id);
  });

  // barra de cambios
  $("#btnDeshacer").addEventListener("click", deshacer);
  $("#btnVerCambios").addEventListener("click", verActa);
  $("#btnDescargar").addEventListener("click", () => descargar("json"));
  $("#btnDescargar2").addEventListener("click", () => descargar("json"));
  $("#btnPublicar").addEventListener("click", () => {
    $("#p_token").value = localStorage.getItem("acts2027:token") || "";
    $("#p_autor").value = ESTADO.autor || "";
    $("#pubEstado").textContent = "";
    $("#modalPublicar").showModal();
  });
  $("#btnHacerPublicar").addEventListener("click", publicar);

  // cerrar modales
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-cerrar-modal]")) {
      ev.target.closest("dialog")?.close();
    }
  });

  // cajón
  $("#cajon").addEventListener("click", (ev) => {
    if (ev.target.matches("[data-cerrar-cajon]") || ev.target.closest(".cerrar")) cerrarCajon();
  });

  // teclado
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      ev.preventDefault(); $("#buscar").focus();
    }
    if (ev.key === "Escape") cerrarCajon();
  });

  // scroll
  let ultimo = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    const alto = document.documentElement.scrollHeight - innerHeight;
    $("#progreso").style.width = `${(y / alto) * 100}%`;
    $("#barra").classList.toggle("compacta", y > 40 && y > ultimo);
    ultimo = y;
    marcarMes();
  }, { passive: true });

  // scroll spy
  const espia = new IntersectionObserver((xs) => {
    xs.forEach((x) => {
      if (x.isIntersecting) {
        const m = x.target.dataset.mes;
        $$("#mesesNav a").forEach((a) => a.classList.toggle("activo", a.dataset.mes === m));
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  $$(".mes").forEach((s) => espia.observe(s));

  // compartir / imprimir
  addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "p") {
      document.body.classList.remove("reunion");
    }
  });
}

let mesActual = 0;
function marcarMes() {
  const alto = innerHeight * 0.45;
  for (const s of $$(".mes")) {
    const r = s.getBoundingClientRect();
    if (r.top <= alto && r.bottom > alto) {
      const m = +s.dataset.mes;
      if (m !== mesActual) {
        mesActual = m;
        $$("#mesesNav a").forEach((a) => a.classList.toggle("activo", +a.dataset.mes === m));
      }
      break;
    }
  }
}

function transicion(fn) {
  if (document.startViewTransition && document.visibilityState === "visible"
      && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.startViewTransition(fn);
  } else fn();
}

function abrirJunta(ciclo, n) {
  const c = ESTADO.datos.ciclos.find((x) => x.tipo === ciclo);
  const j = c.juntas[+n - 1];
  abrirCajon(`
    <p class="manual__fuente">${esc(c.nombre)} · Junta ${j.n} de 13</p>
    <h2 class="manual__tema" id="cajonTitulo">${fmtLargo(j.fecha)} · 10:00 a.m. a 12:00 m.</h2>
    <p class="manual__aplica" style="font-size:14.5px;color:var(--tinta)">${esc(j.objetivo)}</p>
    ${j.nota ? `<p class="manual__aplica" style="color:var(--vino);font-style:italic">${esc(j.nota)}</p>` : ""}
    <p class="manual__pag">Objetivo según el Manual, Tabla 3.2 (cap. 3, p. 47). El ciclo completo se explica en la ficha del manual.</p>
    <button class="btn" data-manual="tabla-3-2" style="margin-top:12px">Ver la Tabla 3.2 del Manual</button>`);
}

/* ------------------------------------------------------------------ arranque */

(async function main() {
  leerLocal();
  aplicarTema();
  try {
    await cargar();
  } catch (e) {
    document.body.innerHTML = `<div style="padding:60px;font-family:system-ui">
      <h1>No se pudieron cargar los datos</h1>
      <p>Abre el sitio con un servidor local (<code>python -m http.server</code>) o desde GitHub Pages.</p>
      <pre>${esc(e.message)}</pre></div>`;
    return;
  }

  pintarHero();
  pintarLeyenda();
  pintarMapa();
  pintarFiltros();
  pintarAgenda();
  pintarCiclos();
  pintarEscuela();
  pintarEconomia();
  pintarBloqueos();
  pintarHitos();
  enganchar();
  document.body.classList.toggle("reunion", ESTADO.reunion);
  $("#btnReunion").setAttribute("aria-pressed", String(ESTADO.reunion));
  pintarBarra();
  observar();
  animarCifras();

})();
