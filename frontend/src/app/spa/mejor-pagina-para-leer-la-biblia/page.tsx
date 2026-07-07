import ExportedImage from "next-image-export-optimizer";
import { Check, X, Star, Globe, Shield, BookOpen, Clock, Heart, Volume2, Search, ArrowRight, BookMarked, Sparkles, AlertCircle, Smartphone } from "lucide-react";
import { ForceLightTheme } from "./force-light-theme";
import { ComparisonTable } from "./comparison-table";
import type { Metadata } from "next";

// SEO Metadata for the landing page
export const metadata: Metadata = {
  title: "Mejor página para leer la Biblia en 2026 - Comparativa",
  description: "Descubre cuál es la mejor página web para leer y estudiar la Biblia este año. Análisis completo de VeoBible, YouVersion, Bible Gateway y Bible Hub.",
  openGraph: {
    title: "Mejor página para leer la Biblia en 2026 - Comparativa Completa",
    description: "Comparamos las mejores web bíblicas: VeoBible, YouVersion, Bible Gateway y Bible Hub. Encuentra el sitio ideal para tu lectura diaria sin distracciones.",
    type: "website",
    url: "/mejor-pagina-para-leer-la-biblia",
  },
};

interface AppDetails {
  name: string;
  tagline: string;
  focus: string;
  ads: string;
  ui: string;
  studyTools: string;
  audio: string;
  price: string;
  easeOfUse: string;
  isWinner?: boolean;
}

