# Plantillas de publicación

Copia cada bloque en **Ajustes → Plantillas de publicación**, elige el formato y el idioma correspondientes y guarda esa pestaña. Los textos se usarán en la próxima generación del video; este documento no modifica las plantillas que ya hayas guardado.

En los **videos largos**, la primera línea de cada bloque es el **título** y el resto, después de la línea en blanco, es la **descripción**. Ambos se generan en el mismo archivo de publicación. En YouTube, copia esa primera línea en el campo de título y el resto en la descripción; donde se utilice un solo texto, la primera línea funciona como apertura. Los títulos no incorporan hashtags: estos quedan en la descripción.

Las propuestas presentan la experiencia real del video: escuchar el pasaje y seguir su lectura. Las aperturas buscan despertar curiosidad sin atribuir al episodio una explicación, una enseñanza específica o una promesa que el contenido no ofrece. Las versiones en inglés, español y portugués están adaptadas a cada idioma.

Los archivos de salida se ordenan para publicar: `0-short.mp4` o `0-episode.mp4` y `0-thumbnail.jpg`, seguidos de `1-instagram.txt`, `2-facebook.txt`, `3-youtube.txt`, `4-tiktok.txt` y `5-x.txt`. En videos largos no se genera Instagram; se conserva la misma numeración para las demás redes.

## Variables y uso

- `{reference}`: referencia del pasaje seleccionado, con su rango de capítulos o versículos.
- `{version}`: nombre de la versión de la Biblia.
- `{passage_url}`: enlace al inicio del pasaje en el idioma y la versión del proyecto. Por ejemplo, `https://veobible.com/es/rv1909/genesis/3` si empieza en el versículo 1, o `https://veobible.com/es/rv1909/genesis/3#13` si empieza en el versículo 13.
- `{hashtags}`: hashtags calculados según el idioma, libro, temas del pasaje, formato y red social. Puedes reemplazar esta variable por una selección propia. En X se propone solo `#VeoBible` para dejar más espacio al mensaje.
- `{title}`: título visual que ya utiliza el video. Sigue disponible, aunque estas propuestas usan una apertura editorial propia.
- `{passage}`: todos los versículos seleccionados, uno por línea. Es opcional; estas propuestas invitan a escuchar o a leer en el enlace, sin repetir el pasaje completo en la descripción.

Una plantilla vacía omite su archivo. Las direcciones, llamadas a la acción y hashtags escritos como texto se pueden editar. Las descripciones de videos largos incluyen siempre `{passage_url}`. Revisa el título generado antes de publicar, especialmente cuando la referencia abarque varios libros o sea extensa.

## Videos cortos

### Inglés

#### Instagram

```text
A little less scrolling. A little more listening. 📖

Take a moment with {reference}, read from {version}. Follow the words on screen and let the passage speak for itself.

Save this reading for a quieter moment.

More to explore: https://veobible.com

{hashtags}
```

#### Facebook

```text
What will you notice when you pause to listen?

Today's reading is {reference} · {version}. A short moment with the Bible, with the words on screen so you can follow along.

Which part stayed with you? We'd love to hear it in the comments.

Keep reading: https://veobible.com

{hashtags}
```

#### YouTube

```text
Pause the scroll. Listen to {reference}.

A moment with the Bible in the middle of your day. Listen to {reference} in {version} and follow the passage on screen.

Subscribe to VeoBible for more short Bible readings.

Read more: https://veobible.com

{hashtags}
```

#### TikTok

```text
Before the next swipe, take a moment to listen. 🎧

{reference} · {version}

Which words caught your attention?

More readings: veobible.com

{hashtags}
```

#### X

```text
A pause in your feed. A passage to listen to.

{reference} · {version}

What stays with you after listening?

https://veobible.com
#VeoBible
```

### Español

#### Instagram

```text
Menos scroll. Un momento para escuchar. 📖

Haz una pausa con {reference}, en {version}. Sigue las palabras en pantalla y deja que el pasaje hable por sí mismo.

Guarda esta lectura para volver a ella con calma.

Sigue explorando: https://veobible.com

{hashtags}
```

#### Facebook

```text
¿Qué descubres cuando te detienes a escuchar?

Hoy leemos {reference} · {version}. Un momento con la Biblia, con el texto en pantalla para acompañar la lectura.

¿Qué parte se quedó contigo? Te leemos en los comentarios.

Continúa leyendo: https://veobible.com

{hashtags}
```

#### YouTube

