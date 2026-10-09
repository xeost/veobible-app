# Plantillas de publicación

Copia cada bloque en **Ajustes → Plantillas de publicación**, elige el formato y el idioma correspondientes y guarda esa pestaña. Los textos se usarán en la próxima generación del video; este documento no modifica las plantillas que ya hayas guardado.

Las descripciones presentan la lectura como una invitación a compartir un momento con la Biblia. El tono es cercano y tranquilo, con agradecimiento por la compañía y espacio para que cada persona decida cómo participar.

En los **videos largos**, cada bloque incluye dos secciones con encabezados Markdown: `# Title` y `# Description` en inglés, `# Título` y `# Descripción` en español, y `# Título` y `# Descrição` en portugués. Ambos apartados se generan en el mismo archivo. Al publicar, copia el contenido de cada sección en su campo correspondiente, sin los encabezados. Los títulos identifican la serie, el día y el pasaje; los emojis se reservan para las descripciones.

En **YouTube Shorts** también se separan el título y la descripción con estos encabezados, traducidos a cada idioma. En las demás plataformas, los videos cortos llevan únicamente la descripción, sin encabezados de sección.

Los archivos de salida se ordenan para publicar: `0-short.mp4` o `0-episode.mp4` y `0-thumbnail.jpg`, seguidos de `1-instagram.txt`, `2-facebook.txt`, `3-youtube.txt`, `4-tiktok.txt` y `5-x.txt`. En videos largos no se genera Instagram; se conserva la misma numeración para las demás redes.

## Variables y uso

- `{episode}`: número del episodio guardado en el proyecto de video largo, usado como día del recorrido. Por ejemplo, `Día {episode}` se convierte en `Día 1`. Asegúrate de que el proyecto tenga su número de episodio; si falta, la variable queda vacía. No se utiliza en las plantillas de videos cortos.
- `{reference}`: referencia del pasaje seleccionado, con su rango de capítulos o versículos.
- `{version}`: nombre de la versión de la Biblia.
- `{passage_url}`: enlace al inicio del pasaje en el idioma y la versión del proyecto. Por ejemplo, `https://veobible.com/es/rv1909/genesis/3` si empieza en el versículo 1, o `https://veobible.com/es/rv1909/genesis/3#13` si empieza en el versículo 13.
- `{hashtags}`: hashtags calculados según el idioma, libro, temas del pasaje, formato y red social. Puedes reemplazar esta variable por una selección propia. En X se propone solo `#VeoBible` para dejar más espacio al mensaje.
- `{title}`: título visual que ya utiliza el video. Sigue disponible, aunque las plantillas de videos largos construyen su título con el número de episodio y la referencia.
- `{passage}`: todos los versículos seleccionados, uno por línea. Está disponible si deseas añadir el texto bíblico a alguna descripción.

Una plantilla vacía omite su archivo. Las descripciones de videos largos incluyen siempre `{passage_url}`. Revisa la extensión del título y la descripción después de sustituir las variables, especialmente si la referencia abarca varios libros.

## Videos cortos

### Inglés

#### Instagram

```text
Your daily dose of the word of God. 📖

Today we're sharing {reference}, read from {version}, with the words on screen to follow along.

If you'd like to return to this passage another day, you're welcome to save it. Thank you for listening with us.

https://veobible.com

{hashtags}
```

#### Facebook

```text
We're glad to share this reading with you.

Your daily dose of the word of God.

{reference} · {version}

A short Bible passage to listen to and reflect on in your own time. If you'd like to share a thought, we'd be happy to read it.

More readings at https://veobible.com

{hashtags}
```

#### YouTube

```text
# Title

{reference} | A moment with the Bible

# Description

Your daily dose of the word of God.

Welcome to VeoBible. Today we're sharing {reference} in {version}, with the text on screen so you can follow the reading.

We hope you'll enjoy spending this time with Scripture. You'll find more readings on our channel whenever you'd like to join us again.

https://veobible.com

{hashtags}
```

#### TikTok

```text
Your daily dose of the word of God. 📖

{reference} · {version}

The words are on screen if you'd like to read along. Thank you for being here.

veobible.com

{hashtags}
```

#### X

```text
Today we're sharing {reference}, read from {version}.

Your daily dose of the word of God. Thank you for listening with us.

https://veobible.com
#VeoBible
```

### Español

#### Instagram

