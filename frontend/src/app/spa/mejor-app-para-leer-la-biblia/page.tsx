import ExportedImage from "next-image-export-optimizer";
import { Check, X, Star, Smartphone, Shield, BookOpen, Clock, Heart, Volume2, Search, ArrowRight, BookMarked, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ForceLightTheme } from "./force-light-theme";
import { ComparisonTable } from "./comparison-table";
import type { Metadata } from "next";

// SEO Metadata for the landing page
export const metadata: Metadata = {
  title: "La Mejor App para Leer la Biblia en 2026 - Comparativa",
  description: "Descubre cuál es la mejor aplicación para leer y estudiar la Biblia este año. Análisis completo de VeoBible, YouVersion, Bible Gateway y Logos.",
  openGraph: {
    title: "La Mejor App para Leer la Biblia en 2026 - Comparativa Completa",
    description: "Comparamos las mejores apps bíblicas: VeoBible, YouVersion, Bible Gateway y Logos. Encuentra la aplicación ideal para tu lectura diaria sin distracciones.",
    type: "website",
    url: "/mejor-app-para-leer-la-biblia",
  },
};

interface AppDetails {
  name: string;
  tagline: string;
  focus: string;
  ads: string;
  ui: string;
  offline: string;
  audio: string;
  price: string;
  easeOfUse: string;
  isWinner?: boolean;
}