```text
Detén el scroll. Escucha {reference}.

Un momento con la Biblia en medio de tu día. Escucha {reference} en {version} y acompaña la lectura con el texto en pantalla.

Suscríbete a VeoBible para descubrir más pasajes en videos cortos.

Sigue leyendo: https://veobible.com

{hashtags}
```

#### TikTok

```text
Antes de deslizar, escucha un momento. 🎧

{reference} · {version}

¿Qué palabras llamaron tu atención?

Más lecturas: veobible.com

{hashtags}
```

#### X

```text
Una pausa en tu feed. Un pasaje para escuchar.

{reference} · {version}

¿Con qué palabras te quedas?

https://veobible.com
#VeoBible
```

### Portugués

#### Instagram

```text
Menos rolagem. Mais espaço para ouvir. 📖

Faça uma pausa com {reference}, na versão {version}. Acompanhe as palavras na tela e deixe a passagem falar por si.

Salve esta leitura para ouvir de novo com calma.

Continue explorando: https://veobible.com

{hashtags}
```

#### Facebook

```text
O que você percebe quando para para ouvir?

A leitura de hoje é {reference} · {version}. Um momento com a Bíblia, com o texto na tela para você acompanhar.

Que trecho ficou com você? Conte nos comentários.

Continue lendo: https://veobible.com

{hashtags}
```

#### YouTube

```text
Pare um instante. Ouça {reference}.

Um momento com a Bíblia no meio do seu dia. Ouça {reference} na versão {version} e acompanhe a leitura com o texto na tela.

Inscreva-se no VeoBible para descobrir mais passagens em vídeos curtos.

Leia mais: https://veobible.com

{hashtags}
```

#### TikTok

```text
Antes de deslizar, dê um instante à leitura. 🎧

{reference} · {version}

Que palavras chamaram sua atenção?

Mais leituras: veobible.com

{hashtags}
```

#### X

```text
Uma pausa no feed. Uma passagem para ouvir.

{reference} · {version}

Que palavras ficaram com você?

https://veobible.com
#VeoBible
```

## Videos largos

### Inglés

#### YouTube

```text
What will you notice this time? {reference} | Audio Bible

A familiar passage can invite a fresh look. A new one can open a door. Listen to {reference} at an unhurried pace, with the Bible text on screen so you can follow every verse.

This episode is part of The Bible in 365 Days: a journey through Scripture, one reading at a time. Settle in, listen closely, and take a moment afterward to reflect on what you heard.

Reading: {reference}
Bible version: {version}

Read along or return to the opening passage:
{passage_url}

What caught your attention in this reading? Share the verse in the comments, and subscribe to VeoBible to continue the journey.

{hashtags}
```

#### Facebook

```text
Make room to listen: {reference}

Some readings deserve more than a passing glance. Spend a little time with {reference}, narrated in {version}, with the words on screen to follow along.

Part of The Bible in 365 Days, our journey through Scripture one reading at a time. Watch on your own or share a moment of listening with someone close to you.

Open the passage here:
{passage_url}

Which part would you like to talk about after listening?

{hashtags}
```

#### TikTok

```text
Stay a little longer. Listen to {reference}.

Let the next scroll wait. Follow this reading of {reference} in {version}, with the text on screen.

An episode of The Bible in 365 Days. Save it for a moment when you can listen without rushing.

Read the passage:
{passage_url}

{hashtags}
```

#### X

```text
Hear {reference} with fresh ears.

Bible in 365 Days · {version}
Listen, follow the text, and read on:
{passage_url}

#VeoBible
```

### Español

#### YouTube

```text
¿Qué descubrirás al volver a escuchar? {reference} | Biblia en audio

Si ya conoces este pasaje, escúchalo con una mirada nueva. Si es tu primera vez, entra en la lectura sin prisa. Recorremos {reference} con el texto bíblico en pantalla para que puedas seguir cada versículo.

Este episodio forma parte de La Biblia en 365 días: un recorrido por las Escrituras, una lectura a la vez. Busca un momento tranquilo, escucha y date un espacio para reflexionar sobre lo que acabas de leer.

Lectura: {reference}
Versión de la Biblia: {version}

Lee a la par o vuelve al inicio del pasaje:
{passage_url}

¿Qué parte llamó tu atención? Comparte el versículo en los comentarios y suscríbete a VeoBible para continuar el recorrido.

{hashtags}
```

#### Facebook

```text
Hazle un lugar a esta lectura: {reference}

Hay lecturas que merecen algo más que una mirada rápida. Dedica un momento a {reference}, narrado en {version}, con las palabras en pantalla para acompañar cada versículo.

Un episodio de La Biblia en 365 días, nuestro recorrido por las Escrituras una lectura a la vez. Puedes escucharlo a solas o compartir este momento con alguien cercano.

Abre aquí el pasaje:
{passage_url}

¿Qué parte te gustaría conversar después de escuchar?

{hashtags}
```

