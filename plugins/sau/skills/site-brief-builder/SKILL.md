---
name: site-brief-builder
description: "Úsala PRIMERO, antes que cualquier otra skill de SEO, para crear el brief del sitio (el archivo al que apunta `brief` en el perfil, `site-brief.md` por defecto) que leen las demás skills de SAU. Rastrea la web y entrevista al usuario solo sobre lo que no pudo averiguar. Úsala también para actualizar o corregir un brief existente, o cuando otra skill de SEO avisa de que falta site-brief.md."
---

# Site Brief Builder

> **Antes de nada:** lee el perfil `.sau/site.json` (ver `running-sau`): de él salen `brief`, `output_dir`, `locale`, `code_repo_path` y el resto de rutas. Los scripts se invocan como `${CLAUDE_PLUGIN_ROOT}/skills/site-brief-builder/scripts/…` con el intérprete `py` o `python3` (el que exista).

## Para qué sirve

Las demás skills de SEO son genéricas. Este archivo las adapta a un negocio concreto. Sin él, las skills adivinan la ubicación, los servicios, el lector y la voz. El resultado suena como cualquier otra página escrita por una IA.

Esta skill escribe ese archivo por el usuario. No le entrega un formulario vacío.

## Antes de empezar

No hace falta nada. Un conector de DataForSEO ayuda, pero no es obligatorio.

Si ya existe el archivo que indica `brief` en el perfil, léelo primero. Ofrece actualizarlo en lugar de empezar de cero. Al actualizarlo:

- Aplica las marcas de este documento a todos los campos.
- Añade la sección "Cómo leer este brief" de la plantilla, si falta.
- Traduce al español lo que quede en inglés.

## Las marcas del brief

Cada dato del brief lleva una marca. La marca decide qué puede hacer cada skill con ese dato.

| Marca | Qué significa | Cuándo la pones |
|---|---|---|
| Sin marca | Dato confirmado y publicable. | El usuario lo confirmó y se puede publicar. |
| `[PRIVADO]` | Dato real, solo para uso interno. El modelo lo sabe, pero nunca lo publica. | El usuario lo marca como privado, o el dato está en la lista de privados por defecto. |
| `[HIPÓTESIS]` | El usuario no sabe el dato y permite suponerlo. | Preguntaste, el usuario no lo sabe y aceptó tu suposición. |
| `[OBJETIVO]` | Todavía no es así, pero el negocio quiere llegar ahí. | El usuario describe una situación que quiere alcanzar. |
| `⚠️ CONTEXTO INCOMPLETO` | El usuario no sabe el dato y no permite suponerlo. | Preguntaste, el usuario no lo sabe y no aceptó suponerlo. |
| `⚠️ verificar` | Lo dedujiste de la web. El usuario no lo ha revisado. | Durante el borrador. |
| `⚠️ FALTA DATO` | Nadie tiene el dato todavía. | Durante el borrador, antes de preguntar. |

**Privados por defecto.** Marca estos datos como `[PRIVADO]`, salvo que el usuario diga lo contrario:

- Precio actual y márgenes.
- Valor de un cliente e ingresos.
- Lista de competidores.
- Estrategia SEO: resultado que busca, servicio prioritario y páginas de negocio (money pages).
- Herramientas y procesos internos, como el CRM.
- Nombres de clientes sin permiso expreso para citarlos.

**Un campo puede tener dos valores.** Si la situación actual y la deseada son distintas, escribe las dos. Ejemplo:

```
- **Posicionamiento de precio:**
  - `[PRIVADO]` Hoy: medio-bajo.
  - `[OBJETIVO]` Alto.
```

**Límites de `[HIPÓTESIS]`.** Nunca la uses para cifras, resultados, reseñas ni certificaciones. Esos datos están confirmados o en `⚠️ CONTEXTO INCOMPLETO`. Cada hipótesis dice qué supone el modelo, la fecha y, si el usuario la aprueba, la formulación pública exacta.

**Notas internas.** Las fechas de confirmación, los hallazgos y las incoherencias de la web son notas para el equipo. Escríbelas como "Nota interna:". Ninguna skill las publica.

## Proceso

### Paso 1 — Pide la URL y ve a mirar

Pide solo la URL de la web. No preguntes nada más todavía.

Después, reúne lo que puedas por tu cuenta:

