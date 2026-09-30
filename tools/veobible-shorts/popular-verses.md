# Catálogo de 100 pasajes para shorts

El archivo `popular-verses.json` contiene 100 rangos distintos, con al menos uno de cada uno de los 66 libros. La selección combina pasajes conocidos con relatos y temas de interés para videos breves: esperanza, ansiedad, amor, perdón, propósito, justicia, fe y resiliencia. El orden es una propuesta editorial para comenzar a publicar; no representa un ranking medido de rendimiento en redes sociales ni una garantía de viralidad.

Como señales de interés se consultaron el [resumen de lecturas de Bible Gateway de 2025](https://www.biblegateway.com/learn/bible-verses/top-verses-2025-year-in-review/) y el [versículo del año 2025 de YouVersion](https://www.youversion.com/pt/news/youversion-announces-2025-verse-of-the-year). Esas fuentes describen uso de sus plataformas; la cobertura de los 66 libros, las ampliaciones a rangos y su orden son decisiones editoriales de este catálogo.

## Extensión y duración

Los 100 rangos cumplen **130–150 palabras en Reina Valera 1909**, usando los textos locales de `frontend/public/bible-data/es/rv1909`. Se cuentan unidades separadas por espacios que contienen letras o números, sin añadir la referencia, el nombre del libro ni los números de versículo. Se excluyen las marcas editoriales de numeración hebrea como `(H2-2)` presentes en Jonás. No se corta ningún versículo ni se altera el texto bíblico.

A una velocidad de 130 palabras por minuto, esa extensión equivale a unos **60–69 segundos**. Las pausas y la velocidad de la grabación pueden cambiar el resultado: hay que medir el audio final para confirmar el límite. La CLI sigue copiando capítulos completos, que requieren recorte al editar el video.

Las mismas referencias están disponibles en las cinco versiones. **El límite de palabras se aplica únicamente a RV1909**; los otros conteos se incluyen para planificar las adaptaciones. Los conteos corresponden al contenido actual del repositorio y deben recalcularse si cambian esos textos o los límites de un rango. Pasajes muy breves, como el Salmo 23 completo, no se han rellenado con texto ajeno solo para llegar al mínimo.

## Lista y conteos

El orden de esta tabla coincide con el JSON. Los temas son etiquetas editoriales, no títulos del texto bíblico.

| # | Pasaje | Tema | RV1909 | SPABLL | KJV | WEB | ARC |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Juan 3:14-19 | El amor de Dios por el mundo | 141 | 132 | 134 | 137 | 133 |
| 2 | Isaías 41:8-13 | No temas: Dios está contigo | 142 | 140 | 166 | 161 | 147 |
| 3 | Salmos 91:1-10 | Refugio bajo sus alas | 138 | 154 | 176 | 171 | 145 |
| 4 | Filipenses 4:6-11 | Paz frente a la ansiedad | 145 | 151 | 157 | 157 | 151 |
| 5 | Jeremías 29:9-14 | Un futuro y una esperanza | 131 | 132 | 170 | 163 | 139 |
| 6 | Proverbios 3:1-10 | Confía aunque no entiendas | 132 | 139 | 146 | 144 | 146 |
| 7 | Filipenses 4:10-16 | Fortaleza en cualquier situación | 133 | 157 | 150 | 157 | 132 |
| 8 | Josué 1:6-9 | Esfuérzate y sé valiente | 139 | 134 | 149 | 138 | 135 |
| 9 | Romanos 8:26-30 | Dios obra en medio de todo | 135 | 116 | 137 | 125 | 122 |
| 10 | Romanos 8:34-39 | Nada nos separa de su amor | 132 | 141 | 139 | 141 | 139 |
| 11 | 1 Corintios 13:1-7 | El amor verdadero | 138 | 152 | 141 | 137 | 146 |
| 12 | Mateo 6:28-34 | Un día a la vez | 141 | 160 | 165 | 147 | 141 |
| 13 | Mateo 11:24-30 | Descanso para el cansado | 149 | 142 | 157 | 151 | 140 |
| 14 | Isaías 40:26-31 | Nuevas fuerzas para continuar | 146 | 146 | 165 | 153 | 151 |
| 15 | 1 Pedro 5:5-11 | Entrega tu ansiedad | 142 | 143 | 144 | 145 | 138 |
| 16 | Salmos 34:12-22 | Dios está cerca del corazón herido | 149 | 165 | 172 | 155 | 163 |
| 17 | Apocalipsis 21:1-5 | Un mundo sin lágrimas | 143 | 132 | 154 | 144 | 142 |
| 18 | 2 Corintios 12:6-10 | Fuerza en la debilidad | 137 | 141 | 160 | 160 | 133 |
| 19 | 2 Corintios 5:16-21 | Una nueva creación | 138 | 152 | 151 | 150 | 137 |
| 20 | Lamentaciones 3:21-33 | Misericordias nuevas cada mañana | 141 | 158 | 177 | 178 | 153 |
| 21 | Marcos 4:35-41 | Jesús calma la tormenta | 132 | 135 | 165 | 148 | 127 |
| 22 | Lucas 15:18-24 | El Padre te recibe de vuelta | 142 | 146 | 167 | 159 | 135 |
| 23 | 2 Timoteo 1:6-11 | Poder, amor y dominio propio | 146 | 151 | 156 | 146 | 139 |
| 24 | Salmos 139:11-18 | Tu vida tiene valor | 138 | 158 | 169 | 156 | 160 |
| 25 | Romanos 12:1-5 | Renueva tu mente | 138 | 140 | 136 | 135 | 124 |
| 26 | Romanos 12:14-21 | Vence el mal con el bien | 130 | 150 | 138 | 144 | 130 |
| 27 | Mateo 5:11-16 | Eres luz del mundo | 137 | 143 | 152 | 150 | 135 |
| 28 | Efesios 6:10-17 | La armadura de Dios | 144 | 143 | 156 | 171 | 147 |
| 29 | Gálatas 5:16-24 | El fruto del Espíritu | 145 | 168 | 160 | 156 | 139 |
| 30 | Hebreos 11:1-6 | Caminar por fe | 147 | 154 | 150 | 162 | 149 |
| 31 | Isaías 43:14-21 | Dios hace algo nuevo | 150 | 172 | 184 | 183 | 166 |
| 32 | Salmos 46:4-11 | Estad quietos | 133 | 138 | 153 | 142 | 130 |
| 33 | Salmos 27:7-14 | Espera y cobra ánimo | 141 | 133 | 161 | 147 | 143 |
| 34 | 1 Juan 1:4-10 | Perdón y limpieza | 134 | 134 | 152 | 151 | 131 |
| 35 | Juan 14:24-29 | Una paz diferente | 136 | 130 | 161 | 150 | 127 |
| 36 | Juan 14:2-9 | El camino, la verdad y la vida | 150 | 147 | 177 | 178 | 144 |
| 37 | Juan 15:1-7 | Permanecer para dar fruto | 147 | 143 | 166 | 164 | 143 |
| 38 | Juan 11:20-28 | La resurrección y la vida | 136 | 143 | 167 | 160 | 134 |
| 39 | Juan 8:5-11 | Gracia y un nuevo comienzo | 136 | 141 | 168 | 158 | 133 |
| 40 | Mateo 7:6-12 | Pide, busca y llama | 138 | 140 | 158 | 156 | 124 |
| 41 | Mateo 7:22-27 | Construye sobre la roca | 130 | 142 | 158 | 145 | 135 |
| 42 | Mateo 5:3-12 | Las bienaventuranzas | 131 | 134 | 143 | 141 | 124 |
| 43 | Lucas 10:29-35 | El buen samaritano | 141 | 136 | 183 | 174 | 141 |
| 44 | Lucas 6:30-36 | Ama a tus enemigos | 140 | 137 | 156 | 151 | 143 |
| 45 | Marcos 10:46-52 | Bartimeo: una fe que no se calla | 135 | 131 | 178 | 159 | 142 |
| 46 | 1 Samuel 17:45-48 | David enfrenta a Goliat | 137 | 135 | 165 | 155 | 133 |
| 47 | Éxodo 14:13-18 | Dios abre un camino | 144 | 143 | 171 | 158 | 139 |
| 48 | Ester 4:13-17 | Para un tiempo como este | 134 | 135 | 150 | 143 | 143 |
| 49 | Habacuc 3:15-19 | Alegría cuando todo falta | 133 | 136 | 156 | 138 | 130 |
| 50 | Eclesiastés 3:1-9 | Todo tiene su tiempo | 134 | 160 | 169 | 168 | 133 |
| 51 | Cantares 8:2-7 | El amor que no se apaga | 146 | 174 | 167 | 159 | 159 |
| 52 | 1 Tesalonicenses 5:14-24 | Gratitud en toda circunstancia | 136 | 129 | 131 | 123 | 130 |
| 53 | Colosenses 3:11-16 | Vestirse de amor | 146 | 134 | 137 | 132 | 129 |
| 54 | 1 Juan 4:7-13 | Dios es amor | 145 | 151 | 142 | 146 | 137 |
| 55 | 1 Timoteo 6:6-12 | Contentamiento y amor al dinero | 137 | 151 | 131 | 140 | 139 |
| 56 | Gálatas 6:3-10 | No te canses de hacer el bien | 137 | 148 | 148 | 153 | 131 |
| 57 | Salmos 103:1-10 | No olvides sus beneficios | 137 | 128 | 139 | 129 | 139 |
| 58 | Proverbios 4:18-27 | Guarda tu corazón | 143 | 146 | 148 | 146 | 151 |
| 59 | Proverbios 16:1-9 | Encomienda tus planes | 135 | 137 | 146 | 134 | 149 |
| 60 | Isaías 53:1-6 | Herido por nuestras transgresiones | 140 | 152 | 166 | 157 | 159 |
| 61 | Isaías 55:6-11 | Mis caminos son más altos | 149 | 154 | 168 | 162 | 163 |
| 62 | Génesis 1:25-28 | Creados a imagen de Dios | 141 | 130 | 152 | 140 | 141 |
| 63 | Deuteronomio 6:3-9 | Amar a Dios con todo el corazón | 131 | 127 | 159 | 152 | 128 |
| 64 | Levítico 19:12-18 | Amar al prójimo | 139 | 149 | 177 | 168 | 140 |
| 65 | Números 23:17-23 | Dios cumple lo que promete | 142 | 154 | 181 | 174 | 153 |
| 66 | Jueces 7:4-7 | Gedeón y los trescientos | 150 | 160 | 180 | 168 | 156 |
| 67 | Rut 1:15-19 | Lealtad en los momentos difíciles | 131 | 126 | 147 | 132 | 147 |
| 68 | 2 Samuel 22:28-36 | Dios ilumina la oscuridad | 134 | 138 | 152 | 138 | 147 |
| 69 | 1 Reyes 18:35-39 | Elías: el Dios que responde | 138 | 135 | 160 | 144 | 140 |
| 70 | 2 Reyes 6:15-18 | Abre nuestros ojos | 136 | 124 | 136 | 123 | 124 |
| 71 | 1 Crónicas 29:9-13 | Todo viene de Dios | 147 | 146 | 145 | 138 | 145 |
| 72 | 2 Crónicas 7:12-16 | Humillarse y buscar a Dios | 133 | 131 | 143 | 143 | 137 |
| 73 | Esdras 7:6-10 | Preparar el corazón para aprender y actuar | 137 | 138 | 162 | 156 | 143 |
| 74 | Nehemías 8:9-12 | El gozo de Dios es nuestra fuerza | 131 | 136 | 148 | 141 | 140 |
| 75 | Job 19:20-27 | Mi Redentor vive en medio del sufrimiento | 136 | 138 | 141 | 137 | 143 |
| 76 | Ezequiel 37:1-6 | Vida entre huesos secos | 131 | 132 | 159 | 149 | 135 |
| 77 | Daniel 3:16-21 | Fe aun cuando no llegue el rescate | 146 | 150 | 175 | 165 | 155 |
| 78 | Oseas 14:1-7 | Volver a Dios y recibir sanidad | 136 | 159 | 164 | 154 | 148 |
| 79 | Joel 2:22-27 | Restauración de los años perdidos | 147 | 175 | 184 | 184 | 159 |
| 80 | Amós 5:17-24 | Justicia más allá del culto | 143 | 155 | 169 | 161 | 161 |
| 81 | Abdías 1:12-15 | No te alegres del mal ajeno | 142 | 119 | 156 | 125 | 123 |
| 82 | Jonás 2:1-7 | Orar desde lo más profundo | 135 | 134 | 165 | 150 | 152 |
| 83 | Miqueas 6:4-8 | Lo que Dios pide de ti | 139 | 152 | 158 | 150 | 141 |
| 84 | Nahum 1:3-7 | Refugio en el día de angustia | 137 | 137 | 139 | 135 | 135 |
| 85 | Sofonías 3:12-17 | Dios se alegra por ti | 130 | 144 | 166 | 155 | 138 |
| 86 | Hageo 2:1-5 | Ánimo para reconstruir | 131 | 124 | 153 | 135 | 130 |
| 87 | Zacarías 4:5-10 | No por fuerza, sino por su Espíritu | 143 | 149 | 168 | 150 | 147 |
| 88 | Malaquías 3:7-11 | Volver a confiar en Dios | 138 | 160 | 166 | 157 | 146 |
| 89 | Hechos 16:27-34 | Esperanza en la noche | 148 | 159 | 164 | 149 | 141 |
| 90 | Efesios 2:3-10 | Salvados por gracia | 150 | 160 | 161 | 161 | 144 |
| 91 | 2 Tesalonicenses 2:15-3:5 | Dios guarda tu corazón | 137 | 144 | 152 | 146 | 141 |
| 92 | Tito 3:1-7 | Salvados por misericordia | 136 | 152 | 134 | 135 | 130 |
| 93 | Filemón 1:10-17 | Recibir al otro como hermano | 130 | 144 | 143 | 151 | 135 |
| 94 | Hebreos 12:1-6 | Correr con perseverancia | 147 | 153 | 155 | 153 | 139 |
| 95 | Santiago 1:1-8 | Sabiduría en medio de las pruebas | 133 | 124 | 134 | 135 | 131 |
| 96 | 2 Pedro 3:8-12 | La paciencia de Dios | 138 | 145 | 157 | 155 | 130 |
| 97 | 2 Juan 1:3-8 | Caminar en amor y verdad | 137 | 144 | 149 | 153 | 133 |
| 98 | 3 Juan 1:7-12 | Imitar lo bueno | 141 | 142 | 141 | 141 | 121 |
| 99 | Judas 1:17-25 | Dios puede sostenerte | 146 | 148 | 156 | 158 | 156 |
| 100 | Apocalipsis 3:15-20 | La tibieza y la puerta que Jesús llama | 144 | 145 | 159 | 158 | 138 |