#### TikTok

```text
Quédate un poco más. Escucha {reference}.

El siguiente video puede esperar. Acompaña esta lectura de {reference} en {version}, con el texto en pantalla.

Un episodio de La Biblia en 365 días. Guárdalo para un momento en el que puedas escuchar sin prisa.

Lee el pasaje:
{passage_url}

{hashtags}
```

#### X

```text
Vuelve a descubrir {reference} al escucharlo.

La Biblia en 365 días · {version}
Escucha, sigue el texto y continúa aquí:
{passage_url}

#VeoBible
```

### Portugués

#### YouTube

```text
O que você vai perceber desta vez? {reference} | Bíblia em áudio

Uma passagem conhecida pode ganhar um novo olhar. Uma leitura nova pode abrir uma porta. Ouça {reference} sem pressa, com o texto bíblico na tela para acompanhar cada versículo.

Este episódio faz parte de A Bíblia em 365 dias: uma jornada pelas Escrituras, uma leitura de cada vez. Encontre um momento tranquilo, ouça com atenção e reserve um espaço para refletir sobre o que acabou de ler.

Leitura: {reference}
Versão da Bíblia: {version}

Leia junto ou volte ao início da passagem:
{passage_url}

O que chamou sua atenção nesta leitura? Compartilhe o versículo nos comentários e inscreva-se no VeoBible para continuar a jornada.

{hashtags}
```

#### Facebook

```text
Abra espaço para esta leitura: {reference}

Algumas leituras merecem mais do que uma olhada rápida. Dedique um momento a {reference}, narrado na versão {version}, com as palavras na tela para acompanhar cada versículo.

Um episódio de A Bíblia em 365 dias, nossa jornada pelas Escrituras uma leitura de cada vez. Ouça no seu tempo ou compartilhe esse momento com alguém próximo.

Abra a passagem aqui:
{passage_url}

Sobre qual trecho você gostaria de conversar depois de ouvir?

{hashtags}
```

#### TikTok

```text
Fique mais um pouco. Ouça {reference}.

O próximo vídeo pode esperar. Acompanhe esta leitura de {reference} na versão {version}, com o texto na tela.

Um episódio de A Bíblia em 365 dias. Salve para um momento em que você possa ouvir sem pressa.

Leia a passagem:
{passage_url}

{hashtags}
```

#### X

```text
Redescubra {reference} ao ouvir.

A Bíblia em 365 dias · {version}
Ouça, acompanhe o texto e continue aqui:
{passage_url}

#VeoBible
```

## Títulos propios para cada episodio

Las plantillas anteriores son reutilizables. Para que el título destaque por el contenido de un episodio concreto, sustituye su primera línea al preparar la publicación por un gancho que realmente aparezca en el pasaje. `{reference}` por sí sola no permite generar ese gancho: el sistema no analiza la trama para escribir títulos ni admite una variable de título editorial por proyecto.

Estos ejemplos muestran el enfoque para los pasajes indicados. Úsalos solo cuando el episodio incluya ese contenido; no los pegues como plantilla general de todos los videos.

| Pasaje | Inglés | Español | Portugués |
| --- | --- | --- | --- |
| Génesis 1–3 | A garden. A choice. A world changed. — Genesis 1–3 | Un jardín, una decisión y un mundo que cambia — Génesis 1–3 | Um jardim, uma escolha e um mundo que muda — Gênesis 1–3 |
| Éxodo 14 | The sea ahead. An army behind. — Exodus 14 | El mar delante. Un ejército detrás. — Éxodo 14 | O mar à frente. Um exército atrás. — Êxodo 14 |
| Lucas 15 | He came home with nothing. His father ran to him. — Luke 15 | Volvió sin nada. Su padre corrió a recibirlo. — Lucas 15 | Voltou sem nada. O pai correu para recebê-lo. — Lucas 15 |
| Juan 20 | The tomb was empty. What happened next? — John 20 | La tumba estaba vacía. ¿Qué pasó después? — Juan 20 | O túmulo estava vazio. O que aconteceu depois? — João 20 |

Elige una escena, una pregunta o un contraste del pasaje, y deja que la lectura desarrolle la respuesta. Si la referencia ocupa demasiado espacio, acorta la frase editorial o reserva el rango detallado para la descripción. En X, revisa también la extensión del texto completo después de sustituir las variables.