- Lee la home, la página "sobre nosotros", las páginas de servicios o productos y dos o tres de los posts más recientes del blog.
- Prueba `/sitemap.xml` para ver el inventario de páginas. Si devuelve HTML en lugar de XML, anota que el sitemap falta o está roto. Es un hallazgo que merece la pena reportar.
- Si hay un conector de DataForSEO, usa la API **On-Page** (`on_page/content_parsing` o `on_page/instant_pages`) para extraer el contenido más limpio.
- Busca el nombre del negocio, los servicios, las zonas donde trabaja, el teléfono y la dirección, las certificaciones, los premios, los autores con nombre y el schema existente.
- Si hay un conector de DataForSEO, busca la ficha de Google Business del negocio (`business_data/business_listings/search`). Anota el nombre, la dirección, el teléfono y las reseñas tal como aparecen. Compáralos con la web: cada diferencia es un hallazgo.
- Anota los perfiles oficiales (LinkedIn, redes, directorios) que enlaza la web o su schema.
- Lee el tono: longitud de frase, primera persona singular o plural, tuteo o usted, frases que se repiten y palabras que evitan.

### Paso 2 — Redacta el borrador con pruebas

Rellena cada campo que puedas con lo que leíste de verdad. Escribe el borrador en la ruta `brief` del perfil con la plantilla del final de este documento.

**Marca con `⚠️ verificar` cada campo que dedujiste.** El usuario debe ver de un vistazo qué supusiste.

**Aplica ya los privados por defecto.** Pon `[PRIVADO]` en los datos de esa lista.

**Nunca inventes:** cifras reales del negocio, resultados de casos de estudio, certificaciones, premios, años en el mercado, tamaño del equipo ni número de reseñas. Si no lo leíste en la web, marca el campo con `⚠️ FALTA DATO` y pregunta.

### Paso 3 — Entrevista solo sobre los huecos

Pregunta por lo que no pudiste averiguar. Haz dos o tres preguntas cada vez, no un formulario largo. Sigue este orden de prioridad, porque estos campos cambian más el resultado:

1. **País e idioma de los datos de búsqueda.** Un valor erróneo devuelve volúmenes erróneos en todas las skills posteriores, sin avisar. Si la web no deja claro el mercado, pregunta siempre.
2. **Qué vende el negocio de verdad, en una frase.** Las webs lo esconden.
3. **El lector y qué le da miedo.** Esto decide el enfoque de todo el contenido.
4. **Pruebas reales:** cifras, resultados y certificaciones que el negocio puede usar de verdad.
5. **Precio y posicionamiento:** dónde está hoy (`[PRIVADO]`) y dónde quiere llegar (`[OBJETIVO]`).
6. **Competidores, en dos listas:**
   - **De negocio:** tres dominios con los que el negocio compite por un cliente. Pregunta al usuario.
   - **De búsqueda:** los dominios que ganan hoy cada grupo de búsquedas. No los preguntes: sácalos de la SERP de los servicios principales, si hay conector de DataForSEO. Si no lo hay, marca la tabla con `⚠️ FALTA DATO`. `keyword-fanout-map` propondrá los dominios después, y el usuario decide si se añaden.
   - Si un competidor de negocio no aparece en ninguna SERP, díselo al usuario. No lo borres sin su permiso.
7. **Qué decir / qué no decir.** Pregunta directamente: "¿Hay palabras o frases que nunca quieras usar?". Esta tabla frena el contenido genérico más que cualquier otra parte del brief.
8. **Identidad del autor y credenciales,** para las bios de autor y E-E-A-T.
9. **La CTA y qué pasa después del clic.**
10. **Objetivos del negocio:** qué situación quiere alcanzar el negocio y todavía no tiene.
11. **Movimiento:** intensidad de las animaciones (`sobria`, `media` o `expresiva`) y páginas que no deben moverse. Lo usa `motion-director`. Si el usuario no lo sabe, propón `sobria`.
12. **Fórmulas aprobadas sobre la empresa:** cómo se describen las relaciones con socios y empresas participadas, los programas y la ubicación. Las skills usan solo estas fórmulas, y `onpage-optimizer` marca como fallo cualquier versión distinta.
13. **Presencia fuera de la web:** confirma los datos de la ficha de Google y decide si el teléfono se publica. La decisión se aplica igual en la web, el schema y la ficha.

Para cada respuesta, decide la marca:

