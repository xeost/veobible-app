import ExportedImage from "next-image-export-optimizer";
import { Check, BookOpen, Clock, Heart, Volume2, Search, ArrowRight, BookMarked, Sparkles, MonitorSmartphone, WifiOff, Globe, AlertCircle, Star } from "lucide-react";
import { ForceLightTheme } from "../mejor-pagina-para-leer-la-biblia/force-light-theme";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Biblia Online Gratis: Las Mejores Formas de Leer la Biblia en 2026",
  description: "Descubre cómo leer la Biblia online gratis en español. Conoce las mejores plataformas sin anuncios, con audio y fáciles de usar en cualquier dispositivo.",
  openGraph: {
    title: "Biblia Online Gratis - Guía de Lectura 2026",
    description: "La guía definitiva para leer la Biblia online de forma gratuita y sin distracciones publicitarias.",
    type: "website",
    url: "/biblia-online-gratis",
  },
};

export default function BibliaOnlineGratisPage() {
  return (
    <div className="grow bg-[#FAF9F5] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      <ForceLightTheme />

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "Biblia Online Gratis: Guía Completa 2026",
            "image": "https://esdocu.com/images/veobible-mockup.png",
            "description": "Descubre las mejores plataformas para leer la Biblia online gratis en español, sin anuncios ni distracciones.",
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
            Guía de Lectura 2026
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
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Actualizado para 2026
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-slate-950 leading-tight">
                Cómo leer la <br className="hidden sm:inline" />
                <span className="bg-linear-to-r from-amber-600 to-amber-500 bg-clip-text text-transparent">
                  Biblia online gratis
                </span>
              </h1>

              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Encontrar la plataforma ideal para tu lectura devocional diaria puede ser abrumador. Te mostramos las mejores opciones para acceder a la Biblia en español desde cualquier dispositivo, sin costos ocultos ni publicidad molesta.
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
                      alt="Leer la Biblia Online"
                      width={380}
                      height={380}
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="absolute -bottom-6 -left-6 bg-white py-3.5 px-4.5 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.06)] border border-amber-100/60 flex items-center gap-3 animate-bounce-slow">
                    <div className="p-2 rounded-xl bg-amber-50">
                      <Globe className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-800 tracking-wider uppercase">Acceso Web</p>
                      <p className="text-sm font-extrabold text-slate-900">Rápido y Universal</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Introduction */}
        <section id="guia-completa" className="py-20 bg-white border-y border-slate-200/60 px-6 scroll-mt-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              El auge de la lectura bíblica en internet
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-16">
              <p>
                A lo largo de los siglos, el acceso a las Sagradas Escrituras ha sido un privilegio por el cual muchos han sacrificado sus vidas. Desde los manuscritos copiados a mano en los monasterios medievales, pasando por la revolución de la imprenta de Gutenberg, hasta llegar a nuestros días, la forma en que interactuamos con la <strong>Biblia</strong> ha estado en constante evolución.
              </p>
              <p>
                Hoy en día, tener acceso a una <strong>Biblia online gratis</strong> nos permite llevar la Palabra de Dios literalmente en el bolsillo o abrirla en cualquier computadora de escritorio del mundo. Ya sea que estés en un breve descanso en el trabajo, viajando en el transporte público, o en la quietud de tu sala de estar, las plataformas web modernas ofrecen una flexibilidad sin precedentes para el creyente moderno.
              </p>
              <p>
                Sin embargo, con la abundancia de opciones en internet, surge un nuevo problema: la saturación visual. No todas las páginas que ofrecen el texto bíblico son iguales. Muchas de ellas, en un esfuerzo por monetizar el enorme tráfico que atraen las búsquedas religiosas, están saturadas de publicidad invasiva, banners intermitentes y videos auto-reproducibles que ahogan por completo la paz y el silencio necesarios para un momento de verdadera meditación espiritual.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Historia y Evolución */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              La evolución de la Biblia digital: De los CD-ROMs a la nube
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
                <p>
                  Para entender el inmenso valor de tener una Biblia online gratis hoy, debemos recordar cómo era el panorama hace un par de décadas. En los años 90, la única forma de tener una experiencia digital profunda con las Escrituras era adquiriendo costosos programas en formato CD-ROM que requerían una instalación compleja en la computadora.
                </p>
                <p>
                  Con la llegada de la Web 2.0 y la masificación del internet, surgieron los primeros grandes portales bíblicos. Si bien representaron un avance gigantesco al democratizar el acceso al texto, muchas de estas páginas herederaron un diseño recargado, parecido al de los antiguos programas de escritorio, llenos de barras de herramientas, menús desplegables infinitos y tablas de datos.
                </p>
                <p>
                  En la actualidad (2026), la tendencia es el <strong>minimalismo y la inmediatez</strong>. Las mejores plataformas han comprendido que el usuario no quiere aprender a usar un software complejo; simplemente quiere abrir su navegador y empezar a leer en menos de tres segundos, con una tipografía que respete sus ojos y una interfaz que desaparezca para dejar que el texto sagrado sea el único protagonista.
                </p>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-amber-100 shadow-xl relative">
                <div className="absolute -top-4 -right-4 bg-amber-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg">?</div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">¿Sabías que...?</h3>
                <p className="text-slate-600 mb-4">
                  El término "Biblia online" genera millones de búsquedas mensuales a nivel mundial. Curiosamente, los picos históricos de estas búsquedas suelen darse durante crisis globales o en las primeras semanas de enero, cuando millones de personas se proponen la meta de leer la Biblia completa en un año.
                </p>
                <p className="text-slate-600 font-medium italic">
                  Tener acceso gratuito en línea ha permitido que creyentes en países con restricciones religiosas puedan leer el texto de forma segura y anónima a través de su navegador web.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Derechos de autor */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight mb-8">
              ¿Por qué algunas Biblias online son gratis y otras no? El tema del Copyright
            </h2>
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-12">
              <p>
                Una de las preguntas más frecuentes que se hacen los usuarios es: <em>"Si la Palabra de Dios fue dada libremente, ¿por qué algunas traducciones de la Biblia tienen costo en internet?"</em>
              </p>
              <p>
                La respuesta radica en los inmensos recursos requeridos para realizar una traducción bíblica moderna. Un proyecto como la Nueva Versión Internacional (NVI) o la Nueva Traducción Viviente (NTV) involucra a docenas de eruditos en hebreo, arameo y griego trabajando a tiempo completo durante años. Las Sociedades Bíblicas y editoriales cristianas registran estas traducciones modernas bajo <strong>derechos de autor (Copyright)</strong> para proteger la integridad del texto y recuperar la inversión financiera que hizo posible el proyecto.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Check className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-lg">Dominio Público (100% Libres)</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Las traducciones antiguas cuyos derechos han expirado pueden ser publicadas, impresas y distribuidas libremente por cualquier página web sin restricciones comerciales.
                </p>
                <ul className="text-sm text-slate-700 font-medium space-y-2">
                  <li>• Reina-Valera Antigua (1909)</li>
                  <li>• La Biblia del Oso (1569)</li>
                  <li>• Traducción de Casiodoro de Reina</li>
                </ul>
              </div>

              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-lg">Con Derechos de Autor</h4>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Páginas como VeoBible o YouVersion deben llegar a complejos acuerdos legales y pagar licencias (o regirse por estrictas normas de uso justo) para poder mostrarlas de forma gratuita al usuario final.
                </p>
                <ul className="text-sm text-slate-700 font-medium space-y-2">
                  <li>• Nueva Versión Internacional (NVI)</li>
                  <li>• Nueva Traducción Viviente (NTV)</li>
                  <li>• Reina-Valera 1960 (RVR1960)</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-8 p-6 bg-amber-50/50 rounded-xl border border-amber-100/50 text-slate-700 leading-relaxed">
              Es por esto que cuando buscas una "Biblia online gratis", muchas plataformas pequeñas o sitios web piratas solo te ofrecen versiones de hace más de cien años. Mantener una plataforma con licencias de traducciones contemporáneas requiere un respaldo financiero continuo.
            </div>
          </div>
        </section>

        {/* Section 4: Peligros */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold tracking-wider uppercase mb-4">
                Seguridad Digital
              </span>
              <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight">
                Los peligros de buscar "Biblias Gratis" en sitios no verificados
              </h2>
            </div>
            
            <div className="space-y-8 text-lg text-slate-600 leading-relaxed">
              <p>
                Lamentablemente, el interés masivo por leer la Biblia ha atraído a ciberdelincuentes. Cuando buscas en Google términos como <em>"Descargar Biblia Reina Valera Gratis PDF Completa"</em> o ingresas a páginas web de dudosa procedencia para leer online, te expones a diversos riesgos de seguridad informática.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="h-12 w-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <WifiOff className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-2">Botones Engañosos</h4>
                  <p className="text-sm text-slate-600">
                    Páginas web inundadas de falsos botones de "Download" o "Leer Ahora" que en realidad te suscriben a servicios SMS de pago o descargan virus troyanos en tu dispositivo móvil.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="h-12 w-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <MonitorSmartphone className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-2">Pop-ups Invasivos</h4>
                  <p className="text-sm text-slate-600">
                    Sitios gratuitos de baja calidad que abren múltiples pestañas en tu navegador con publicidad inapropiada o fraudulenta justo en medio de tu tiempo devocional de oración.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="h-12 w-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-2">Textos Adulterados</h4>
                  <p className="text-sm text-slate-600">
                    Algunas páginas alojan archivos de texto que han sido modificados por sectas o grupos particulares para cambiar sutilmente el significado de versículos clave.
                  </p>
                </div>
              </div>
              
              <p className="pt-4 font-medium text-center text-slate-800">
                La regla de oro en 2026 es clara: nunca descargues archivos PDF ejecutables de fuentes desconocidas y prefiere siempre plataformas online establecidas, limpias y de buena reputación como VeoBible.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Características indispensables */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Características indispensables en una Biblia Online de calidad
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm flex gap-5 items-start transition-transform hover:-translate-y-1">
                <MonitorSmartphone className="h-10 w-10 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Multidispositivo Absoluto</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Tu progreso de lectura, el último capítulo donde te quedaste, tus marcadores y tus notas deben sincronizarse de manera instantánea y automática entre tu teléfono móvil (iOS/Android) y tu computadora de escritorio en el navegador web.
                  </p>
                </div>
              </div>
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm flex gap-5 items-start transition-transform hover:-translate-y-1">
                <Search className="h-10 w-10 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Buscador Inteligente</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Encontrar un pasaje sabiendo solo un fragmento como "el amor todo lo soporta" debe arrojar resultados exactos al instante. Una buena herramienta web debe tener una barra de búsqueda rápida que no obligue a recargar la página entera.
                  </p>
                </div>
              </div>
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm flex gap-5 items-start transition-transform hover:-translate-y-1">
                <Volume2 className="h-10 w-10 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Soporte de Audio Nativo</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Poder escuchar la Biblia online mientras conduces, trabajas en la oficina o realizas labores del hogar es una función crucial. Las mejores páginas integran narraciones con voces naturales (no robóticas) directamente en la interfaz de lectura.
                  </p>
                </div>
              </div>
              <div className="bg-[#FAF9F5] p-8 rounded-3xl border border-slate-100 shadow-sm flex gap-5 items-start transition-transform hover:-translate-y-1">
                <Globe className="h-10 w-10 text-amber-500 shrink-0" />
                <div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">PWA (Aplicación Web Progresiva)</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    La página web debe estar construida con tecnología PWA. Esto te permite "instalarla" como un acceso directo en el escritorio de tu celular o computadora y usarla como si fuera una app nativa, funcionando incluso cuando te quedas temporalmente sin conexión a internet (modo offline).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Nuestra Recomendación */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-display font-extrabold text-slate-900 mb-10 text-center">
              Nuestra Recomendación Definitiva: VeoBible
            </h3>
            <div className="bg-white p-8 md:p-12 rounded-3xl border border-amber-100 shadow-xl">
              <div className="flex flex-col md:flex-row gap-10 items-start">
                <div className="grow space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold tracking-wider uppercase">
                      La Opción #1 en 2026
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
                    VeoBible ha revolucionado completamente la forma en que los creyentes hispanohablantes acceden a las Escrituras. Es una plataforma web 100% gratuita que puedes utilizar directamente desde tu navegador sin instalar archivos pesados. Destaca de inmediato por su enfoque obsesivo en la legibilidad y la paz mental.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                    <div className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl">
                      <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>100% Sin Publicidad:</strong> Ni un solo banner, nunca. El texto bíblico es respetado como sagrado.</span>
                    </div>
                    <div className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl">
                      <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Modo Oscuro Elegante:</strong> Perfecto para leer en la cama de noche sin forzar la vista ni afectar tu ciclo de sueño.</span>
                    </div>
                    <div className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl">
                      <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Carga Instantánea:</strong> Pasa de Génesis a Apocalipsis en milisegundos. Sin tiempos de espera.</span>
                    </div>
                    <div className="flex items-start gap-3 text-slate-700 bg-slate-50 p-4 rounded-xl">
                      <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Tipografía Literaria:</strong> Letras amplias, limpias y diseñadas como un libro impreso de alta gama.</span>
                    </div>
                  </div>
                  
                  <div className="pt-8 text-center sm:text-left">
                    <a
                      href="https://veobible.com/es"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold rounded-full bg-amber-600 text-white hover:bg-amber-700 hover:shadow-lg transition-all shadow-sm gap-2 w-full sm:w-auto"
                    >
                      Empezar a Leer en VeoBible
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: Consejos para el devocional */}
        <section className="py-20 bg-white border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Consejos prácticos para aprovechar tu lectura bíblica online
            </h2>
            
            <div className="prose prose-slate prose-lg max-w-none text-slate-600 mb-12 text-center">
              <p>
                Tener la <strong>Biblia gratis</strong> a un clic de distancia es una bendición, pero también un desafío. La pantalla que usas para leer es la misma que usas para trabajar, ver noticias o interactuar en redes sociales. ¿Cómo separar lo sagrado de lo cotidiano en el mundo digital?
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl shrink-0 shadow-sm border border-amber-100">1</div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">Activa el modo "No Molestar"</h4>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    El enemigo número uno de la meditación bíblica en el siglo XXI es la notificación push. Antes de abrir tu navegador para leer, tómate dos segundos para activar el modo "No molestar" en tu teléfono o computadora. Ese correo del trabajo o ese mensaje de WhatsApp pueden esperar 15 minutos. Dedícale a Dios tu atención completa, no las sobras de tu atención dividida.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl shrink-0 shadow-sm border border-amber-100">2</div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">Usa la función de pantalla completa</h4>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    La mayoría de los navegadores modernos (como Chrome, Safari o Firefox) permiten poner las páginas web en modo pantalla completa (presionando F11 en Windows o Cmd+Ctrl+F en Mac). Al hacer esto en plataformas limpias como VeoBible, haces desaparecer las pestañas, la barra de direcciones y la barra de tareas. El resultado es que tu pantalla entera se convierte en un libro abierto.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl shrink-0 shadow-sm border border-amber-100">3</div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">Complementa la lectura con el audio</h4>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    Nuestros cerebros retienen mucho mejor la información cuando se involucran múltiples sentidos. Si la plataforma que usas tiene soporte de audio, intenta leer el texto con tus ojos al mismo tiempo que escuchas al narrador. Esta técnica de "doble anclaje" es fantástica para evitar que tu mente divague pensando en la lista del supermercado mientras tus ojos recorren los versículos de Proverbios.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl shrink-0 shadow-sm border border-amber-100">4</div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-3">Ten una libreta física al lado</h4>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    Aunque parezca contradictorio al estar usando una herramienta digital, el acto físico de escribir a mano conecta hemisferios del cerebro que no se activan al teclear. Usa tu Biblia online para leer, buscar y comparar textos, pero ten un pequeño diario o cuaderno de notas analógico junto al teclado para escribir las reflexiones o versículos que más impacten tu corazón ese día.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8: FAQs */}
        <section className="py-20 bg-[#FAF9F5] border-t border-slate-200/60 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-display font-extrabold text-slate-950 tracking-tight text-center mb-12">
              Preguntas Frecuentes sobre leer la Biblia Online
            </h2>

            <div className="space-y-6">
              <details className="group bg-[#FAF9F5] border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Necesito internet constante para usar una Biblia online?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  Normalmente sí. Sin embargo, las plataformas web más modernas (como VeoBible) utilizan tecnología PWA, lo que significa que el texto del libro que estás leyendo se almacena temporalmente en la memoria caché (cache) de tu navegador. Si de repente pierdes la conexión en el metro, la página no se cerrará ni mostrará un error de "sin internet"; podrás seguir leyendo el capítulo actual sin problemas.
                </div>
              </details>

              <details className="group bg-[#FAF9F5] border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Las versiones gratuitas online están incompletas?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  No. En los sitios web legítimos, las Biblias están 100% completas con sus 66 libros canónicos (Antiguo y Nuevo Testamento). El rumor de que las Biblias gratis en internet carecen de versículos es un mito originado por la confusión entre las distintas metodologías de traducción (equivalencia dinámica vs equivalencia formal) y los hallazgos de manuscritos más antiguos, no por una cuestión de que sea "gratis" o "de pago".
                </div>
              </details>

              <details className="group bg-[#FAF9F5] border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <summary className="flex items-center justify-between cursor-pointer p-6 font-bold text-slate-900 text-lg list-none">
                  ¿Puedo confiar en que el texto no ha sido manipulado?
                  <span className="text-amber-600 font-bold text-2xl group-open:rotate-45 transition-transform duration-200">+</span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-200/50 mt-4 pt-4">
                  Si utilizas plataformas recomendadas y serias (como VeoBible, YouVersion o Bible Gateway), puedes tener absoluta certeza y seguridad de que el texto proviene de la base de datos oficial de la editorial matriz (como las Sociedades Bíblicas Unidas o Tyndale House Publishers) y que no ha sufrido alteración humana malintencionada en la web.
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
              Inicia tu lectura hoy mismo
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed">
              Descubre una experiencia sin igual. Con <strong className="font-bold text-slate-900">VeoBible</strong>, tienes la mejor herramienta para leer la Biblia online completamente gratis.
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
            <div className="pt-2 text-xs text-slate-400 font-medium">
              No requiere tarjeta de crédito ni registro obligatorio
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