export default function BibleWebLandingPage() {
  const apps: AppDetails[] = [
    {
      name: "VeoBible",
      tagline: "El nuevo estándar de lectura minimalista",
      focus: "Lectura enfocada, sin distracciones, tipografía premium y diseño moderno.",
      ads: "100% Libre de anuncios",
      ui: "Limpia, elegante, optimizada para la lectura en cualquier pantalla",
      studyTools: "Básicas (Enfoque en lectura fluida y referencias)",
      audio: "Voz natural premium con reproducción en YouTube",
      price: "100% Gratis (Sostenido por canales asociados)",
      easeOfUse: "Excelente (Curva de aprendizaje nula)",
      isWinner: true,
    },
    {
      name: "YouVersion",
      tagline: "La comunidad global y planes de lectura",
      focus: "Lectura social, planes devocionales y conexión con amigos.",
      ads: "Libre de anuncios (Financiado por donaciones)",
      ui: "Moderna, pero con exceso de planes y menús",
      studyTools: "Moderadas (Planes devocionales, notas y marcadores)",
      audio: "Sí, narraciones de audio integradas por capítulo",
      price: "100% Gratis",
      easeOfUse: "Buena (Navegación limpia)",
    },
    {
      name: "Bible Gateway",
      tagline: "La biblioteca de referencia clásica",
      focus: "Consulta rápida y búsqueda de textos paralelos.",
      ads: "Con publicidad molesta y banners",
      ui: "Anticuada, ruidosa y con banners de anuncios",
      studyTools: "Buenas (Buscador avanzado y diccionarios básicos)",
      audio: "Sí, pero interrumpido por publicidad",
      price: "Gratis con anuncios / Opción Plus de pago",
      easeOfUse: "Regular (La publicidad interrumpe la lectura)",
    },
    {
      name: "Bible Hub",
      tagline: "La herramienta exegética profunda",
      focus: "Estudio exegético profundo, concordancia y comentarios.",
      ads: "Publicidad invasiva",
      ui: "Muy anticuada (diseño 2005) y sobrecargada",
      studyTools: "Excelentes (Interlineal hebreo/griego, léxicos y comentarios)",
      audio: "Sí, reproducción de audio básica por capítulo",
      price: "100% Gratis (Sostenido por anuncios)",
      easeOfUse: "Baja (Muy saturada de enlaces y tablas)",
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
            "headline": "Mejor página para leer la Biblia en 2026",
            "image": "https://esdocu.com/images/veobible-mockup.png",
            "description": "Análisis comparativo de las mejores páginas web para leer la Biblia. Comparamos VeoBible, YouVersion, Bible Gateway y Bible Hub.",
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
                "name": "¿Cuál es la mejor página web para leer la Biblia en 2026?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "VeoBible es la página web recomendada en 2026 para lectura diaria gracias a su interfaz minimalista, tipografía de alta legibilidad y por estar 100% libre de anuncios."
                }
              },
              {
                "@type": "Question",
                "name": "¿Qué página bíblica no tiene anuncios publicitarios?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "VeoBible es 100% libre de publicidad. YouVersion también es libre de anuncios (sostenida por donaciones). Bible Gateway y Bible Hub contienen publicidad molesta o invasiva en sus versiones gratuitas."
                }
              },
              {
                "@type": "Question",
                "name": "¿Qué características debe tener una buena página para leer la Biblia?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Debe ofrecer una lectura libre de distracciones y anuncios, excelente legibilidad tipográfica (fuentes serif bien espaciadas), carga instantánea y diseño limpio adaptado a todo tipo de pantallas."
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
                Mejor página para leer la{" "}
                <span className="bg-linear-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
                  Biblia en 2026
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Comparamos las páginas web bíblicas más utilizadas del mundo. Analizamos su legibilidad, facilidad de uso, publicidad y herramientas de estudio para ayudarte a encontrar la experiencia de lectura perfecta.
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
                      alt="VeoBible Mockup"
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
                Comparativa de las Mejores Páginas Bíblicas
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Evaluamos los aspectos más importantes que definen la calidad de lectura y estudio de cada página web.
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
                Análisis Detallado de Cada Página Web
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
                    VeoBible nace con la misión de devolver el protagonismo al texto bíblico en la web. Mientras que otras páginas saturan la pantalla con banners de publicidad, menús ruidosos y enlaces complejos, VeoBible ofrece una interfaz pulida y enfocada para navegadores. Su tipografía ha sido seleccionada quirúrgicamente para evitar la fatiga ocular y su navegación permite cambiar de libro y capítulo al instante.
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
                        <span><strong>Carga Instantánea:</strong> Diseñada sin scripts innecesarios para garantizar la rapidez.</span>
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
                      <p className="text-slate-400 text-sm">bible.com</p>
                    </div>
                    <span className="p-2.5 rounded-xl bg-slate-50 text-slate-500">
                      <Globe className="h-6 w-6" />
                    </span>
                  </div>

                  <p className="text-slate-600 mb-6 leading-relaxed">
                    La versión web de YouVersion (bible.com) es una de las más rápidas y populares. Es totalmente gratuita, no contiene anuncios y sincroniza perfectamente con su aplicación móvil. Sin embargo, su ecosistema web está fuertemente enfocado en la retención de usuarios: la página de inicio y la navegación constante te invitan a descargar la app móvil, iniciar planes de lectura estructurados, ganar insignias y conectar con la comunidad, lo cual puede generar ruido visual si tu único objetivo es abrir el navegador y leer el texto en paz.
                  </p>

                  <div className="space-y-3.5 mb-8">
                    <h4 className="font-bold text-slate-900 text-sm">Pros y Contras</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Gratuita y limpia:</strong> 100% gratis, con un lector de texto amplio y cómodo.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <AlertCircle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>Ecosistema ruidoso:</strong> Promoción constante de su app, planes e insignias sociales.</span>
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
                      <p className="text-slate-400 text-sm">biblegateway.com</p>
                    </div>
                    <span className="p-2.5 rounded-xl bg-slate-50 text-slate-500">
                      <Search className="h-6 w-6" />
                    </span>
                  </div>

                  <p className="text-slate-600 mb-6 leading-relaxed">
                    Un portal de referencia legendario en internet, ideal para buscar versículos clave o comparar rápidamente traducciones en paralelo. Lamentablemente, la versión web gratuita contiene una cantidad de publicidad en forma de banners parpadeantes y vídeos auto-reproducibles que interrumpen de forma constante la concentración, a menos que adquieras su plan de pago.
                  </p>

                  <div className="space-y-3.5 mb-8">
                    <h4 className="font-bold text-slate-900 text-sm">Pros y Contras</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Múltiples versiones:</strong> Excelente motor de búsqueda avanzada de textos.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <X className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                        <span><strong>Publicidad molesta:</strong> Banners que ensucian la experiencia estética y lectora.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">ENFOQUE: Búsqueda y Versiones Paralelas</span>
                </div>
              </div>

              {/* App 3: Bible Hub */}
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.01)] flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold tracking-wider uppercase mb-2">
                        Uso Académico
                      </span>
                      <h3 className="text-2xl font-bold text-slate-950">Bible Hub</h3>
                      <p className="text-slate-400 text-sm">biblehub.com</p>
                    </div>
                    <span className="p-2.5 rounded-xl bg-slate-50 text-slate-500">
                      <BookOpen className="h-6 w-6" />
                    </span>
                  </div>

                  <p className="text-slate-600 mb-6 leading-relaxed">
                    Es el recurso definitivo para el análisis exegético en la web. Permite desglosar palabra por palabra los textos bíblicos utilizando concordancias Strong, interlineales en hebreo y griego, léxicos y una inmensa colección de comentarios históricos gratis. Sin embargo, su interfaz web sigue anclada en el diseño del año 2005, resultando abrumadoramente compleja y repleta de tablas, además de estar financiada con anuncios invasivos.
                  </p>

                  <div className="space-y-3.5 mb-8">
                    <h4 className="font-bold text-slate-900 text-sm">Pros y Contras</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Herramientas exegéticas:</strong> Acceso inigualable a lenguajes originales y comentarios.</span>
                      </li>
                      <li className="flex items-start gap-2.5 text-sm text-slate-600">
                        <X className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
                        <span><strong>Interfaz obsoleta y anuncios:</strong> Muy sobrecargada, no apta para lectura devocional diaria.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase">ENFOQUE: Investigación Exegética y Estudio</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Ventajas del Navegador Web */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Ventajas únicas de leer la Biblia en el navegador web
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-12 text-center mx-auto">
              <p>
                Aunque las aplicaciones móviles son extremadamente populares, millones de personas prefieren acudir a una página web para su lectura o estudio bíblico diario. Estas son las razones fundamentales de por qué la web sigue siendo la plataforma reina.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm text-center hover:shadow-md transition-shadow">
                <div className="h-14 w-14 mx-auto bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <Globe className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Acceso Universal y Sin Instalación</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Cero descargas, cero actualizaciones y cero consumo de espacio de almacenamiento en tu disco duro. Puedes acceder desde la computadora de tu oficina en la hora de descanso, desde la laptop de un amigo, o desde una biblioteca pública, simplemente recordando una URL.
                </p>
              </div>
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm text-center hover:shadow-md transition-shadow">
                <div className="h-14 w-14 mx-auto bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <BookOpen className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Pestañas Múltiples para Estudio</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  El entorno de escritorio te permite tener cinco pestañas abiertas simultáneamente: una con el texto bíblico, otra con un mapa de los viajes de Pablo, otra con un comentario teológico y otra con tu procesador de textos para tomar apuntes. El navegador es el ecosistema de estudio definitivo.
                </p>
              </div>
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm text-center hover:shadow-md transition-shadow">
                <div className="h-14 w-14 mx-auto bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6">
                  <Shield className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-3">Privacidad y Control de Datos</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Muchas apps nativas exigen docenas de permisos en tu teléfono (ubicación, contactos, micrófono). En una página web, el navegador actúa como un escudo de seguridad, limitando drásticamente la información personal a la que pueden acceder los proveedores del servicio.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Herramientas de Estudio */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="w-full md:w-1/2 space-y-6">
                <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight">
                  Herramientas clave que una web de estudio bíblico debe tener
                </h2>
                <div className="prose prose-slate prose-lg text-slate-600">
                  <p>
                    Si vas a utilizar la computadora para profundizar más allá de la lectura devocional, asegúrate de que la página que elijas cuente con al menos algunas de estas funcionalidades críticas:
                  </p>
                  <ul className="space-y-4 text-base mt-6">
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-amber-100 p-1.5 rounded-full text-amber-700">
                        <Check className="h-4 w-4" />
                      </div>
                      <div>
                        <strong className="text-slate-900 block">Concordancia Integrada:</strong>
                        Permite hacer clic en cualquier palabra y ver cuántas veces y en qué contextos aparece en el resto de las Escrituras.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-amber-100 p-1.5 rounded-full text-amber-700">
                        <Check className="h-4 w-4" />
                      </div>
                      <div>
                        <strong className="text-slate-900 block">Texto Interlineal Griego/Hebreo:</strong>
                        Muestra el texto original debajo del texto en español, vinculando cada palabra al diccionario Strong para analizar su raíz etimológica exacta.
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1 bg-amber-100 p-1.5 rounded-full text-amber-700">
                        <Check className="h-4 w-4" />
                      </div>
                      <div>
                        <strong className="text-slate-900 block">Lectura Paralela:</strong>
                        La pantalla ancha del monitor es perfecta para colocar dos o tres traducciones (por ejemplo: RVR1960, NVI y NTV) una al lado de la otra y comparar cómo diferentes eruditos tradujeron un pasaje complejo.
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="w-full md:w-1/2 bg-white rounded-3xl p-8 border border-slate-100 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-bl from-amber-100/50 to-transparent rounded-bl-[100px]" />
                <h4 className="font-bold text-slate-900 text-lg mb-4 relative z-10">El equilibrio perfecto</h4>
                <p className="text-slate-600 text-sm leading-relaxed relative z-10 mb-4">
                  Es importante mencionar que la inmensa mayoría de creyentes no necesitan herramientas exegéticas complejas para su día a día. De hecho, el exceso de información académica puede llegar a "secar" la experiencia devocional, convirtiendo un encuentro espiritual en un ejercicio puramente intelectual.
                </p>
                <p className="text-slate-600 text-sm leading-relaxed relative z-10 font-medium italic">
                  "Para el 95% de tus lecturas, una página web limpia y sin distracciones como VeoBible será mucho más provechosa que una suite académica compleja."
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Cómo organizar tu estudio en la PC */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Guía práctica: Cómo organizar tu estudio bíblico en la computadora
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-md">1</div>
                <h3 className="text-xl font-bold text-slate-900">Configura tu espacio de pantalla</h3>
                <p className="text-slate-600 leading-relaxed">
                  Aprovecha el ancho de tu monitor. Usa la funcionalidad de "Pantalla dividida" (Split view) de tu sistema operativo. Coloca la página web de la Biblia (como VeoBible) ocupando el lado izquierdo de la pantalla, y una aplicación de notas (como Notion, Evernote o Microsoft Word) en el lado derecho. Esto elimina la necesidad de alternar constantemente entre ventanas, manteniendo tu enfoque intacto.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-md">2</div>
                <h3 className="text-xl font-bold text-slate-900">Usa los marcadores del navegador inteligentemente</h3>
                <p className="text-slate-600 leading-relaxed">
                  Crea una carpeta en la barra de marcadores (Bookmarks) de Chrome o Safari llamada "Devocional". Guarda allí accesos directos específicos no solo a la página principal, sino directamente al libro o capítulo que estás estudiando actualmente, además de enlaces directos a mapas bíblicos o diccionarios que consultes frecuentemente.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-md">3</div>
                <h3 className="text-xl font-bold text-slate-900">Instala la web como una aplicación (PWA)</h3>
                <p className="text-slate-600 leading-relaxed">
                  Páginas modernas como VeoBible están programadas como "Aplicaciones Web Progresivas". Si usas Google Chrome, busca el ícono de "Instalar" en la barra de direcciones superior derecha. Esto creará un ícono en tu escritorio que abrirá la Biblia en una ventana limpia, sin pestañas, barra de direcciones ni marcadores del navegador, brindando una experiencia inmersiva idéntica a un software nativo.
                </p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-md">4</div>
                <h3 className="text-xl font-bold text-slate-900">Habilita el modo lectura del navegador</h3>
                <p className="text-slate-600 leading-relaxed">
                  Si visitas páginas llenas de anuncios como Bible Gateway y no puedes pagar la versión premium, utiliza la extensión "Reader View" o el modo lectura nativo de navegadores como Safari o Firefox. Esto forzará al navegador a eliminar los banners publicitarios, las columnas laterales y los colores estridentes, presentándote únicamente el texto limpio.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Buyer's Guide */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              ¿Cómo elegir la página perfecta para leer la Biblia?
            </h2>

            <div className="space-y-10">
              <div className="flex gap-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 h-12 w-12 shrink-0 flex items-center justify-center">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">1. Cero publicidad para una mayor devoción</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Los banners parpadeantes y anuncios pop-up de las páginas gratuitas rompen por completo la atmósfera de recogimiento durante la lectura. En un entorno web, un clic accidental en un anuncio malicioso puede abrir pestañas no deseadas o descargar software peligroso. Prioriza páginas 100% limpias para mantener la paz visual y proteger tu computadora de distracciones y amenazas. La santidad del momento devocional no debería competir con ofertas de seguros o videos auto-reproducibles.
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
                    El texto de la Biblia es denso y requiere tiempo de asimilación. Un fondo con tonos crema o sepia suave en lugar de blanco deslumbrante, y una tipografía tipo Serif con buen espaciado entre líneas, disminuyen notablemente el cansancio ocular en pantallas grandes de laptops o monitores de escritorio. Las mejores plataformas web modernas aplican reglas de oro de la tipografía editorial, limitando el ancho de línea a unos 70 caracteres para que tus ojos no tengan que viajar demasiado de izquierda a derecha.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 h-12 w-12 shrink-0 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">3. Enfoque de lectura vs. Estudio académico</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Define tu meta antes de elegir: si buscas una lectura fluida de capítulos completos para meditar antes de empezar tu jornada de trabajo, busca simplicidad absoluta (VeoBible). Si por el contrario, estás preparando un sermón y necesitas desmenuzar las raíces etimológicas de las palabras en hebreo/griego o consultar docenas de comentarios teológicos reformados, utiliza herramientas académicas robustas (Bible Hub o Blue Letter Bible). Cada necesidad tiene su herramienta ideal.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 h-12 w-12 shrink-0 flex items-center justify-center">
                  <Volume2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950 mb-2">4. Rapidez y adaptabilidad móvil</h3>
                  <p className="text-slate-600 leading-relaxed">
                    Una página web moderna debe cargar al instante, incluso con conexiones de internet lentas, y verse excelente tanto en pantallas de escritorio grandes como en la pantalla vertical de tu celular, sin necesidad de descargar aplicaciones pesadas que consumen el almacenamiento de tu dispositivo. Las PWA (Aplicaciones Web Progresivas) representan el estándar de oro en este aspecto, ofreciendo lo mejor de ambos mundos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: Funciones Clave de la Página Ganadora */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              ¿Qué hace a VeoBible la mejor página para leer la Biblia?
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600">
              <p>
                Al evaluar la <strong>mejor página web para leer la Biblia</strong>, la experiencia de usuario es fundamental. Las plataformas modernas deben ser rápidas y adaptables. VeoBible destaca en la web porque está construida con tecnología de última generación que ofrece:
              </p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 list-none pl-0 mt-8">
                <li className="bg-[#FAF9F5] p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 mt-0 mb-3">
                    <Globe className="h-5 w-5 text-amber-600" />
                    Carga Ultra Rápida
                  </h4>
                  <p className="m-0 text-sm">Diseñada sin elementos pesados ni scripts innecesarios. Al cambiar de libro o capítulo, el texto se carga de manera instantánea, sin tiempos de espera molestos ni saltos repentinos en el diseño.</p>
                </li>
                <li className="bg-[#FAF9F5] p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 mt-0 mb-3">
                    <Smartphone className="h-5 w-5 text-amber-600" />
                    Diseño Adaptativo Web
                  </h4>
                  <p className="m-0 text-sm">No importa si estás en un monitor ultra ancho de 32 pulgadas o en la pantalla de un celular antiguo; la interfaz, los márgenes y el tamaño de letra se ajustan de manera automática para una lectura óptima.</p>
                </li>
                <li className="bg-[#FAF9F5] p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 mt-0 mb-3">
                    <BookMarked className="h-5 w-5 text-amber-600" />
                    Sincronización en la Nube
                  </h4>
                  <p className="m-0 text-sm">Crea tu cuenta segura en la página web y todos tus marcadores, notas y progreso de lectura estarán allí protegidos, sincronizados en tiempo real con la aplicación móvil en todos tus dispositivos.</p>
                </li>
                <li className="bg-[#FAF9F5] p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="flex items-center gap-2 font-bold text-slate-900 mt-0 mb-3">
                    <Shield className="h-5 w-5 text-amber-600" />
                    100% Libre de Banners
                  </h4>
                  <p className="m-0 text-sm">A diferencia de los grandes portales gratuitos tradicionales, VeoBible se compromete a no utilizar jamás banners laterales ni pop-ups intrusivos que ensucian la pantalla y perjudican tu tiempo de estudio.</p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 8: Preguntas Frecuentes Web */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Preguntas Frecuentes sobre leer la Biblia online
            </h2>

            <div className="space-y-6">
              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Es peligroso entrar a páginas gratuitas para leer la Biblia?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Las páginas más reconocidas (como VeoBible, YouVersion o Bible Gateway) son completamente seguras. El peligro radica en sitios web dudosos que prometen "descargar biblias completas gratis en PDF" y terminan inyectando malware a través de publicidad engañosa. Por regla general, nunca hagas clic en anuncios de botones de "Download" intermitentes. Es mucho más seguro leer online en plataformas limpias como VeoBible.
                </div>
              </details>

              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Necesito crear una cuenta para leer online?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  No obligatoriamente. La gran mayoría de páginas te permiten leer todo el texto bíblico y realizar búsquedas de manera anónima como invitado. Sin embargo, si deseas disfrutar de funcionalidades avanzadas como subrayar versículos, guardar notas de estudio, o mantener un historial de tu progreso de lectura en un plan anual, sí será necesario registrar un usuario (usualmente usando tu correo electrónico o cuenta de Google).
                </div>
              </details>

              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Por qué algunas páginas tienen la Biblia incompleta?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Esto suele deberse a cuestiones de derechos de autor (Copyright). Las traducciones modernas más populares (como la NVI, NTV o LBLA) no son de dominio público; pertenecen a sociedades bíblicas editoriales. Las páginas web deben pagar licencias costosas o llegar a acuerdos corporativos muy estrictos para poder mostrar esos textos completos en internet. Solo las traducciones muy antiguas (como la Reina-Valera antigua) son libres de derechos en todos los países.
                </div>
              </details>

              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Puedo escuchar la Biblia en audio desde una página web?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                  Sí, la tecnología web actual lo permite perfectamente. Plataformas como VeoBible incluyen integración directa para reproducir el audio del capítulo que estás leyendo. Esto es muy útil para tener la pestaña de fondo abierta mientras trabajas en otras aplicaciones de tu computadora, algo mucho más complejo de gestionar desde un teléfono celular.
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* Section 9: Final Call to Action */}
        <section className="py-20 px-6 bg-linear-to-b from-[#FAF9F5] to-amber-50/20 text-center relative overflow-hidden border-t border-slate-200/50">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_100%,rgba(217,119,6,0.05)_0%,transparent_100%)]" />

          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-display font-extrabold text-slate-950 tracking-tight">
              ¿Listo para una mejor experiencia de lectura web?
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed">
              Te recomendamos iniciar hoy mismo con <strong className="font-bold text-slate-900">VeoBible</strong>. Descubre cómo una interfaz web minimalista y completamente libre de anuncios puede enriquecer tu hábito diario en 2026.
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
              Acceso gratuito • Funciona en cualquier navegador de PC y móvil
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