- **El usuario sabe el dato.** Si el dato es sensible o está en la lista de privados por defecto, pregunta si se puede publicar. Si no se puede, marca `[PRIVADO]`.
- **El usuario describe algo que quiere alcanzar.** Marca `[OBJETIVO]`. Si el dato actual es distinto, anótalo también, normalmente como `[PRIVADO]`.
- **El usuario no sabe el dato.** Propón una suposición concreta y pregunta: "¿Me dejas suponerlo?".
  - Si acepta, marca `[HIPÓTESIS]`. Anota la suposición, la fecha y la formulación pública, si la hay.
  - Si no acepta, marca `⚠️ CONTEXTO INCOMPLETO`.
  - Para cifras, resultados, reseñas y certificaciones, no ofrezcas suponer. Marca `⚠️ CONTEXTO INCOMPLETO`.

### Paso 4 — Confirma y guarda

Enseña el brief completo. Pide al usuario que corrija todo lo marcado con `⚠️ verificar`. Pide también que revise las marcas `[PRIVADO]`, `[HIPÓTESIS]` y `[OBJETIVO]`.

Guarda la versión final en la ruta `brief` del perfil (en el repositorio privado del sitio).

Después, dile al usuario:

> El brief queda en esa ruta. Todas las skills lo leen desde ahí sin que tengas que pegarlo otra vez. Un perfil y un brief por web.

## Reglas

- Un solo archivo, no dos. Primero la parte de negocio, después la parte de voz.
- Markdown simple. Esta skill no genera un panel HTML: el resultado es un archivo que leen las otras skills y que edita una persona.
- Escribe el brief en español. Mantén en su idioma original las citas literales, los títulos de páginas y los términos técnicos que usa la propia web.
- Nunca dejes un campo vacío sin avisar. Cada campo tiene un valor real o una marca.
- Todo brief incluye la sección "Cómo leer este brief" de la plantilla, sin cambios. Así las demás skills conocen las marcas sin leer esta skill.
- Mantén la sección "Datos abiertos" al día: lista todos los datos con `⚠️ CONTEXTO INCOMPLETO` o `[HIPÓTESIS]`.
- No rellenes la sección de voz con adjetivos que no observaste. "Cercano, respetuoso, competente" solo si el texto de la web suena así.

## Salida

El archivo de la ruta `brief` del perfil.

Dile al usuario el siguiente paso:

> Siguiente paso: ejecuta `keyword-fanout-map` con una palabra clave semilla o solo con el tipo de negocio. No tendrás que repetir nada de lo que dice este brief.

## Plantilla

Esta plantilla sustituye a `templates/site-brief.md.template`. Copia la sección "Cómo leer este brief" sin cambios.

````markdown
# Site brief — {{BUSINESS_NAME}}

> Lo leen: keyword-fanout-map · seo-content-writer · onpage-optimizer ·
> internal-link-architect · ai-visibility-checker
>
> Última actualización: {{LAST_UPDATED}}

---

## Cómo leer este brief

Cada dato lleva una marca. La marca decide qué puede hacer una skill con ese dato.

| Marca | Qué significa | Qué hace la skill |
|---|---|---|
| Sin marca | Dato confirmado. | Lo usa y lo puede publicar. |
| `[PRIVADO]` | Dato real, solo para uso interno. | Lo usa para decidir. Nunca lo publica, ni con otras palabras, ni de forma que el lector lo pueda deducir. |
| `[HIPÓTESIS]` | El usuario no sabe el dato y permite suponerlo. | Trabaja con la suposición. No la publica como hecho comprobado, salvo con la formulación pública que el usuario aprobó. Al final de cada entrega, lista las hipótesis que usó. |
| `[OBJETIVO]` | Todavía no es así. El negocio quiere llegar ahí. | Orienta el tono y los argumentos hacia el objetivo. Nunca lo presenta como la situación actual. Nunca lo publica. |
| `⚠️ CONTEXTO INCOMPLETO` | El usuario no sabe el dato y no permite suponerlo. | No lo usa y no lo rellena. |
| `⚠️ verificar` | La skill lo dedujo de la web. El usuario no lo ha revisado. | No lo publica hasta que el usuario lo confirme. |
| `⚠️ FALTA DATO` | Nadie tiene el dato todavía. | Pregunta al usuario. |

Tres reglas más:

- Si un campo tiene un valor `[PRIVADO]` y otro `[OBJETIVO]`, el contenido sigue la dirección del objetivo y no publica ninguno de los dos.
- `[HIPÓTESIS]` nunca cubre cifras, resultados, reseñas ni certificaciones. Esos datos están confirmados o en `⚠️ CONTEXTO INCOMPLETO`.
- Las fechas de confirmación y las notas internas son para el equipo. Ninguna skill las publica.

---