```text
Tu dosis diaria de la palabra de Dios. 📖

Hoy compartimos {reference}, en {version}, con las palabras en pantalla para acompañar la lectura.

Si te gustaría volver a este pasaje otro día, puedes guardarlo. Gracias por compartir este momento con nosotros.

https://veobible.com

{hashtags}
```

#### Facebook

```text
Nos alegra compartir esta lectura contigo.

Tu dosis diaria de la palabra de Dios.

{reference} · {version}

Un breve pasaje de la Biblia para escuchar y reflexionar a tu ritmo. Si te apetece compartir alguna reflexión, nos gustará leerte.

Más lecturas en https://veobible.com

{hashtags}
```

#### YouTube

```text
# Título

{reference} | Un momento con la Biblia

# Descripción

Tu dosis diaria de la palabra de Dios.

Te damos la bienvenida a VeoBible. Hoy compartimos {reference} en {version}, con el texto en pantalla para acompañar la lectura.

Esperamos que disfrutes este tiempo con las Escrituras. En el canal encontrarás más lecturas cuando quieras volver a acompañarnos.

https://veobible.com

{hashtags}
```

#### TikTok

```text
Tu dosis diaria de la palabra de Dios. 📖

{reference} · {version}

El texto está en pantalla por si quieres seguir la lectura. Gracias por estar aquí.

veobible.com

{hashtags}
```

#### X

```text
Hoy compartimos {reference}, en {version}.

Tu dosis diaria de la palabra de Dios. Gracias por acompañarnos en la lectura.

https://veobible.com
#VeoBible
```

### Portugués

#### Instagram

```text
Sua dose diária da palavra de Deus. 📖

Hoje compartilhamos {reference}, na versão {version}, com as palavras na tela para acompanhar a leitura.

Se quiser voltar a esta passagem outro dia, você pode salvá-la. Obrigado por compartilhar este momento conosco.

https://veobible.com

{hashtags}
```

#### Facebook

```text
É uma alegria compartilhar esta leitura com você.

Sua dose diária da palavra de Deus.

{reference} · {version}

Uma breve passagem da Bíblia para ouvir e refletir no seu tempo. Se quiser compartilhar uma reflexão, vamos gostar de ler.

Mais leituras em https://veobible.com

{hashtags}
```

#### YouTube

```text
# Título

{reference} | Um momento com a Bíblia

# Descrição

Sua dose diária da palavra de Deus.

Boas-vindas ao VeoBible. Hoje compartilhamos {reference} na versão {version}, com o texto na tela para acompanhar a leitura.

Esperamos que você aproveite este tempo com as Escrituras. Há mais leituras no canal para quando quiser nos acompanhar novamente.

https://veobible.com

{hashtags}
```

#### TikTok

```text
Sua dose diária da palavra de Deus. 📖

{reference} · {version}

O texto está na tela, caso você queira acompanhar a leitura. Obrigado por estar aqui.

veobible.com

{hashtags}
```

#### X

```text
Hoje compartilhamos {reference}, na versão {version}.

Sua dose diária da palavra de Deus. Obrigado por nos acompanhar na leitura.

https://veobible.com
#VeoBible
```

## Videos largos

### Inglés

#### YouTube

```text
# Title

The Bible in 365 Days | Day {episode} | {reference}

# Description

Welcome to day {episode} of The Bible in 365 Days. We're glad to share this reading with you.

Today we read {reference} in {version}, with the Bible text on screen. You can listen and read along in your own time, whether this passage is familiar or new to you.

📖 The passage is also available here:
{passage_url}

This series is a journey through the Bible, one reading at a time. Each episode is here for whenever you'd like to continue. If you'd like to share a thought about today's passage, you're welcome to leave a comment.

Thank you for spending this time with us.

{hashtags}
```

#### Facebook

```text
# Title

The Bible in 365 Days | Day {episode} | {reference}

# Description

We're sharing day {episode} of The Bible in 365 Days: {reference}, read from {version}.

The text appears on screen so you can read along with the narration. We hope this reading can be a welcome companion in your day.

📖 You can also read the passage here:
{passage_url}

If you'd like to share a reflection, we'd be glad to hear it. Thank you for joining us.

{hashtags}
```

#### TikTok

```text
# Title

The Bible in 365 Days | Day {episode} | {reference}

# Description

Day {episode} of The Bible in 365 Days. 📖

Today we're sharing {reference} in {version}, with the text on screen to follow along.

If you'd like to read the passage in your own time:
{passage_url}

Thank you for being part of this journey.

{hashtags}
```

