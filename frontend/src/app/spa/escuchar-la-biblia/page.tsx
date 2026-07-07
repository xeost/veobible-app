import ExportedImage from "next-image-export-optimizer";
import { Check, BookOpen, Clock, Heart, Volume2, Search, ArrowRight, BookMarked, Sparkles, Headphones, Smartphone, PlayCircle, Star, Mic, Ear, FastForward, BookText, Activity, Car, AlertCircle } from "lucide-react";
import { ForceLightTheme } from "../mejor-pagina-para-leer-la-biblia/force-light-theme";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Escuchar la Biblia en Audio Gratis: Mejor App 2026",
  description: "Descubre la mejor manera de escuchar la Biblia en audio gratis en español. Voces naturales, sin cortes publicitarios y disponible sin internet.",
  openGraph: {
    title: "Audio Biblia Gratis - Escuchar la Biblia en 2026",
    description: "La guía definitiva para escuchar la Biblia en formato audio. Ideal para devocionales en movimiento.",
    type: "website",
    url: "/escuchar-la-biblia",
  },
};

export default function EscucharBibliaPage() {
  return (
    <div className="grow bg-[#FAF9F5] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      <ForceLightTheme />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Escuchar la Biblia en Audio Gratis: Guía 2026",
            "image": "https://esdocu.com/images/veobible-mockup.png",
            "description": "Descubre las mejores opciones para escuchar la Biblia en audio gratis en español, destacando el soporte offline de VeoBible.",
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
            Guía de Audio 2026
          </span>
          <a
            href="https://veobible.com/es"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            Escuchar Ahora
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
                <Headphones className="h-3.5 w-3.5" />
                Audio Devocional
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-slate-950 leading-tight">
                La mejor forma de <br className="hidden sm:inline" />
                <span className="bg-linear-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
                  escuchar la Biblia
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Convierte tus traslados y momentos libres en tiempo de comunión. Descubre las mejores opciones para escuchar la Audio Biblia gratis en español con voces naturales y sin distracciones.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <a
                  href="#guia-completa"
                  className="px-8 py-3.5 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-600/10 transition-all duration-300 inline-flex items-center gap-2 group"
                >
                  Ver Opciones
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
                      alt="Audio Biblia"
                      width={380}
                      height={380}
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="absolute -bottom-6 -left-6 bg-white py-3.5 px-4.5 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.06)] border border-amber-100/60 flex items-center gap-3 animate-bounce-slow">
                    <div className="p-2 rounded-xl bg-amber-50">
                      <Volume2 className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-800 tracking-wider uppercase">Audio HD</p>
                      <p className="text-sm font-extrabold text-slate-900">Voces Naturales</p>
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
              Volviendo a los orígenes: La Biblia nació para ser escuchada
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-16">
              <p>
                A menudo olvidamos que, durante la mayor parte de la historia de la humanidad, las Escrituras no fueron un libro físico que cada persona tenía en su mesita de noche. En el antiguo Israel y en la iglesia primitiva, la inmensa mayoría de la gente no sabía leer, y los pergaminos eran extremadamente costosos. La Palabra de Dios era, ante todo, un evento comunitario y <strong>auditivo</strong>. Las cartas del Apóstol Pablo se leían en voz alta ante toda la congregación.
              </p>
              <p>
                Hoy en día, la tecnología moderna nos permite recuperar esa experiencia original. <strong>Escuchar la Biblia en audio gratis</strong> se ha convertido en una de las tendencias de crecimiento espiritual más fuertes de la década de 2020. Ya no estás limitado a sentarte inmóvil en un escritorio para tener tu tiempo devocional; ahora puedes llenar tu mente de promesas divinas mientras te desplazas por la ciudad.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Situaciones para escuchar */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Convierte el tiempo "muerto" en crecimiento espiritual
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Car className="w-8 h-8 text-amber-600" />
                </div>
                <h4 className="font-bold text-slate-900 mb-2">En el Tráfico</h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  El viaje promedio al trabajo es de 40 minutos diarios. Al escuchar la Biblia mientras conduces, puedes completar la lectura de todo el Nuevo Testamento en tan solo un mes, sin cambiar tu rutina.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Activity className="w-8 h-8 text-amber-600" />
                </div>
                <h4 className="font-bold text-slate-900 mb-2">Haciendo Ejercicio</h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Cambia tu lista de reproducción musical habitual por el libro de los Proverbios o los Salmos mientras corres o estás en el gimnasio. Alimenta tu cuerpo y tu espíritu simultáneamente.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Volume2 className="w-8 h-8 text-amber-600" />
                </div>
                <h4 className="font-bold text-slate-900 mb-2">Antes de Dormir</h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Leer en pantallas retroiluminadas puede alterar tu ciclo de sueño. Cerrar los ojos y programar un capítulo de Juan en audio es una excelente manera de conciliar el sueño en paz.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: El problema del Audio */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight mb-8">
              El problema de las voces robóticas en internet
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-12">
              <p>
                Aunque buscar una <strong>Biblia en audio online</strong> es muy fácil, encontrar una grabación de <em>calidad</em> es sorprendentemente difícil. En su afán por lanzar aplicaciones rápidamente, cientos de páginas web utilizan tecnologías de texto a voz (TTS) de baja calidad.
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-1/2 p-6 bg-red-50/50 rounded-2xl border border-red-100">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                  <h4 className="font-bold text-slate-900">Lo que debes evitar</h4>
                </div>
                <ul className="space-y-3 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    Voces sintéticas que pronuncian mal los nombres bíblicos complejos (como "Nabucodonosor" o "Melquisedec").
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    Pausas incorrectas en medio de oraciones poéticas que arruinan la comprensión del texto.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    Aplicaciones gratuitas que interrumpen la narración de la crucifixión con un anuncio publicitario a todo volumen sobre un juego de casino.
                  </li>
                </ul>
              </div>

              <div className="md:w-1/2 p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-3 mb-4">
                  <Check className="w-6 h-6 text-emerald-500" />
                  <h4 className="font-bold text-slate-900">Lo que debes buscar</h4>
                </div>
                <ul className="space-y-3 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    Locutores profesionales hispanohablantes que entienden el peso emocional y solemne del texto que están leyendo.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    Grabaciones en estudio sin ruido de fondo, codificadas en alta calidad (HD).
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    Plataformas limpias de publicidad, que ofrezcan una reproducción ininterrumpida.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Recomendación VeoBible */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-display font-extrabold text-slate-900 mb-10 text-center">
              Nuestra Recomendación: El Reproductor Integrado de VeoBible
            </h3>
            <div className="bg-white p-8 md:p-12 rounded-3xl border border-amber-100 shadow-xl">
              <div className="flex flex-col md:flex-row gap-10 items-start">
                <div className="grow space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold tracking-wider uppercase">
                      Líder en Audio 2026
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
                    VeoBible ha transformado la experiencia auditiva bíblica al crear un reproductor multimedia elegante, veloz y completamente integrado en su plataforma gratuita. Cumple con todos los requisitos para una experiencia inmersiva superior.
                  </p>
                  
                  <ul className="space-y-4 mt-6">
                    <li className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <Mic className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block mb-1">Voces Naturales Premium</strong>
                        <span className="text-sm">Ofrece narraciones fluidas y expresivas, alejadas por completo de las voces sintéticas gratuitas de los sistemas operativos.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <Smartphone className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block mb-1">Background Play (Segundo Plano)</strong>
                        <span className="text-sm">A diferencia de YouTube, donde el audio se corta si apagas la pantalla, el reproductor web de VeoBible sigue funcionando con el teléfono bloqueado en tu bolsillo.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <BookText className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block mb-1">Lectura Sincronizada</strong>
                        <span className="text-sm">Puedes darle a Play y seguir el texto con tus ojos en la pantalla al mismo tiempo. Un excelente ejercicio para retener la información.</span>
                      </div>
                    </li>
                  </ul>
                  
                  <div className="pt-8 text-center sm:text-left">
                    <a
                      href="https://veobible.com/es"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg transition-all shadow-sm gap-2 w-full sm:w-auto"
                    >
                      Escuchar Gratis en VeoBible
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Tipos de Audio y Consejos */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              
              <div>
                <h2 className="text-2xl font-display font-bold text-slate-950 mb-6">
                  Tipos de Grabaciones
                </h2>
                <div className="space-y-6 text-slate-600">
                  <div>
                    <h4 className="font-bold text-amber-700 text-lg mb-2">Narración Pura</h4>
                    <p className="text-sm leading-relaxed">
                      Es una sola voz leyendo el texto de forma clara y pausada. No hay efectos especiales ni música. Es ideal para el estudio bíblico profundo, ya que nada compite con la voz del locutor y el texto es el protagonista absoluto.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-700 text-lg mb-2">Biblia Dramatizada</h4>
                    <p className="text-sm leading-relaxed">
                      Incluye múltiples actores de voz interpretando los distintos personajes bíblicos, con efectos de sonido (como multitudes gritando o viento soplando) y una banda sonora épica de fondo. Es espectacular para escuchar libros históricos (como Éxodo o Reyes) o el Apocalipsis, porque los convierte casi en una película auditiva.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-display font-bold text-slate-950 mb-6 flex items-center gap-2">
                  <FastForward className="text-amber-500 w-6 h-6" />
                  Consejos para Escuchar
                </h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 shrink-0">1</div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">Traducciones Dinámicas</h4>
                      <p className="text-sm text-slate-600">Si tu objetivo es escuchar mientras haces otra cosa, te recomendamos usar traducciones modernas como la NTV (Nueva Traducción Viviente) o NVI. Su lenguaje actual y fluido es mucho más fácil de asimilar al oído que el castellano antiguo de la Reina Valera 1960.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 shrink-0">2</div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">Ajusta la Velocidad</h4>
                      <p className="text-sm text-slate-600">La mayoría de plataformas como VeoBible permiten modificar la velocidad de reproducción. Muchos creyentes descubren que escuchar la narración a una velocidad de <strong>1.25x</strong> les ayuda a mantener mejor la concentración, evitando que la mente divague durante pausas largas.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 shrink-0">3</div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">Evita las Genealogías</h4>
                      <p className="text-sm text-slate-600">Si estás manejando tu auto y llegas a 1 Crónicas 1 (los interminables capítulos de listas genealógicas), no dudes en saltar el capítulo. Está bien. El audio es para nutrirte espiritualmente, no para sufrir intentando descifrar nombres de antepasados mientras cambias de carril.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Section 6: FAQs */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Preguntas Frecuentes
            </h2>

            <div className="space-y-6">
              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Puedo escuchar la Biblia sin conexión a internet?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  Sí, pero con una salvedad técnica importante: los archivos de audio en alta definición son muy pesados (varios GB para la Biblia completa). Aplicaciones premium te permitirán "descargar" capítulos específicos a través de WiFi en tu casa para que luego puedas darle Play en la calle sin consumir tu plan de datos móviles.
                </div>
              </details>

              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Existe la versión dramatizada para traducciones católicas?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  Sí. Aunque las producciones dramatizadas de la Biblia Reina Valera 1960 y la NVI son las más populares y fáciles de conseguir de forma gratuita en internet, también existen excelentes grabaciones dramatizadas de traducciones como la Biblia de Jerusalén o la Dios Habla Hoy (DHH) que incluyen los libros deuterocanónicos.
                </div>
              </details>

              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Escuchar audios cuenta como tiempo de lectura de la Biblia?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  Absolutamente. Recuerda Romanos 10:17: <em>"Así que la fe es por el oír, y el oír, por la palabra de Dios."</em> Históricamente, la inmensa mayoría de los héroes de la fe bíblica no sabían leer; su conocimiento de las Escrituras provenía exclusivamente de memorizar lo que escuchaban en las asambleas. Tu cerebro procesa y es transformado por la Palabra de igual manera, ya sea entrando por tus ojos o por tus oídos.
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
              Acompaña tu día con la Biblia
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed">
              Comienza hoy a <strong>escuchar la Biblia</strong> y descubre cómo transformar tus momentos libres. Con <strong className="font-bold text-slate-900">VeoBible</strong>, la Palabra siempre irá contigo.
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