## Datos abiertos

<!-- Lista todos los datos con ⚠️ CONTEXTO INCOMPLETO o [HIPÓTESIS]. Si no hay ninguno, escribe "Ninguno a {{LAST_UPDATED}}". -->

**`⚠️ CONTEXTO INCOMPLETO`:** el usuario no los sabe y no permite suponerlos. Ninguna skill los usa ni los rellena.

1. {{OPEN_ITEM_1}}

**`[HIPÓTESIS]`:** el usuario no los sabe y permite suponerlos.

1. {{HYPOTHESIS_1}}

---

## Parte 1 — Negocio

- **Nombre del negocio:** {{BUSINESS_NAME}}
- **Dominio:** {{DOMAIN}}
- **Sector / nicho:** {{INDUSTRY}}
- **Qué vende de verdad (una frase):** {{WHAT_THEY_SELL}}
- **Posicionamiento de precio:**
  - `[PRIVADO]` Hoy: {{PRICE_POSITIONING_NOW}}  <!-- bajo / medio-bajo / medio / alto -->
  - `[OBJETIVO]` {{PRICE_POSITIONING_TARGET}}  <!-- Borra esta línea si no hay un objetivo distinto. -->
  - Uso en el contenido: {{PRICE_CONTENT_RULE}}

### Servicios o productos

<!-- Los que importan para el SEO, el más importante primero. -->
1. {{SERVICE_1}}
2. {{SERVICE_2}}
3. {{SERVICE_3}}

**Páginas de negocio (money pages)** `[PRIVADO]`: las URLs que generan ingresos. Los enlaces internos se priorizan hacia ellas.

- {{MONEY_PAGE_1}}
- {{MONEY_PAGE_2}}

### Zona de servicio

- **Ubicación principal:** {{PRIMARY_LOCATION}}
- **Ciudades, municipios o regiones que importan:** {{LOCATIONS_LIST}}
- **País para los datos de búsqueda:** {{SEARCH_COUNTRY}}
- **Idioma para los datos de búsqueda:** {{SEARCH_LANGUAGE}}

> Estos dos últimos datos son críticos. Un valor erróneo devuelve volúmenes de
> búsqueda erróneos en todas las skills, sin ningún mensaje de error.

### Competidores `[PRIVADO]`

La lista es interna. El contenido nunca presenta a estas empresas como competidores del negocio.

**De negocio** (con quién compite el negocio por un cliente):

1. {{COMPETITOR_1}}
2. {{COMPETITOR_2}}
3. {{COMPETITOR_3}}

**De búsqueda** (quién gana hoy cada grupo de búsquedas en Google y en las respuestas de IA). Comprobado en la SERP el {{SERP_CHECK_DATE}}:

| Grupo de búsquedas | Dominios que ganan |
|---|---|
| {{SEARCH_CLUSTER_1}} | {{SEARCH_COMPETITORS_1}} |

<!-- Las dos listas pueden no coincidir. keyword-fanout-map y ai-visibility-checker proponen cambios; el usuario decide. -->

### Vocabulario de búsqueda

<!-- Cómo lee Google cada término. Lo comprueba keyword-fanout-map en la SERP. -->

| Usar | Evitar como palabra principal | Por qué (qué muestra Google) |
|---|---|---|
| {{SEARCH_TERM_USE_1}} | {{SEARCH_TERM_TRAP_1}} | {{SEARCH_TERM_REASON_1}} |

### Estrategia

- **Resultado que busca el SEO:** `[PRIVADO]` {{PRIMARY_GOAL}}
- **Servicio que el SEO empuja primero:** `[PRIVADO]` {{SEO_PRIORITY}}
- **Valor aproximado de un cliente:** `[PRIVADO]` {{CUSTOMER_VALUE}}
- **Qué NO hace este negocio:** {{WILL_NOT_DO}}

### Objetivos del negocio

<!-- Situaciones que todavía no son reales y que el negocio quiere alcanzar. Cada línea lleva [OBJETIVO]. Si hay un dato actual distinto, indica dónde está. Si no hay ninguno, escribe "Ningún objetivo declarado a {{LAST_UPDATED}}". -->
- `[OBJETIVO]` {{BUSINESS_OBJECTIVE_1}}

### Pruebas y activos

Solo datos verdaderos y, a ser posible, ya publicados. Estos datos alimentan el contenido y las citas de la IA. Una afirmación inventada aquí contamina todo lo que viene después.

