import ExportedImage from "next-image-export-optimizer";
import { Check, BookOpen, Clock, Heart, Volume2, Search, ArrowRight, BookMarked, Sparkles, Book, FileText, History, Star } from "lucide-react";
import { ForceLightTheme } from "../mejor-pagina-para-leer-la-biblia/force-light-theme";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Biblia Reina Valera Online: Dónde Leerla Gratis en 2026",
  description: "Descubre la mejor plataforma para leer la Biblia Reina Valera 1960 online gratis. Sin anuncios, con buscador avanzado y diseño elegante.",
  openGraph: {
    title: "Biblia Reina Valera Online Gratis - Guía 2026",
    description: "Lee la versión más querida por los hispanohablantes (Reina Valera 1960) online, sin distracciones y completamente gratis.",
    type: "website",
    url: "/biblia-reina-valera-online",
  },
};

export default function BibliaReinaValeraPage() {
  return (
    <div className="grow bg-[#FAF9F5] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      <ForceLightTheme />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Biblia Reina Valera Online: Guía 2026",
            "image": "https://esdocu.com/images/veobible-mockup.png",
            "description": "Descubre la mejor plataforma para leer la Biblia Reina Valera 1960 online gratis en español.",
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

      <header className="sticky top-0 z-50 bg-[#FAF9F5]/90 backdrop-blur-md border-b border-slate-200/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-amber-600" />
          <span className="font-display font-bold text-xl tracking-tight text-slate-900">
            Biblia<span className="text-amber-600 font-medium">Comparada</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Guía de Versiones 2026
          </span>
          <a
            href="https://veobible.com/es"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            Leer Ahora
          </a>
        </div>
      </header>

      <main className="grow">
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 overflow-hidden px-6">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_50%,rgba(217,119,6,0.04)_0%,transparent_100%)]" />

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/50">
                <Book className="h-3.5 w-3.5" />
                La Versión Clásica
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-slate-950 leading-tight">
                Lee la Biblia <br className="hidden sm:inline" />
                <span className="bg-linear-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
                  Reina Valera Online
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                La Reina Valera 1960 (RVR1960) es la traducción más amada por el pueblo cristiano hispanohablante. Te mostramos el mejor sitio para estudiarla y leerla gratis en internet, libre de distracciones.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <a
                  href="#guia-completa"
                  className="px-8 py-3.5 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-600/10 transition-all duration-300 inline-flex items-center gap-2 group"
                >
                  Conocer Más
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[340px] md:max-w-[380px] aspect-square lg:aspect-auto flex justify-center items-center">
                <div className="absolute inset-0 bg-linear-to-tr from-amber-200/30 to-amber-100/20 blur-3xl rounded-full transform -translate-y-4 -z-10" />

                <div className="relative p-2.5 bg-white rounded-[40px] shadow-[0_24px_50px_rgba(0,0,0,0.06)] border border-slate-100 hover:shadow-[0_32px_64px_rgba(0,0,0,0.08)] transition-shadow duration-500">
                  <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-[#FAF9F5]">
                    <ExportedImage
                      src="/images/veobible-mockup.png"
                      alt="Biblia Reina Valera"
                      width={380}
                      height={380}
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="absolute -bottom-6 -left-6 bg-white py-3.5 px-4.5 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.06)] border border-amber-100/60 flex items-center gap-3 animate-bounce-slow">
                    <div className="p-2 rounded-xl bg-amber-50">
                      <FileText className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-800 tracking-wider uppercase">Texto Clásico</p>
                      <p className="text-sm font-extrabold text-slate-900">RVR 1960 Incluida</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content Section */}
        <section id="guia-completa" className="py-20 bg-white border-y border-slate-200/60 px-6 scroll-mt-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              El tesoro literario y espiritual del mundo hispano
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-16">
              <p>
                A lo largo de los más de 400 años de historia cristiana en el mundo de habla hispana, ninguna traducción ha dejado una huella tan profunda, imborrable y generalizada como la <strong>Biblia Reina Valera</strong>. Desde los púlpitos de gigantescas catedrales hasta los devocionales familiares en pequeñas salas de estar, esta versión ha sido el medio a través del cual millones han escuchado la voz de Dios.
              </p>
              <p>
                Aunque en las últimas décadas han surgido docenas de traducciones modernas y excelentes, buscar leer la <strong>Biblia Reina Valera online</strong> sigue siendo la opción preferida por la inmensa mayoría. Su lenguaje majestuoso, que muchos comparan con el "español de oro" de Cervantes, y la profunda familiaridad que evoca, la convierten en un pilar insustituible.
              </p>
              <p>
                No obstante, la lectura de un texto clásico y profundo requiere de un entorno adecuado. Sumergirse en la prosa poética de los Salmos o en la densa teología de las cartas paulinas de la Reina Valera requiere concentración absoluta. Hacerlo en páginas web inundadas de publicidad, colores chillones o barras de herramientas confusas arruina por completo la experiencia. Por eso, elegir la plataforma correcta para tu lectura es casi tan importante como la traducción misma.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Historia */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Breve Historia: ¿De dónde surge la Reina Valera?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
              <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
                <p>
                  El nombre "Reina-Valera" no hace referencia a un rey ni a una región, sino a dos valientes monjes jerónimos españoles del siglo XVI que arriesgaron sus vidas para traducir las Escrituras desde sus idiomas originales (hebreo, arameo y griego) al castellano.
                </p>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 my-4">
                  <h4 className="font-bold text-slate-900 mb-1">Casiodoro de Reina (1569)</h4>
                  <p className="text-sm text-slate-600">Publicó la primera traducción completa de la Biblia al español, conocida como la <em>Biblia del Oso</em> debido a la ilustración de un oso comiendo miel en su portada.</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 my-4">
                  <h4 className="font-bold text-slate-900 mb-1">Cipriano de Valera (1602)</h4>
                  <p className="text-sm text-slate-600">Amigo y compañero de Casiodoro, dedicó veinte años de su vida a revisar y perfeccionar la traducción original. A esta revisión se le conoció como la <em>Biblia del Cántaro</em>.</p>
                </div>
              </div>
              <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
                <p>
                  A lo largo de los siglos, el idioma español fue evolucionando. Por ello, las Sociedades Bíblicas Unidas realizaron diversas revisiones para actualizar la ortografía y el vocabulario. Las más famosas fueron las revisiones de 1909, 1960, 1995 y 2011.
                </p>
                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm relative overflow-hidden">
                  <div className="absolute -bottom-10 -right-10 text-amber-100">
                    <History className="w-40 h-40" />
                  </div>
                  <h3 className="text-xl font-bold text-amber-900 mb-3 relative z-10">El fenómeno de 1960</h3>
                  <p className="text-amber-800 text-sm relative z-10">
                    De todas las revisiones, la <strong>Reina Valera 1960 (RVR1960)</strong> fue la que logró el equilibrio perfecto. Mantuvo la sonoridad clásica y la reverencia del texto antiguo, pero eliminó arcaísmos incomprensibles para el lector del siglo XX. Hoy en día, cuando alguien dice "Reina Valera", en el 90% de los casos se refiere a la revisión de 1960.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Por qué sigue siendo la reina */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight mb-8">
              ¿Por qué la Reina Valera sigue siendo la favorita?
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-12">
              <p>
                En una época donde existen traducciones como la Nueva Versión Internacional (NVI) o la Nueva Traducción Viviente (NTV) que utilizan un lenguaje de la calle, mucho más directo y contemporáneo, muchos se preguntan por qué la iglesia sigue aferrada a una versión de 1960.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm h-fit">
                  <Volume2 className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Majestuosidad Poética</h4>
                  <p className="text-sm text-slate-600">
                    Ninguna otra traducción captura la poesía rítmica de los Salmos o el tono solemne de los profetas mayores como la Reina Valera. Leer el Salmo 23 en RVR1960 sigue generando un impacto emocional único.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm h-fit">
                  <BookOpen className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Memorización Unificada</h4>
                  <p className="text-sm text-slate-600">
                    El 99% de los coros evangélicos, himnos tradicionales y textos memorizados desde la escuela dominical provienen de esta versión. Es el "lenguaje común" de la iglesia hispana.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm h-fit">
                  <BookMarked className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Concordancia Perfecta</h4>
                  <p className="text-sm text-slate-600">
                    Al ser una traducción de <em>equivalencia formal</em> (palabra por palabra), es excelente para estudiar teología y utilizar diccionarios bíblicos (como Strong) para analizar la raíz original hebrea o griega de un término.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm h-fit">
                  <History className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Liturgia y Respeto</h4>
                  <p className="text-sm text-slate-600">
                    El uso de palabras como "vosotros" o la conjugación verbal antigua transmite un sentido de reverencia que diferencia el texto sagrado del lenguaje que usamos coloquialmente en el supermercado.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Nuestra Recomendación */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-display font-extrabold text-slate-900 mb-10 text-center">
              Nuestra Recomendación: VeoBible
            </h3>
            <div className="bg-white p-8 md:p-12 rounded-3xl border border-amber-100 shadow-xl">
              <div className="flex flex-col md:flex-row gap-10 items-start">
                <div className="grow space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold tracking-wider uppercase">
                      El Lector Web Ideal
                    </span>
                    <div className="flex text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                  </div>
                  <h4 className="text-4xl font-extrabold text-slate-950">VeoBible</h4>
                  <p className="text-slate-600 text-lg leading-relaxed">
                    Si buscas leer la <strong>Biblia Reina Valera online gratis</strong>, VeoBible es la elección indiscutible en 2026. Ha sido diseñada con un profundo respeto por la estética clásica: la tipografía, el interlineado y el color del fondo recrean la sensación de abrir una pesada y majestuosa Biblia impresa de estudio.
                  </p>
                  
                  <ul className="space-y-4 mt-6">
                    <li className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Buscador Ultrarrápido:</strong> ¿Recuerdas que la Reina Valera usa "vosotros"? Encontrar el versículo exacto es instantáneo con su motor optimizado, superando ampliamente a las páginas web antiguas.</span>
                    </li>
                    <li className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Cero Publicidad:</strong> La prosa de la Reina Valera exige atención. En VeoBible no hay videos reproduciéndose solos ni banners de seguros de vida interrumpiendo las cartas del Apóstol Pablo.</span>
                    </li>
                    <li className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Tipografía Serif Clásica:</strong> Experimenta una lectura que honra la solemnidad de esta histórica traducción con fuentes específicamente diseñadas para lectura prolongada.</span>
                    </li>
                  </ul>
                  
                  <div className="pt-8 text-center sm:text-left">
                    <a
                      href="https://veobible.com/es"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg transition-all shadow-sm gap-2 w-full sm:w-auto"
                    >
                      Leer RVR1960 Gratis Ahora
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Consejos para estudiar la Reina Valera */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Consejos para estudiar la Reina Valera en Internet
            </h2>
            
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-12 text-center">
              <p>
                La riqueza de esta traducción también trae consigo ciertos retos para el lector del siglo XXI. El vocabulario castellano ha cambiado mucho desde 1960 (y más aún desde 1569). Aquí tienes algunas claves prácticas para sacarle el máximo provecho a tu lectura online.
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl shrink-0 shadow-sm border border-amber-100">1</div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">Ten a mano un diccionario de arcaísmos</h4>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    Palabras como <em>"concupiscencia"</em> (deseos carnales pecaminosos), <em>"propiciación"</em> (apaciguar la ira divina a través de un sacrificio) o <em>"longanimidad"</em> (paciencia extrema frente a la adversidad) son comunes en la RVR1960. Leer en la computadora te permite abrir rápidamente una nueva pestaña en el navegador y buscar su significado exacto para no perder el contexto doctrinal.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl shrink-0 shadow-sm border border-amber-100">2</div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">Léela en voz alta</h4>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    La traducción original fue diseñada, ante todo, para ser proclamada en asambleas públicas. Su puntuación y elección de palabras tiene una musicalidad y una cadencia únicas. Si estás leyendo en la pantalla y te topas con un pasaje de Isaías o un Salmo que parece complejo, inténtalo leer en voz alta; notarás cómo las frases comienzan a tener un sentido rítmico.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl shrink-0 shadow-sm border border-amber-100">3</div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">Compara con una versión paralela</h4>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    Los teólogos siempre recomiendan tener la Reina Valera como tu "Biblia base" para memorizar y estudiar, pero al usar plataformas online, tienes la gigantesca ventaja de poder abrir una versión moderna (como la NVI o NTV) para aclarar dudas inmediatas si el lenguaje clásico te resulta impenetrable en algún versículo del Antiguo Testamento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: FAQs */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Preguntas Frecuentes sobre la Reina Valera
            </h2>

            <div className="space-y-6">
              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Por qué veo tantas revisiones: 1909, 1960, 1995? ¿Cuál leo?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  El idioma evoluciona rápidamente. La de 1909 suena muy arcaica hoy. La de 1995 modernizó palabras (como cambiar "vosotros" a "ustedes" en algunas regiones), pero no logró la misma adopción universal. La <strong>RVR1960</strong> es el estándar absoluto, el punto medio perfecto entre reverencia clásica e inteligibilidad moderna.
                </div>
              </details>

              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Es la Reina Valera la "única traducción válida"?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  No. Es una postura extremista (conocida como el movimiento "Sólo Reina Valera") creer que es la única versión inspirada en español, similar al movimiento "King James Only" en inglés. Los textos inspirados son los originales en griego y hebreo. Sin embargo, la RVR1960 es indudablemente una traducción excepcionalmente fiel, bella y autoritativa.
                </div>
              </details>

              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Por qué faltan algunos libros en esta Biblia comparada con la católica?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  La Reina Valera actual contiene los 66 libros del canon protestante tradicional (hebreo para el Antiguo Testamento y griego para el Nuevo). Casiodoro de Reina originalmente sí incluyó los libros apócrifos o deuterocanónicos en 1569, tal como era la costumbre en su época, pero fueron removidos de las ediciones de las Sociedades Bíblicas a partir del siglo XIX para ajustarse estrictamente al canon rabínico del Antiguo Testamento.
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* Section 5: Final Call to Action */}
        <section className="py-20 px-6 bg-linear-to-b from-[#FAF9F5] to-amber-50/20 text-center relative overflow-hidden border-t border-slate-200/50">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_100%,rgba(217,119,6,0.05)_0%,transparent_100%)]" />

          <div className="max-w-3xl mx-auto space-y-6">
            <h2 className="text-3xl md:text-4xl font-display font-extrabold text-slate-950 tracking-tight">
              Regresa a las Escrituras Clásicas
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed">
              Experimenta la belleza de la traducción <strong>Reina Valera</strong> en la mejor plataforma web de 2026. <strong className="font-bold text-slate-900">VeoBible</strong> está lista para ti.
            </p>
            <div className="pt-4">
              <a
                href="https://veobible.com/es"
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-4 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-xl hover:shadow-amber-600/10 transition-all duration-300 inline-flex items-center gap-2 group"
              >
                Ir a VeoBible.com
                <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </section>
      </main>

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
