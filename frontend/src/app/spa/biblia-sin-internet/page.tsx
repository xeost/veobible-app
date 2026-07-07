import ExportedImage from "next-image-export-optimizer";
import { Check, BookOpen, Clock, Heart, Volume2, Search, ArrowRight, BookMarked, Sparkles, WifiOff, DownloadCloud, MonitorSmartphone, Battery, Lock, Star, AlertCircle } from "lucide-react";
import { ForceLightTheme } from "../mejor-pagina-para-leer-la-biblia/force-light-theme";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Biblia sin Internet: La Mejor App Offline de 2026",
  description: "Descarga la mejor app de la Biblia sin internet. Funciona totalmente offline, sin publicidad y con un diseño diseñado para la lectura profunda.",
  openGraph: {
    title: "Biblia Sin Internet - Guía de Apps Offline 2026",
    description: "Lee la Biblia en cualquier lugar sin gastar tus datos móviles con la mejor aplicación offline del mercado.",
    type: "website",
    url: "/biblia-sin-internet",
  },
};

export default function BibliaSinInternetPage() {
  return (
    <div className="grow bg-[#FAF9F5] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      <ForceLightTheme />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Biblia sin Internet: La Mejor App Offline de 2026",
            "image": "https://esdocu.com/images/veobible-mockup.png",
            "description": "Análisis de la mejor aplicación para leer la Biblia sin internet (offline), destacando la tecnología PWA de VeoBible.",
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
            Guía Offline 2026
          </span>
          <a
            href="https://veobible.com/es"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            Probar App Offline
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
                <WifiOff className="h-3.5 w-3.5" />
                Funciona 100% Offline
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-slate-950 leading-tight">
                Lee la <span className="bg-linear-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
                  Biblia sin internet
                </span> <br className="hidden sm:inline" />
                en cualquier lugar
              </h1>

              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Descubre la mejor aplicación para llevar las Escrituras siempre contigo sin gastar tus datos móviles ni depender de una conexión WiFi. Totalmente gratis y sin anuncios.
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
                <a
                  href="#guia-completa"
                  className="px-8 py-3.5 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-600/10 transition-all duration-300 inline-flex items-center gap-2 group"
                >
                  Ver la Mejor Opción
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
                      alt="Biblia Sin Internet Offline"
                      width={380}
                      height={380}
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="absolute -bottom-6 -left-6 bg-white py-3.5 px-4.5 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.06)] border border-amber-100/60 flex items-center gap-3 animate-bounce-slow">
                    <div className="p-2 rounded-xl bg-amber-50">
                      <DownloadCloud className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-800 tracking-wider uppercase">Modo Avión</p>
                      <p className="text-sm font-extrabold text-slate-900">Textos Descargados</p>
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
              La paradoja moderna: Conectados al mundo, desconectados del Espíritu
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-16">
              <p>
                Vivimos en la era de la hiperconexión. Nuestros teléfonos inteligentes nos mantienen atados a un flujo constante de noticias, correos electrónicos del trabajo y notificaciones de redes sociales. Irónicamente, usamos este mismo dispositivo, diseñado para mantenernos conectados con el mundo exterior, para intentar conectarnos con Dios a través de la lectura bíblica.
              </p>
              <p>
                Esta paradoja hace que tener una <strong>Biblia sin internet</strong> instalada en tu dispositivo no sea un simple "capricho tecnológico", sino una necesidad espiritual absoluta. Cuando tu teléfono está en línea, la tentación de responder ese mensaje de WhatsApp que acaba de vibrar mientras lees el libro de Proverbios es casi irresistible. 
              </p>
              <p>
                Cortar la conexión a internet (activando el Modo Avión) es el equivalente moderno a "cerrar la puerta de tu aposento" como enseñó Jesús en Mateo 6:6. Pero para poder hacer esto, necesitas una aplicación bíblica que esté diseñada para funcionar al 100% en entornos fuera de línea, sin que se rompa, lance errores o pida conexión para mostrar el siguiente capítulo.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Situaciones */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              4 Escenarios donde una Biblia Offline salvará tu devocional
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <WifiOff className="w-24 h-24" />
                </div>
                <h4 className="font-bold text-slate-900 text-xl mb-3">1. Viajes en Metro y Transporte</h4>
                <p className="text-slate-600 leading-relaxed text-sm">
                  El tiempo de trayecto al trabajo o la universidad es el momento de lectura principal para millones de personas. Sin embargo, la señal en el transporte subterráneo o en carreteras rurales es intermitente. Una app offline asegura que tu lectura de Romanos no se corte abruptamente al entrar a un túnel.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Battery className="w-24 h-24" />
                </div>
                <h4 className="font-bold text-slate-900 text-xl mb-3">2. Retiros y Viajes Misioneros</h4>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Al asistir a un campamento eclesiástico en la montaña, visitar zonas rurales en viajes misioneros a otros países, o simplemente salir de tu ciudad de residencia, el roaming de datos es costoso o inexistente. Tu Biblia debe viajar contigo incondicionalmente.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Lock className="w-24 h-24" />
                </div>
                <h4 className="font-bold text-slate-900 text-xl mb-3">3. Ahorro Radical de Batería</h4>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Buscar constantemente señal de red celular (3G/4G/5G) es una de las cosas que más drena la batería de un móvil. Si estás en el hospital esperando resultados de un familiar y quieres leer los Salmos, poner el móvil en Modo Avión con una app offline te garantizará batería para todo el día.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <MonitorSmartphone className="w-24 h-24" />
                </div>
                <h4 className="font-bold text-slate-900 text-xl mb-3">4. Iglesias "Anti-Distracción"</h4>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Cada vez más congregaciones implementan bloqueadores de señal o construyen santuarios gruesos donde la señal no entra. Esto se hace intencionalmente para evitar teléfonos sonando durante la predicación. Si usas Biblia digital, necesitas que funcione allí dentro.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: El engaño */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              El problema con las apps "Offline" tradicionales
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-12">
              <p>
                Si abres la App Store de Apple o la Google Play Store y buscas "Biblia sin internet", te aparecerán cientos de resultados. Sin embargo, la gran mayoría de estas aplicaciones ocultan "trampas" bajo su promesa de gratuidad y funcionamiento desconectado.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4 p-6 bg-red-50/50 border border-red-100 rounded-2xl items-start">
                <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">Pesan una barbaridad (Gigabytes de memoria)</h4>
                  <p className="text-slate-600 text-sm mt-1">
                    Muchas apps tradicionales te obligan a descargar paquetes de audio completos o versiones en docenas de idiomas que no necesitas, ocupando 1 GB o 2 GB de la valiosa memoria de tu teléfono, obligándote a borrar fotos o aplicaciones importantes.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 p-6 bg-red-50/50 border border-red-100 rounded-2xl items-start">
                <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">Falso "Offline"</h4>
                  <p className="text-slate-600 text-sm mt-1">
                    ¿Te ha pasado que apagas el WiFi y la app de repente dice "Error de conexión"? Esto es porque muchas apps dicen ser offline, pero programan su buscador (para encontrar versículos por palabra) dependiendo de un servidor externo.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-6 bg-red-50/50 border border-red-100 rounded-2xl items-start">
                <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-slate-900 text-lg">Permisos Abusivos</h4>
                  <p className="text-slate-600 text-sm mt-1">
                    Aplicaciones instaladas desde la tienda frecuentemente te exigen permisos absurdos: acceso a tu cámara, tus contactos, tu micrófono o a tu ubicación GPS en tiempo real. ¿Para qué necesita una Biblia saber dónde estás físicamente parado?
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: La Revolución PWA */}
        <section className="py-20 bg-slate-900 text-white px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <span className="inline-block px-3 py-1 rounded-full bg-slate-800 text-amber-400 text-[11px] font-bold tracking-wider uppercase border border-slate-700">
                  La Tecnología de 2026
                </span>
                <h2 className="text-3xl font-display font-extrabold tracking-tight">
                  La Revolución de las Aplicaciones PWA
                </h2>
                <p className="text-slate-300 leading-relaxed text-lg">
                  La solución definitiva a todos los problemas de las apps tradicionales tiene nombre: <strong>Progressive Web Apps (PWA)</strong>.
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Una PWA es una página web moderna que tiene superpoderes. Cuando la visitas desde tu navegador (como Safari o Chrome), tu teléfono te permite "instalarla" en tu pantalla de inicio como cualquier otra app. La magia radica en que descarga solo los archivos de texto esenciales (unos pocos Megabytes) y los guarda en la memoria ultrarrápida del navegador.
                </p>
              </div>
              <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-4">Por qué las PWA dominan el mercado offline</h3>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3">
                    <Check className="text-emerald-400 w-5 h-5 shrink-0" />
                    <span className="text-slate-300">No requieren instalar nada de la App Store o Google Play.</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="text-emerald-400 w-5 h-5 shrink-0" />
                    <span className="text-slate-300">Pesan hasta un 95% menos que una app nativa tradicional.</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="text-emerald-400 w-5 h-5 shrink-0" />
                    <span className="text-slate-300">No tienen acceso a permisos invasivos (cámara, contactos, GPS). Son 100% privadas.</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="text-emerald-400 w-5 h-5 shrink-0" />
                    <span className="text-slate-300">Se actualizan automáticamente en segundo plano cuando te conectas a WiFi.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Recomendación VeoBible */}
        <section className="py-20 bg-[#FAF9F5] px-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-display font-extrabold text-slate-900 mb-10 text-center">
              Nuestra Recomendación Definitiva: VeoBible
            </h3>
            <div className="bg-white p-8 md:p-12 rounded-3xl border border-amber-100 shadow-xl">
              <div className="flex flex-col md:flex-row gap-10 items-start">
                <div className="grow space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold tracking-wider uppercase">
                      PWA Pionera
                    </span>
                    <div className="flex text-amber-500">
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                  </div>
                  <h4 className="text-4xl font-extrabold text-slate-950">VeoBible Offline</h4>
                  <p className="text-slate-600 text-lg leading-relaxed">
                    <strong>VeoBible</strong> ha sido desarrollada desde cero utilizando arquitectura PWA. Es la forma más inteligente, segura y rápida de llevar la Palabra de Dios en tu bolsillo sin depender jamás del internet.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                    <div className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <DownloadCloud className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Cache Inteligente:</strong> Al entrar a la web, el texto bíblico se guarda de inmediato en tu dispositivo de forma casi invisible.</span>
                    </div>
                    <div className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <Search className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Buscador Local:</strong> El motor de búsqueda de VeoBible funciona íntegramente en tu procesador. Cero internet requerido.</span>
                    </div>
                  </div>
                  
                  <div className="pt-8 text-center sm:text-left">
                    <a
                      href="https://veobible.com/es"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg transition-all shadow-sm gap-2 w-full sm:w-auto"
                    >
                      Instalar VeoBible Ahora
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Tutorial */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Cómo instalar la PWA de VeoBible en 3 pasos
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* iPhone */}
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <MonitorSmartphone className="text-amber-500" />
                  Para iPhone (Safari)
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 mt-1">1</div>
                    <p className="text-slate-600">Abre <strong>Safari</strong> en tu iPhone y entra a <em>veobible.com</em>.</p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 mt-1">2</div>
                    <p className="text-slate-600">Toca el botón central inferior de <strong>"Compartir"</strong> (el cuadrado con la flecha apuntando hacia arriba).</p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 mt-1">3</div>
                    <p className="text-slate-600">Desliza el menú hacia abajo y selecciona <strong>"Añadir a pantalla de inicio"</strong>. ¡Listo! El ícono aparecerá junto a tus otras apps.</p>
                  </div>
                </div>
              </div>

              {/* Android */}
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <MonitorSmartphone className="text-amber-500" />
                  Para Android (Chrome)
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 mt-1">1</div>
                    <p className="text-slate-600">Abre <strong>Google Chrome</strong> en tu móvil y entra a <em>veobible.com</em>.</p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 mt-1">2</div>
                    <p className="text-slate-600">En la mayoría de dispositivos, te aparecerá un banner automático en la parte inferior diciendo <strong>"Instalar aplicación"</strong>. Tócalo.</p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0 mt-1">3</div>
                    <p className="text-slate-600">Si no aparece, toca los tres puntos (Menú) arriba a la derecha y selecciona <strong>"Instalar aplicación"</strong> o "Añadir a pantalla de inicio".</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-10 p-6 bg-amber-50 rounded-2xl border border-amber-100 text-center">
              <p className="text-amber-800 font-medium">
                Una vez instalado el ícono, abre la app, activa el "Modo Avión" en tu teléfono y comprueba cómo puedes navegar por toda la Biblia sin usar internet.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7: FAQs */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Preguntas Frecuentes sobre la Biblia Offline
            </h2>

            <div className="space-y-6">
              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿El modo sin internet incluye los audios de narración?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  Por regla general, no. Los archivos de audio son extremadamente pesados (una Biblia narrada completa puede pesar varios Gigabytes). Las aplicaciones PWA como VeoBible optimizan el texto para que funcione sin red, pero requieren conexión a internet si deseas presionar "Play" y escuchar la narración en streaming para no saturar tu memoria.
                </div>
              </details>

              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Tengo que pagar para descargar la Biblia en mi celular?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  No, el proceso de instalación de una PWA como VeoBible es completamente gratuito y libre de costos ocultos. Al no pasar por las tiendas de Apple o Google, la plataforma no necesita monetizar la descarga y te garantiza acceso al texto original sin limitaciones.
                </div>
              </details>

              <details className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Se actualiza el progreso si leo estando en modo avión?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  ¡Sí! Las aplicaciones web progresivas están programadas para guardar todos tus marcadores, el último capítulo leído y tu configuración (como el tamaño de letra o el modo oscuro) de forma local en tu teléfono. La próxima vez que te conectes a internet, esos datos se pueden sincronizar en la nube (si has creado una cuenta).
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
              Prepara tu teléfono hoy
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed">
              No esperes a quedarte sin internet para necesitarla. Entra a <strong className="font-bold text-slate-900">VeoBible</strong> ahora e instálala en tu dispositivo para tenerla siempre lista.
            </p>
            <div className="pt-4">
              <a
                href="https://veobible.com/es"
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-4 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-xl hover:shadow-amber-600/10 transition-all duration-300 inline-flex items-center gap-2 group"
              >
                Instalar VeoBible Gratis
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