#### X

```text
# Title

The Bible in 365 Days | Day {episode} | {reference}

# Description

Today's reading: {reference} · {version}.

Thank you for joining us. The passage is here if you'd like to read along:
{passage_url}

#VeoBible
```

### Español

#### YouTube

```text
# Título

La Biblia en 365 días | Día {episode} | {reference}

# Descripción

Te damos la bienvenida al día {episode} de La Biblia en 365 días. Nos alegra compartir esta lectura contigo.

Hoy leemos {reference} en {version}, con el texto bíblico en pantalla. Puedes escuchar y seguir la lectura a tu ritmo, tanto si ya conoces este pasaje como si te acercas a él por primera vez.

📖 El pasaje también está disponible aquí:
{passage_url}

Esta serie propone recorrer la Biblia una lectura a la vez. Cada episodio queda disponible para cuando quieras continuar. Si te gustaría compartir alguna reflexión sobre la lectura de hoy, puedes dejarla en los comentarios.

Gracias por compartir este tiempo con nosotros.

{hashtags}
```

#### Facebook

```text
# Título

La Biblia en 365 días | Día {episode} | {reference}

# Descripción

Compartimos el día {episode} de La Biblia en 365 días: {reference}, en {version}.

El texto aparece en pantalla para que puedas acompañar la narración. Esperamos que esta lectura sea una buena compañía en algún momento de tu día.

📖 También puedes leer el pasaje aquí:
{passage_url}

Si te apetece compartir una reflexión, nos alegrará leerte. Gracias por acompañarnos.

{hashtags}
```

#### TikTok

```text
# Título

La Biblia en 365 días | Día {episode} | {reference}

# Descripción

Día {episode} de La Biblia en 365 días. 📖

Hoy compartimos {reference} en {version}, con el texto en pantalla para acompañar la lectura.

Si quieres leer el pasaje a tu ritmo:
{passage_url}

Gracias por ser parte de este recorrido.

{hashtags}
```

#### X

```text
# Título

La Biblia en 365 días | Día {episode} | {reference}

# Descripción

La lectura de hoy: {reference} · {version}.

Gracias por acompañarnos. El pasaje está aquí por si quieres seguir la lectura:
{passage_url}

#VeoBible
```

### Portugués

#### YouTube

```text
# Título

A Bíblia em 365 dias | Dia {episode} | {reference}

# Descrição

Boas-vindas ao dia {episode} de A Bíblia em 365 dias. É uma alegria compartilhar esta leitura com você.

Hoje lemos {reference} na versão {version}, com o texto bíblico na tela. Você pode ouvir e acompanhar a leitura no seu tempo, tanto se já conhece a passagem quanto se está chegando a ela pela primeira vez.

📖 A passagem também está disponível aqui:
{passage_url}

Esta série propõe um percurso pela Bíblia, uma leitura de cada vez. Cada episódio fica disponível para quando você quiser continuar. Se desejar compartilhar uma reflexão sobre a leitura de hoje, fique à vontade para deixar um comentário.

Obrigado por compartilhar este tempo conosco.

{hashtags}
```

#### Facebook

```text
# Título

A Bíblia em 365 dias | Dia {episode} | {reference}

# Descrição

Compartilhamos o dia {episode} de A Bíblia em 365 dias: {reference}, na versão {version}.

O texto aparece na tela para você acompanhar a narração. Esperamos que esta leitura seja uma boa companhia em algum momento do seu dia.

📖 Você também pode ler a passagem aqui:
{passage_url}

Se quiser compartilhar uma reflexão, vamos gostar de ler. Obrigado por nos acompanhar.

{hashtags}
```

#### TikTok

```text
# Título

A Bíblia em 365 dias | Dia {episode} | {reference}

# Descrição

Dia {episode} de A Bíblia em 365 dias. 📖

Hoje compartilhamos {reference} na versão {version}, com o texto na tela para acompanhar a leitura.

Se quiser ler a passagem no seu tempo:
{passage_url}

Obrigado por fazer parte desta jornada.

{hashtags}
```

#### X

```text
# Título

A Bíblia em 365 dias | Dia {episode} | {reference}

# Descrição

A leitura de hoje: {reference} · {version}.

Obrigado por nos acompanhar. A passagem está aqui, caso queira ler junto:
{passage_url}

#VeoBible
```