export default function BibleLandingPage() {
  const apps: AppDetails[] = [
    {
      name: "VeoBible",
      tagline: "El nuevo estándar de lectura minimalista",
      focus: "Lectura enfocada, sin distracciones, tipografía premium y diseño moderno.",
      ads: "100% Libre de anuncios",
      ui: "Limpia, elegante, optimizada para la lectura",
      offline: "Sí, soporte offline completo",
      audio: "Voz natural premium con reproducción nativa",
      price: "100% Gratis (Sostenido por canales asociados)",
      easeOfUse: "Excelente (Curva de aprendizaje nula)",
      isWinner: true,
    },
    {
      name: "YouVersion",
      tagline: "La comunidad global y planes de lectura",
      focus: "Lectura social, planes devocionales y conexión con amigos.",
      ads: "Libre de anuncios (Financiado por donaciones)",
      ui: "Funcional, pero con exceso de pestañas y notificaciones",
      offline: "Sí, requiere descarga manual de versiones",
      audio: "Sí, narraciones variadas por versión",
      price: "100% Gratis",
      easeOfUse: "Buena (Puede resultar abrumadora)",
    },
    {
      name: "Bible Gateway",
      tagline: "La biblioteca de referencia clásica",
      focus: "Consulta rápida, búsquedas de palabras clave y versículos específicos.",
      ads: "Con publicidad molesta en versión gratis",
      ui: "Anticuada, saturada con anuncios e interfaces del 2010",
      offline: "Limitado en app móvil, ausente en web",
      audio: "Sí, básico con anuncios de audio",
      price: "Gratis con anuncios / Suscripción Plus de pago",
      easeOfUse: "Regular (La publicidad interrumpe)",
    },
    {
      name: "Logos Bible Software",
      tagline: "La herramienta académica profesional",
      focus: "Estudio teológico profundo, lenguajes originales (hebreo/griego).",
      ads: "Libre de anuncios",
      ui: "Extremadamente compleja, repleta de paneles científicos",
      offline: "Sí, pero requiere equipos con alta capacidad",
      audio: "De pago, enfocado en audio-libros académicos",
      price: "De pago (Paquetes desde $50 hasta más de $1,000)",
      easeOfUse: "Muy baja (Requiere capacitación técnica)",
    },
  ];

  return (
    <div className="grow bg-[#FAF9F5] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Force Light Theme Client Component */}
      <ForceLightTheme />

      {/* JSON-LD Structured Data for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "La Mejor App para Leer la Biblia en 2026",
            "image": "https://esdocu.com/images/veobible-mockup.png",
            "description": "Análisis comparativo de las mejores aplicaciones para leer la Biblia. Comparamos VeoBible, YouVersion, Bible Gateway y Logos.",
            "author": {
              "@type": "Person",
              "name": "Biblia Comparada"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Esdocu"
            }
          })
        }}
      />

      {/* JSON-LD Structured Data for Google FAQ Dropdowns in Search */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "¿Cuál es la mejor aplicación para leer la Biblia en 2026?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "VeoBible es la aplicación recomendada en 2026 para lectura diaria gracias a su interfaz minimalista, tipografía de alta legibilidad, soporte offline completo y por estar 100% libre de anuncios."
                }
              },
              {
                "@type": "Question",
                "name": "¿Qué aplicación bíblica no tiene anuncios publicitarios?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "VeoBible es 100% libre de publicidad. YouVersion también es libre de anuncios (sostenida por donaciones). Bible Gateway contiene publicidad en su versión gratuita."
                }
              },
              {
                "@type": "Question",
                "name": "¿Qué características debe tener una buena app para leer la Biblia?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Debe ofrecer una lectura libre de distracciones y anuncios, excelente legibilidad tipográfica (fuentes serif bien espaciadas), carga instantánea y funcionamiento completo sin conexión a internet (modo offline)."
                }
              }
            ]
          })
        }}
      />

      {/* Independent Header */}
      <header className="sticky top-0 z-50 bg-[#FAF9F5]/90 backdrop-blur-md border-b border-slate-200/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-amber-600" />
          <span className="font-display font-bold text-xl tracking-tight text-slate-900">
            Biblia<span className="text-amber-600 font-medium">Comparada</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Análisis Independiente 2026
          </span>
          <a
            href="#tabla-comparativa"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
            id="nav-compare-btn"
          >
            Ir a la Tabla
          </a>
        </div>
      </header>

      <main className="grow">
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 overflow-hidden px-6">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_50%,rgba(217,119,6,0.04)_0%,transparent_100%)]" />

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Hero Text */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/50">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Guía de Compra y Lectura 2026
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-slate-950 leading-tight">
                Mejor app para leer la <br className="hidden sm:inline" />
                <span className="bg-linear-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
                  Biblia en 2026
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Comparamos las plataformas bíblicas más utilizadas del mundo. Analizamos su legibilidad, facilidad de uso, publicidad y coste para ayudarte a encontrar la experiencia de lectura perfecta.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <a
                  href="#tabla-comparativa"
                  className="px-8 py-3.5 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-600/10 transition-all duration-300 inline-flex items-center gap-2 group"
                  id="hero-cta-compare"
                >
                  Ver Tabla Comparativa
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="https://veobible.com/es"
                  target="_blank"
                  className="px-8 py-3.5 text-base font-semibold rounded-full bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm inline-flex items-center"
                  id="hero-cta-details"
                >
                  Ir a VeoBible.com
                </a>
              </div>
            </div>

            {/* Hero Image / Mockup Showcase */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[340px] md:max-w-[380px] aspect-square lg:aspect-auto flex justify-center items-center">
                {/* Premium Glow effect */}
                <div className="absolute inset-0 bg-linear-to-tr from-amber-200/30 to-amber-100/20 blur-3xl rounded-full transform -translate-y-4 -z-10" />

                <div className="relative p-2.5 bg-white rounded-[40px] shadow-[0_24px_50px_rgba(0,0,0,0.06)] border border-slate-100 hover:shadow-[0_32px_64px_rgba(0,0,0,0.08)] transition-shadow duration-500">
                  <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-[#FAF9F5]">
                    <ExportedImage
                      src="/images/veobible-mockup.png"
                      alt="VeoBible App Mockup"
                      width={380}
                      height={380}
                      className="object-cover"
                      priority
                    />
                  </div>
                  {/* Floating Highlight Card */}
                  <div className="absolute -bottom-6 -left-6 bg-white py-3.5 px-4.5 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.06)] border border-amber-100/60 flex items-center gap-3 animate-bounce-slow">
                    <div className="p-2 rounded-xl bg-amber-50">
                      <Star className="h-5 w-5 text-amber-600 fill-amber-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-800 tracking-wider uppercase">Recomendada</p>
                      <p className="text-sm font-extrabold text-slate-900">VeoBible 100% Ads Free</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Comparison Table */}
        <section id="tabla-comparativa" className="py-20 bg-white border-y border-slate-200/60 px-6 scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight">
                Comparativa de las Mejores Apps Bíblicas
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Evaluamos los aspectos más importantes que definen la calidad de lectura de cada aplicación.
              </p>
            </div>

            <ComparisonTable />
          </div>
        </section>

        {/* Section 2: Detailed Reviews */}
        <section id="analisis-detalle" className="py-20 px-6 bg-[#FAF9F5] scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight">
                Análisis Detallado de Cada Aplicación
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Descubre los puntos fuertes y débiles de las opciones más populares para tomar una decisión informada.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* App 0: VeoBible */}
              <div className="bg-white p-8 rounded-2xl border border-amber-100 shadow-[0_10px_30px_rgba(217,119,6,0.03)] flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-linear-to-bl from-amber-200/20 to-transparent rounded-bl-full" />

                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold tracking-wider uppercase mb-2">
                        Ganadora Recomendada 2026
                      </span>
                      <h3 className="text-2xl font-bold text-slate-950">VeoBible</h3>
                      <p className="text-amber-600 text-sm font-semibold">veobible.com</p>
                    </div>
                    <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                      <Star className="h-6 w-6 fill-amber-500" />
                    </span>
                  </div>

                  <p className="text-slate-600 mb-6 leading-relaxed">
                    VeoBible nace con la misión de devolver el protagonismo al texto bíblico. Mientras que otras apps saturan la pantalla con notificaciones, anuncios y redes sociales, VeoBible ofrece una interfaz pulida y enfocada. Su tipografía ha sido seleccionada quirúrgicamente para evitar la fatiga ocular, y su sistema inteligente permite cambiar de capítulo y buscar versículos al instante.
                  </p>

                  <div className="space-y-3.5 mb-8">
                    <h4 className="font-bold text-slate-900 text-sm">¿Por qué destaca?</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Sin distracciones:</strong> Cero anuncios, banners ni ventanas emergentes.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Tipografía literaria:</strong> Experiencia de lectura fluida similar a la de un libro impreso.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Modo Offline Completo:</strong> Funciona a la perfección sin cobertura o internet.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">ENFOQUE: Lectura Diaria y Devoción</span>
                  <a
                    href="https://veobible.com/es"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-bold text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    Probar VeoBible
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* App 1: YouVersion */}
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.01)] flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold tracking-wider uppercase mb-2">
                        Segunda Opción
                      </span>
                      <h3 className="text-2xl font-bold text-slate-950">YouVersion</h3>
                      <p className="text-slate-400 text-sm">La app de la comunidad</p>
                    </div>
                    <span className="p-2.5 rounded-xl bg-slate-50 text-slate-500">
                      <Smartphone className="h-6 w-6" />
                    </span>
                  </div>

                  <p className="text-slate-600 mb-6 leading-relaxed">
                    Es la aplicación más descargada de la historia. Cuenta con una librería colosal de traducciones y es fantástica para seguir planes devocionales grupales e interactuar con amigos. Sin embargo, su interfaz se ha vuelto sumamente densa con los años: está repleta de recordatorios de rachas, avatares, fotos de versículos del día y notificaciones push que alejan al usuario de una lectura relajada.
                  </p>

                  <div className="space-y-3.5 mb-8">
                    <h4 className="font-bold text-slate-900 text-sm">Pros y Contras</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Es 100% gratis:</strong> No contiene pagos dentro de la aplicación.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <AlertCircle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>Mucha distracción visual:</strong> Difícil enfocarse debido a constantes estímulos sociales.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">ENFOQUE: Comunidad y Planes Sociales</span>
                </div>
              </div>

              {/* App 2: Bible Gateway */}
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.01)] flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold tracking-wider uppercase mb-2">
                        Referencia Rápida
                      </span>
                      <h3 className="text-2xl font-bold text-slate-950">Bible Gateway</h3>
                      <p className="text-slate-400 text-sm">Herramienta de consulta rápida</p>
                    </div>
                    <span className="p-2.5 rounded-xl bg-slate-50 text-slate-500">
                      <Search className="h-6 w-6" />
                    </span>
                  </div>

                  <p className="text-slate-600 mb-6 leading-relaxed">
                    La aplicación móvil mantiene el potente motor de búsqueda de su web original, siendo ideal para buscar palabras específicas o comparar traducciones en paralelo. Lamentablemente, la experiencia en la versión gratuita de la app se ve afectada por publicidad invasiva. Banners publicitarios permanentes en la parte inferior de la pantalla y frecuentes ventanas emergentes invitándote a pagar su suscripción Plus rompen constantemente la inmersión del tiempo devocional.
                  </p>

                  <div className="space-y-3.5 mb-8">
                    <h4 className="font-bold text-slate-900 text-sm">Pros y Contras</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Múltiples versiones:</strong> Excelente motor de búsqueda e indexación.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <X className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                        <span><strong>Publicidad molesta:</strong> Banners constantes y avisos de mejora (upselling).</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">ENFOQUE: Búsqueda y Versiones Paralelas</span>
                </div>
              </div>

              {/* App 3: Logos Bible */}
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.01)] flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold tracking-wider uppercase mb-2">
                        Uso Académico
                      </span>
                      <h3 className="text-2xl font-bold text-slate-950">Logos Bible Software</h3>
                      <p className="text-slate-400 text-sm">La biblioteca teológica digital</p>
                    </div>
                    <span className="p-2.5 rounded-xl bg-slate-50 text-slate-500">
                      <BookOpen className="h-6 w-6" />
                    </span>
                  </div>

                  <p className="text-slate-600 mb-6 leading-relaxed">
                    Es el software definitivo para teólogos, pastores y estudiantes serios de la Biblia. Su poder para cruzar datos en idiomas originales, analizar manuscritos y estudiar comentarios es inigualable. No obstante, es un sistema excesivamente pesado y complejo para el creyente que solo desea realizar su devocional diario antes de comenzar su jornada laboral, además de requerir una inversión económica sustancial.
                  </p>

                  <div className="space-y-3.5 mb-8">
                    <h4 className="font-bold text-slate-900 text-sm">Pros y Contras</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Poder analítico insuperable:</strong> Permite desglosar palabra por palabra el original griego.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <X className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                        <span><strong>Coste e Interfaz Compleja:</strong> Precios prohibitivos y requiere semanas de aprendizaje.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">ENFOQUE: Investigación Exegética</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Beneficios de una Biblia Digital */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              ¿Por qué usar una aplicación para leer la Biblia?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
                <div className="h-14 w-14 mx-auto bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <BookOpen className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Portabilidad Absoluta</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Lleva docenas de traducciones, comentarios bíblicos y diccionarios en tu bolsillo. Una aplicación te permite leer en el autobús, en la sala de espera o durante tu hora de almuerzo sin cargar libros pesados.
                </p>
              </div>
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
                <div className="h-14 w-14 mx-auto bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <Search className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Búsqueda Instantánea</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  ¿No recuerdas en qué libro está ese versículo que tienes en mente? Las apps bíblicas te permiten buscar palabras clave y encontrar pasajes específicos en fracciones de segundo, algo imposible en papel.
                </p>
              </div>
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
                <div className="h-14 w-14 mx-auto bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <BookMarked className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Organización Personal</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Resalta versículos con múltiples colores, añade notas y crea categorías sin temor a arruinar las páginas de tu Biblia. Todo tu estudio queda guardado de manera segura en la nube.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Versiones Populares */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Traducciones que no deben faltar en tu app
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600">
              <p className="text-center mb-10">
                Al elegir la <strong>mejor app para leer la Biblia</strong>, asegúrate de que incluya las versiones más confiables y utilizadas en el mundo hispanohablante.
              </p>
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="bg-amber-50 text-amber-700 font-bold px-4 py-2 rounded-xl text-lg whitespace-nowrap">RVR1960</div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 m-0 mb-1">Reina-Valera 1960</h4>
                    <p className="m-0 text-sm">La traducción clásica por excelencia. Es la más utilizada en las iglesias evangélicas de habla hispana, conocida por su lenguaje poético y reverente.</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="bg-amber-50 text-amber-700 font-bold px-4 py-2 rounded-xl text-lg whitespace-nowrap">NVI</div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 m-0 mb-1">Nueva Versión Internacional</h4>
                    <p className="m-0 text-sm">Una traducción contemporánea que equilibra la fidelidad a los textos originales con un lenguaje claro y comprensible para el lector moderno.</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="bg-amber-50 text-amber-700 font-bold px-4 py-2 rounded-xl text-lg whitespace-nowrap">NTV</div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 m-0 mb-1">Nueva Traducción Viviente</h4>
                    <p className="m-0 text-sm">Destaca por su legibilidad excepcional. Transmite el mensaje de los textos originales de una manera tan clara que parece haber sido escrita directamente en español.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Consejos para un hábito de lectura */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight">
                Cómo establecer un hábito de lectura exitoso
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Tener la mejor app instalada es solo el primer paso. Aquí tienes 3 consejos probados para mantener la consistencia en tu devocional diario.
              </p>
            </div>

            <div className="flex flex-col gap-8">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xl">1</div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Asigna un tiempo y lugar innegociables</h3>
                  <p className="text-slate-600 leading-relaxed">Ya sea por la mañana junto a tu café o antes de dormir, vincula tu lectura a un hábito existente. La consistencia en el horario y lugar programa a tu cerebro para esperar ese momento del día. Con el tiempo, verás que si un día te saltas la lectura, tu mente la reclamará naturalmente como hace con cualquier otro hábito sólido.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xl">2</div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Desactiva las notificaciones</h3>
                  <p className="text-slate-600 leading-relaxed">Cuando abras tu aplicación de lectura, activa el modo "No molestar" en tu teléfono. La lectura profunda requiere foco; una notificación de WhatsApp puede arruinar 15 minutos de concentración.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xl">3</div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Comienza con un plan de lectura pequeño</h3>
                  <p className="text-slate-600 leading-relaxed">No intentes leer toda la Biblia en 30 días si nunca has mantenido el hábito. Empieza leyendo un capítulo de los Proverbios o del Evangelio de Juan cada día. Proverbios tiene 31 capítulos, uno por cada día del mes, y cada uno es breve y lleno de sabiduría aplicable. La constancia de cinco minutos diarios es infinitamente más valiosa que una sesión de dos horas que solo haces una vez por semana.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Buyer's Guide */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              ¿Cómo elegir la app perfecta para leer la Biblia?
            </h2>

            <div className="space-y-10">
              <div className="flex gap-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 h-12 w-12 shrink-0 flex items-center justify-center">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">1. Cero publicidad para una mayor devoción</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Las interrupciones visuales en forma de anuncios rompen el ambiente de oración y lectura reflexiva. Cada vez que aparece un banner parpadeante tu cerebro interrumpe el estado de contemplación y vuelve al modo de alerta. Es preferible optar por aplicaciones totalmente limpias o suscripciones económicas para garantizar la paz visual en tu tiempo de intimidad con las Escrituras.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 h-12 w-12 shrink-0 flex items-center justify-center">
                  <Heart className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">2. Legibilidad y tipografía cuidada</h3>
                  <p className="text-slate-600 leading-relaxed">
                    La Biblia contiene textos extensos con pasajes poéticos como los Salmos y narrativas largas como los Evangelios. Un diseño con tipografía serif fluida, interlineado amplio (al menos 1.6) y fondos amables como el color crema o sepia disminuyen notablemente el cansancio ocular frente a pantallas brillantes. Cuando la lectura no duele, lees más y mejor.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 h-12 w-12 shrink-0 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">3. Enfoque personal vs. Enfoque social</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Pregúntate si buscas interactuar con otros lectores compartiendo pasajes (YouVersion) o si valoras un rincón privado de meditación personal sin la sensación de estar en una red social más (VeoBible).
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 h-12 w-12 shrink-0 flex items-center justify-center">
                  <Volume2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">4. Rendimiento rápido y modo offline</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Asegúrate de que la app cargue de inmediato y tenga soporte sin conexión a internet. Una aplicación rápida te invita a leer más en cualquier pequeño momento libre de tu día a día.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: Funciones Clave de la App Ganadora */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              ¿Qué hace a VeoBible la mejor app de la Biblia sin internet?
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600">
              <p>
                Al evaluar la <strong>mejor app para leer la Biblia</strong>, no solo nos fijamos en la lectura básica. Las aplicaciones modernas deben ofrecer herramientas que faciliten el estudio diario sin distracciones. VeoBible destaca especialmente porque funciona como una PWA (Progressive Web App) instalable que ofrece:
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 list-none pl-0 mt-8">
                <li className="bg-[#FAF9F5] p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 mt-0 mb-3">
                    <Smartphone className="h-5 w-5 text-amber-600" />
                    Sincronización en la Nube
                  </h4>
                  <p className="m-0 text-sm">Empieza a leer en tu teléfono móvil y continúa en tu computadora de escritorio. Tus marcadores y el progreso de lectura se sincronizan automáticamente entre todos tus dispositivos.</p>
                </li>
                <li className="bg-[#FAF9F5] p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 mt-0 mb-3">
                    <BookMarked className="h-5 w-5 text-amber-600" />
                    Marcadores y Notas Pro
                  </h4>
                  <p className="m-0 text-sm">Un sistema avanzado que te permite guardar tus versículos favoritos, añadir notas personales y organizar tus estudios por categorías y colores personalizados.</p>
                </li>
                <li className="bg-[#FAF9F5] p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 mt-0 mb-3">
                    <Volume2 className="h-5 w-5 text-amber-600" />
                    Audio Biblia Integrada
                  </h4>
                  <p className="m-0 text-sm">Ideal para tus trayectos diarios o momentos de devocional auditivo. Escucha la Biblia con voces naturales, sin voces robóticas ni cortes incómodos.</p>
                </li>
                <li className="bg-[#FAF9F5] p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 mt-0 mb-3">
                    <Shield className="h-5 w-5 text-amber-600" />
                    100% Offline (Sin Internet)
                  </h4>
                  <p className="m-0 text-sm">Descarga tus versiones preferidas y accede a ellas en cualquier momento. La mejor app bíblica sin publicidad que además no consume tus datos móviles.</p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 8: Por qué la lectura bíblica digital es el futuro */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight">
                La lectura bíblica en la era digital: qué ha cambiado
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Las aplicaciones no reemplazan al libro físico, pero han ampliado el acceso a las Escrituras de una manera que ningún formato anterior pudo lograr.
              </p>
            </div>

            <div className="space-y-8 text-slate-600 leading-relaxed">
              <p>
                Hace apenas dos décadas, llevar varias traducciones de la Biblia, un diccionario griego-hebreo y un comentario bíblico requería una bolsa de libros que pesaba varios kilogramos. Hoy, toda esa biblioteca cabe en el bolsillo de tu pantalón. Esta democratización del acceso a las Escrituras ha tenido un impacto enorme en la forma en que millones de personas en todo el mundo estudian y meditan la Palabra de Dios.
              </p>
              <p>
                Según estadísticas de la industria editorial bíblica, el tiempo promedio que un lector dedica a la Biblia digital es <strong>mayor que el tiempo que dedica a la Biblia impresa</strong>, especialmente en grupos de edad entre 18 y 35 años. Esto se explica porque la app siempre está disponible: no necesitas recordar dónde dejaste el libro ni tener buena iluminación. En cualquier momento de pausa —esperando en una fila, en el transporte o durante el descanso del trabajo— puedes abrir la app y leer aunque sea un versículo.
              </p>
              <p>
                Sin embargo, no todas las apps aprovechan este potencial de la misma forma. Muchas han caído en la trampa de convertirse en redes sociales bíblicas: feeds de versículos, likes, racha de días seguidos y notificaciones constantes que, paradójicamente, generan más ansiedad y distracción que paz espiritual. La <strong>mejor app para leer la Biblia</strong> en 2026 es aquella que entiende que su único trabajo es desaparecer y dejar que el texto hable por sí mismo.
              </p>
              <div className="bg-amber-50 border-l-4 border-amber-400 p-6 rounded-r-2xl">
                <p className="text-amber-900 font-medium m-0">
                  &ldquo;La tecnología más poderosa es aquella que se vuelve invisible. La mejor app de la Biblia es la que no notas que estás usando.&rdquo;
                </p>
              </div>
              <p>
                Es en este contexto donde VeoBible marca una diferencia notable. Su filosofía de diseño prioriza el texto sobre cualquier elemento de interfaz. Los botones son mínimos, la navegación es intuitiva y el fondo crema reduce la luz azul de la pantalla, haciendo que leer de noche sea menos invasivo. En un mercado saturado de apps que compiten por tu atención, VeoBible compite por darte <em>paz</em>.
              </p>
            </div>
          </div>
        </section>

        {/* Section 9: Preguntas Frecuentes ampliadas */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Preguntas frecuentes sobre apps para leer la Biblia
            </h2>

            <div className="space-y-6">
              <details className="group bg-[#FAF9F5] border border-slate-200 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Cuál es la mejor app para leer la Biblia en español en 2026?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  VeoBible es la opción más recomendada para la lectura diaria en español en 2026. Ofrece la Reina-Valera 1960, la NVI y otras traducciones populares en un formato de lectura limpio y sin publicidad. Su modo offline y su sincronización entre dispositivos la convierten en la solución más completa y cómoda del mercado hispanohablante.
                </div>
              </details>

              <details className="group bg-[#FAF9F5] border border-slate-200 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Se puede leer la Biblia en el celular sin internet?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Sí. Varias aplicaciones permiten descargar las traducciones para usarlas completamente offline. VeoBible, al funcionar como una PWA (Progressive Web App), se instala directamente desde el navegador y almacena el contenido en el dispositivo para que funcione sin necesidad de conexión a internet. Esto es ideal si vas a viajes, zonas con cobertura limitada o quieres ahorrar datos móviles.
                </div>
              </details>

              <details className="group bg-[#FAF9F5] border border-slate-200 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Qué diferencia hay entre una app de la Biblia y una página web?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Las páginas web tradicionales requieren conexión constante y no se adaptan tan bien a la lectura prolongada en móvil. Una aplicación (especialmente una PWA como VeoBible) se instala en tu pantalla de inicio, funciona offline, guarda tu progreso localmente y tiene una interfaz optimizada para pantallas táctiles. La experiencia es notablemente más fluida y cómoda que una página web genérica.
                </div>
              </details>

              <details className="group bg-[#FAF9F5] border border-slate-200 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Cuántas traducciones debería tener una buena app bíblica?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Para el lector promedio, con 3 o 4 traducciones bien seleccionadas es más que suficiente. La clave no está en la cantidad sino en la calidad. Te recomendamos tener siempre disponible una versión de estudio (RVR1960), una de lectura fluida (NTV) y una de referencia académica (NVI). Tener decenas de versiones raramente usadas complica la navegación innecesariamente.
                </div>
              </details>

              <details className="group bg-[#FAF9F5] border border-slate-200 rounded-2xl overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Es mejor una app gratuita o de pago para leer la Biblia?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Depende de lo que necesites. Para la lectura devocional diaria, una aplicación gratuita de calidad como VeoBible es completamente suficiente. Las aplicaciones de pago como Logos Bible Software están justificadas únicamente para teólogos, pastores o estudiantes que necesitan herramientas de estudio avanzado como análisis griego del Nuevo Testamento o acceso a comentarios académicos especializados.
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* Section 10: Final Call to Action */}
        <section className="py-20 px-6 bg-linear-to-b from-white to-amber-50/20 text-center relative overflow-hidden border-t border-slate-200/50">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_100%,rgba(217,119,6,0.05)_0%,transparent_100%)]" />

          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-display font-extrabold text-slate-950 tracking-tight">
              ¿Listo para una mejor experiencia de lectura?
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed">
              Te recomendamos iniciar hoy mismo con <strong className="font-bold text-slate-900">VeoBible</strong>. Descubre cómo el diseño minimalista y libre de publicidad puede transformar tu hábito de lectura bíblica diario en 2026.
            </p>
            <div className="pt-4">
              <a
                href="https://veobible.com/es"
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-4 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-xl hover:shadow-amber-600/10 transition-all duration-300 inline-flex items-center gap-2 group"
                id="footer-cta-veobible"
              >
                Visitar VeoBible.com
                <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
            <div className="pt-2 text-xs text-slate-400 font-medium">
              Disponible para múltiples dispositivos • Sin registros obligatorios
            </div>
          </div>
        </section>
      </main>

      {/* Independent Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-amber-600" />
            <span className="font-display font-bold text-lg tracking-tight text-slate-900">
              Biblia<span className="text-amber-600 font-medium">Comparada</span>
            </span>
          </div>
          <p className="text-slate-400 text-xs text-center md:text-left">
            © {new Date().getFullYear()} Biblia Comparada. Todos los derechos reservados. Análisis independiente no afiliado.
          </p>
        </div>
      </footer>
    </div>
  );
}
