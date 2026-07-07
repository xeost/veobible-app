"use client";

import React, { useState } from "react";
import { Check, X, Star } from "lucide-react";

type CompetitorKey = "youversion" | "gateway" | "biblehub";

interface CompetitorData {
  name: string;
  focus: string;
  ads: React.ReactNode;
  ui: string;
  studyTools: string;
  audio: string;
  price: string;
  easeOfUse: string;
  url: string;
}

export function ComparisonTable() {
  const [compareWith, setCompareWith] = useState<CompetitorKey>("youversion");

  const competitors: Record<CompetitorKey, CompetitorData> = {
    youversion: {
      name: "YouVersion (Bible.com)",
      focus: "Devocional diario, planes de lectura y comunidad.",
      url: "https://www.bible.com",
      ads: (
        <div className="flex items-center gap-1.5 text-emerald-700">
          <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
          <span>Sin anuncios</span>
        </div>
      ),
      ui: "Moderna, pero con exceso de planes y menús.",
      studyTools: "Moderadas (Planes devocionales, notas y marcadores).",
      audio: "Sí, narraciones de audio integradas por capítulo.",
      price: "100% Gratis (Donaciones)",
      easeOfUse: "Buena (Navegación limpia)",
    },
    gateway: {
      name: "Bible Gateway",
      focus: "Consulta rápida y búsqueda de textos paralelos.",
      url: "https://www.biblegateway.com",
      ads: (
        <div className="flex items-center gap-1.5 text-red-700 font-medium">
          <X className="h-4.5 w-4.5 text-red-500 shrink-0" />
          <span>Publicidad molesta</span>
        </div>
      ),
      ui: "Anticuada, ruidosa y con banners de anuncios.",
      studyTools: "Buenas (Buscador avanzado y diccionarios básicos).",
      audio: "Sí, pero interrumpido por publicidad.",
      price: "Gratis con anuncios / Opción Plus de pago",
      easeOfUse: "Regular (La publicidad interrumpe la lectura)",
    },
    biblehub: {
      name: "Bible Hub",
      focus: "Estudio exegético profundo, concordancia y comentarios.",
      url: "https://biblehub.com",
      ads: (
        <div className="flex items-center gap-1.5 text-red-700 font-medium">
          <X className="h-4.5 w-4.5 text-red-500 shrink-0" />
          <span>Publicidad invasiva</span>
        </div>
      ),
      ui: "Muy anticuada (diseño 2005) y sobrecargada.",
      studyTools: "Excelentes (Interlineal hebreo/griego, léxicos y comentarios).",
      audio: "Sí, reproducción de audio básica por capítulo.",
      price: "100% Gratis (Sostenido por anuncios)",
      easeOfUse: "Baja (Muy saturada de enlaces y tablas)",
    },
  };

  const selectedCompetitor = competitors[compareWith];

  return (
    <div className="w-full">
      {/* Mobile-Only Pill Selector */}
      <div className="md:hidden flex flex-col gap-2.5 mb-6 bg-[#FAF9F5] p-3.5 rounded-2xl border border-slate-200/50">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
          Comparar VeoBible con:
        </span>
        <div className="flex gap-1.5 justify-center">
          <button
            onClick={() => setCompareWith("youversion")}
            className={`grow py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 border ${compareWith === "youversion"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            id="mobile-btn-web-youversion"
          >
            YouVersion
          </button>
          <button
            onClick={() => setCompareWith("gateway")}
            className={`grow py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 border ${compareWith === "gateway"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            id="mobile-btn-web-gateway"
          >
            Gateway
          </button>
          <button
            onClick={() => setCompareWith("biblehub")}
            className={`grow py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-200 border ${compareWith === "biblehub"
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            id="mobile-btn-web-biblehub"
          >
            Bible Hub
          </button>
        </div>
      </div>

      {/* Mobile-Only 3-Column Table (No scroll needed, fits 100% viewport) */}
      <div className="md:hidden rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.01)] bg-white overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left bg-white">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="py-4 px-3.5 font-semibold text-slate-600 text-xs w-[30%]">Característica</th>
              <th className="py-4 px-3 text-xs relative w-[35%] bg-amber-50/40 border-x border-amber-100/50">
                <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
                <span className="font-extrabold text-slate-950 block">VeoBible</span>
                <span className="inline-block rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-800 mt-0.5">
                  Recomendado
                </span>
              </th>
              <th className="py-4 px-3 font-bold text-slate-800 text-xs w-[35%]">
                {selectedCompetitor.name}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px] leading-relaxed">
            <tr>
              <td className="py-4 px-3.5 font-bold text-slate-900 bg-slate-50/10">Enfoque</td>
              <td className="py-4 px-3 font-medium text-slate-900 bg-amber-50/10 border-x border-amber-100/20">
                Lectura enfocada, sin distracciones ni publicidad.
              </td>
              <td className="py-4 px-3 text-slate-600">{selectedCompetitor.focus}</td>
            </tr>
            <tr>
              <td className="py-4 px-3.5 font-bold text-slate-900 bg-slate-50/10">Anuncios</td>
              <td className="py-4 px-3 font-medium text-slate-900 bg-amber-50/10 border-x border-amber-100/20">
                <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Cero Anuncios</span>
                </div>
              </td>
              <td className="py-4 px-3 text-slate-600">{selectedCompetitor.ads}</td>
            </tr>
            <tr>
              <td className="py-4 px-3.5 font-bold text-slate-900 bg-slate-50/10">Diseño</td>
              <td className="py-4 px-3 font-medium text-slate-900 bg-amber-50/10 border-x border-amber-100/20">
                Limpia, elegante, minimalista.
              </td>
              <td className="py-4 px-3 text-slate-600">{selectedCompetitor.ui}</td>
            </tr>
            <tr>
              <td className="py-4 px-3.5 font-bold text-slate-900 bg-slate-50/10">Estudio</td>
              <td className="py-4 px-3 font-medium text-slate-900 bg-amber-50/10 border-x border-amber-100/20">
                Básicas (Enfoque en lectura fluida y referencias).
              </td>
              <td className="py-4 px-3 text-slate-600">{selectedCompetitor.studyTools}</td>
            </tr>
            <tr>
              <td className="py-4 px-3.5 font-bold text-slate-900 bg-slate-50/10">Audio</td>
              <td className="py-4 px-3 font-medium text-slate-900 bg-amber-50/10 border-x border-amber-100/20">
                Voz natural premium.
              </td>
              <td className="py-4 px-3 text-slate-600">{selectedCompetitor.audio}</td>
            </tr>
            <tr>
              <td className="py-4 px-3.5 font-bold text-slate-900 bg-slate-50/10">Precio</td>
              <td className="py-4 px-3 font-medium text-slate-900 bg-amber-50/10 border-x border-amber-100/20">
                100% Gratis <br /> (Sostenido por canales asociados)
              </td>
              <td className="py-4 px-3 text-slate-600">{selectedCompetitor.price}</td>
            </tr>
            <tr>
              <td className="py-4 px-3.5 font-bold text-slate-900 bg-slate-50/10">Facilidad</td>
              <td className="py-4 px-3 font-medium text-slate-900 bg-amber-50/10 border-x border-amber-100/20">
                Excelente (Intuitiva)
              </td>
              <td className="py-4 px-3 text-slate-600">{selectedCompetitor.easeOfUse}</td>
            </tr>
            <tr>
              <td className="py-4 px-3.5 font-bold text-slate-900 bg-slate-50/10">Visitar</td>
              <td className="py-4 px-3 font-medium bg-amber-50/10 border-x border-amber-100/20 text-center">
                <a
                  href="https://veobible.com/es"
                  target="_blank"
                  className="inline-block w-full py-2 px-2 bg-amber-600 text-white font-bold rounded-lg shadow-sm hover:bg-amber-700 transition-colors"
                >
                  Ir a VeoBible
                </a>
              </td>
              <td className="py-4 px-3 text-center">
                <a
                  href={selectedCompetitor.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="inline-block w-full py-2 px-2 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  Visitar web
                </a>
              </td>
            </tr>

          </tbody>
        </table>
      </div>

      {/* Desktop-Only 5-Column Table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] custom-scrollbar">
        <table className="w-full min-w-[800px] border-collapse text-left bg-white">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="py-5 px-6 font-semibold text-slate-600 text-sm w-1/5">Característica</th>

              {/* Column 0: VeoBible (Highlighted) */}
              <th className="py-5 px-6 text-sm relative w-1/5 bg-amber-50/50 border-x border-amber-100/60">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-500" />
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-950 text-base">VeoBible</span>
                  <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    Recomendado
                  </span>
                </div>
                <span className="block text-slate-400 text-[11px] font-normal mt-0.5">veobible.com</span>
              </th>

              <th className="py-5 px-6 font-semibold text-slate-800 text-sm w-1/5">YouVersion (Bible.com)</th>
              <th className="py-5 px-6 font-semibold text-slate-800 text-sm w-1/5">Bible Gateway</th>
              <th className="py-5 px-6 font-semibold text-slate-800 text-sm w-1/5">Bible Hub</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {/* Row 1: Enfoque Principal */}
            <tr>
              <td className="py-5 px-6 font-bold text-slate-900 bg-slate-50/20">Enfoque Principal</td>
              <td className="py-5 px-6 font-medium text-slate-900 bg-amber-50/20 border-x border-amber-100/30">
                Lectura enfocada, tipografía fluida y paz visual.
              </td>
              <td className="py-5 px-6 text-slate-600">Devocional diario, planes de lectura y comunidad.</td>
              <td className="py-5 px-6 text-slate-600">Consulta rápida y búsqueda de textos paralelos.</td>
              <td className="py-5 px-6 text-slate-600">Estudio exegético profundo, concordancia y comentarios.</td>
            </tr>

            {/* Row 2: Anuncios */}
            <tr>
              <td className="py-5 px-6 font-bold text-slate-900 bg-slate-50/20">Publicidad / Anuncios</td>
              <td className="py-5 px-6 font-medium text-slate-900 bg-amber-50/20 border-x border-amber-100/30">
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                  Totalmente Limpia (Sin anuncios)
                </div>
              </td>
              <td className="py-5 px-6 text-slate-600">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                  Sin anuncios
                </div>
              </td>
              <td className="py-5 px-6 text-slate-600">
                <div className="flex items-center gap-1.5 text-red-700 font-medium">
                  <X className="h-4.5 w-4.5 text-red-500 shrink-0" />
                  Publicidad molesta y banners
                </div>
              </td>
              <td className="py-5 px-6 text-slate-600">
                <div className="flex items-center gap-1.5 text-red-700 font-medium">
                  <X className="h-4.5 w-4.5 text-red-500 shrink-0" />
                  Publicidad invasiva
                </div>
              </td>
            </tr>

            {/* Row 3: Interfaz */}
            <tr>
              <td className="py-5 px-6 font-bold text-slate-900 bg-slate-50/20">Diseño e Interfaz</td>
              <td className="py-5 px-6 font-medium text-slate-900 bg-amber-50/20 border-x border-amber-100/30">
                Moderna, minimalista, prioriza el texto sagrado.
              </td>
              <td className="py-5 px-6 text-slate-600">Moderna, pero con exceso de planes y menús.</td>
              <td className="py-5 px-6 text-slate-600">Anticuada, ruidosa y con banners de anuncios.</td>
              <td className="py-5 px-6 text-slate-600">Muy anticuada (diseño 2005) y sobrecargada.</td>
            </tr>

            {/* Row 4: Herramientas de Estudio */}
            <tr>
              <td className="py-5 px-6 font-bold text-slate-900 bg-slate-50/20">Herramientas de Estudio</td>
              <td className="py-5 px-6 font-medium text-slate-900 bg-amber-50/20 border-x border-amber-100/30">
                Básicas (Enfoque en lectura fluida y referencias).
              </td>
              <td className="py-5 px-6 text-slate-600">Moderadas (Planes devocionales, notas y marcadores).</td>
              <td className="py-5 px-6 text-slate-600">Buenas (Buscador avanzado y diccionarios básicos).</td>
              <td className="py-5 px-6 text-slate-600">Excelentes (Interlineal hebreo/griego, léxicos y comentarios).</td>
            </tr>

            {/* Row 5: Audio Biblia */}
            <tr>
              <td className="py-5 px-6 font-bold text-slate-900 bg-slate-50/20">Audio Biblia</td>
              <td className="py-5 px-6 font-medium text-slate-900 bg-amber-50/20 border-x border-amber-100/30">
                Sí, voz fluida de alta calidad con reproducción en YouTube.
              </td>
              <td className="py-5 px-6 text-slate-600">Sí, narraciones de audio integradas por capítulo.</td>
              <td className="py-5 px-6 text-slate-600">Sí, pero interrumpido por publicidad.</td>
              <td className="py-5 px-6 text-slate-600">Sí, reproducción de audio básica por capítulo.</td>
            </tr>

            {/* Row 6: Precio */}
            <tr>
              <td className="py-5 px-6 font-bold text-slate-900 bg-slate-50/20">Precio</td>
              <td className="py-5 px-6 font-medium text-slate-900 bg-amber-50/20 border-x border-amber-100/30">
                <div className="flex items-center gap-1.5 text-emerald-700">100% Gratis</div><br />
                Sostenido por sus canales de YouTube asociados
              </td>
              <td className="py-5 px-6 text-slate-600">100% Gratis (Donaciones)</td>
              <td className="py-5 px-6 text-slate-600">Gratis con anuncios / Opción Plus de pago</td>
              <td className="py-5 px-6 text-slate-600">100% Gratis (Sostenido por anuncios)</td>
            </tr>

            {/* Row 7: Facilidad de Uso */}
            <tr>
              <td className="py-5 px-6 font-bold text-slate-900 bg-slate-50/20">Facilidad de Uso</td>
              <td className="py-5 px-6 font-medium text-slate-900 bg-amber-50/20 border-x border-amber-100/30">
                Excelente (Ideal para toda edad)
              </td>
              <td className="py-5 px-6 text-slate-600">Buena (Navegación limpia)</td>
              <td className="py-5 px-6 text-slate-600">Regular (La publicidad interrumpe la lectura)</td>
              <td className="py-5 px-6 text-slate-600">Baja (Muy saturada de enlaces y tablas)</td>
            </tr>

            {/* Row 8: Visitar */}
            <tr>
              <td className="py-5 px-6 font-bold text-slate-900 bg-slate-50/20 border-b-transparent">Visitar Sitio</td>
              <td className="py-5 px-6 font-medium bg-amber-50/20 border-x border-amber-100/30 text-center border-b-transparent">
                <a
                  href="https://veobible.com/es"
                  target="_blank"
                  className="inline-block w-full py-2.5 px-4 bg-amber-600 text-white font-bold rounded-xl shadow-sm hover:bg-amber-700 transition-colors"
                >
                  Ir a VeoBible
                </a>
              </td>
              <td className="py-5 px-6 text-center border-b-transparent">
                <a
                  href="https://www.bible.com"
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="inline-block w-full py-2.5 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  Visitar web
                </a>
              </td>
              <td className="py-5 px-6 text-center border-b-transparent">
                <a
                  href="https://www.biblegateway.com"
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="inline-block w-full py-2.5 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  Visitar web
                </a>
              </td>
              <td className="py-5 px-6 text-center border-b-transparent">
                <a
                  href="https://biblehub.com"
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="inline-block w-full py-2.5 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  Visitar web
                </a>
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  );
}