- **Cifras reales que el negocio puede usar:** {{REAL_NUMBERS}}
- **Casos de estudio y resultados que existen de verdad:** {{CASE_STUDIES}}
- **Certificaciones, premios, asociaciones y membresías:** {{CERTIFICATIONS}}
- **Años en el mercado / tamaño del equipo:** {{LONGEVITY}}
- **Fórmulas aprobadas sobre la empresa:** {{ENTITY_WORDING}} <!-- Frases exactas para relaciones, programas y ubicación. Ejemplo: "socio tecnológico de Empresa Ejemplo". Las skills no usan otra versión. -->

### Identidad del autor (para las bios de autor y E-E-A-T)

- **A quién se atribuye la autoría:** {{AUTHOR_NAME}}
- **Sus credenciales, en una línea:** {{AUTHOR_CREDENTIALS}}
- **URL de la página de autor:** {{AUTHOR_URL}}

### La llamada a la acción (CTA)

- **CTA principal:** {{PRIMARY_CTA}}
- **A dónde lleva:** {{CTA_URL}}
- **Qué pasa después del clic:** {{CTA_OUTCOME}}
- **Teléfono:** {{PHONE}}
- **Dirección (exactamente como debe aparecer en todas partes):** {{ADDRESS}}

### Presencia fuera de la web

<!-- La usan onpage-optimizer (NAP y schema sameAs) y ai-visibility-checker (acciones fuera de la web). Las cifras solo como las devuelve la fuente, con fecha. -->

- **Ficha de Google Business:** {{GBP_URL}}
  - Nombre, dirección y teléfono tal como aparecen en la ficha: {{GBP_NAP}}
  - ¿Coinciden con la dirección y el teléfono de arriba?: {{GBP_NAP_MATCH}}
  - Reseñas (número y nota, con fecha de consulta): {{GBP_REVIEWS}}
- **Perfiles oficiales (para `sameAs`):** {{SAME_AS_PROFILES}}
- **Directorios donde aparece:** {{DIRECTORIES}}
- **Menciones en prensa o en webs de terceros:** {{THIRD_PARTY_MENTIONS}}

---

## Parte 2 — Voz

### Tono en tres palabras

{{TONE_THREE_WORDS}}

### El lector

- **Quién lee:** {{READER_WHO}}
- **Nivel de lectura:** {{READING_LEVEL}}
- **Qué le da miedo:** {{READER_FEARS}}
- **Qué le haría confiar en este negocio:** {{READER_TRUST}}

### Qué decir / qué no decir

<!-- La tabla de más valor de este archivo. Añade filas libremente. -->

| Siempre | Nunca |
|--------|-------|
| {{SAY_1}} | {{DONT_SAY_1}} |
| {{SAY_2}} | {{DONT_SAY_2}} |
| {{SAY_3}} | {{DONT_SAY_3}} |

### Estilo de frase

- **Persona:** {{PERSON}}  <!-- p. ej., primera persona del plural: "nosotros", "nuestro equipo" -->
- **Tratamiento:** {{FORM_OF_ADDRESS}}  <!-- tú / usted -->
- **Humor:** {{HUMOUR}}
- **Longitud de frase:** {{SENTENCE_LENGTH}}
- **Qué hacer o no hacer siempre en la estructura:** {{STYLE_RULES}}

### Palabras del propio negocio

<!-- Cita frases reales de la web o del dueño. El redactor las repetirá. -->

{{OWN_WORDS}}

### Movimiento
<!-- Lo usa motion-director (paso 2b). Reglas y catálogo: skill `motion-director` del plugin sau. -->

- **Intensidad:** {{MOTION_INTENSITY}} <!-- sobria | media | expresiva. Sin dato: sobria. -->
- **Páginas sin animación:** {{MOTION_EXCLUDED}} <!-- rutas, o "ninguna" -->
- **Vídeo de motion graphics en páginas de servicio:** {{MOTION_VIDEO}} <!-- sí, proponer | no -->

---

## Reglas de contenido obligatorias

Cosas que ninguna skill puede hacer nunca en este sitio:

- {{HARD_RULE_1}}
- {{HARD_RULE_2}}
- Nunca publicar un dato `[PRIVADO]`. Nunca presentar un `[OBJETIVO]` como la situación actual.
- Nunca inventar estadísticas, resultados, reseñas ni credenciales.
- Nunca citar una fuente que la skill no haya consultado y confirmado en esa misma ejecución.
````

## Credits

Original: Galileo Studio internal SEO skills (seo-auto-upgrade), adapted for the sau plugin.
