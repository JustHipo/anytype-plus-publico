---
version: 2
fecha: 2026-11-19
reemplaza: el diseño de «vistas por superposición» (D-09) y amplía «HTML en vivo» (D-18)
estado: prototipo funcionando en la rama plus/f4-paginas-html; pendiente la aprobación del usuario
---

# Diseño: HTML integrado con Anytype

## Qué se busca

Que una página HTML o un bloque HTML se sientan parte de Anytype y no una ventana pegada encima. Dentro de un HTML se debe poder:

- mostrar una vista nativa completa (tabla, lista, galería, kanban, calendario) de un set, una colección o un tipo;
- referenciar objetos concretos, con su ícono y su nombre siempre al día;
- armar una lista propia con HTML a partir de los datos de Anytype;
- enlazar objetos, documentos y archivos;
- y todo eso también creado por MCP, sin tocar la interfaz.

## La idea central: dos modos según el HTML

| | Modo nativo (por defecto) | Modo aislado |
|---|---|---|
| Cuándo | El HTML no trae scripts | El HTML trae `<script>` o manejadores `on…` |
| Dónde se dibuja | Dentro de la página de Anytype (shadow DOM), sin iframe | En el iframe aislado del Mini App |
| Piezas nativas | Componentes reales de Anytype, en el flujo del HTML | Por datos, con el puente `window.anytype` (fase F4d) |
| Alto | El natural del contenido | Medido; manija para fijarlo, con scroll |
| Tema y fuente | Los hereda de la app | Variables copiadas |
| Scroll, selección, buscar, imprimir, atajos | Los de la app | Los del iframe |

**Por qué dos modos.** Un script que corre dentro de la página de Anytype puede hacer todo lo que hace la persona que la abre: leer la frase de recuperación guardada, borrar espacios, leer otros espacios. En un espacio compartido, ese HTML lo puede haber escrito otra persona. Por eso los scripts solo corren aislados (D-22). A cambio, el HTML sin scripts puede vivir dentro de la página, y ahí las piezas nativas son componentes de verdad.

**Verificado ejecutando (2026-11-19):** una página creada por la API con CSS propio en dos columnas, dos objetos concretos, un enlace y la vista del tipo Task. La vista es el set en línea de Anytype: sus pestañas Today, Completed y All cambian las filas, y tiene búsqueda, filtro, orden y «New Object».

## Etiquetas (el contrato del HTML)

| Etiqueta | Qué muestra | Estado |
|---|---|---|
| `<anytype-view object="ID" view="nombre">` | Vista nativa de un set, colección o tipo | Hecho y probado: tabla, kanban, galería, calendario |
| `<anytype-object object="ID">` | Objeto concreto: ícono y nombre vivos, clic abre | Hecho y probado |
| `<anytype-object object="ID" as="card">` | Tarjeta nativa del objeto | F4b |
| `<anytype-object object="ID" as="embed">` | El documento incrustado completo | F4b |
| `<anytype-prop object="ID" key="estado">` | Una propiedad del objeto, editable con la celda nativa | F4b |
| `<anytype-list source="ID" limit="5" sort="name">…</anytype-list>` | Lista propia: repite el HTML de adentro por cada objeto, con `{{name}}`, `{{url}}` y propiedades | Hecho y probado (datos vivos, CSS del autor) |
| `<a href="anytype://object?objectId=ID">` | Enlace normal a un objeto | Hecho |
| `<img src="anytype://file/ID">` | Imagen guardada en Anytype | Escrito, sin probar |

`ID` es el id del objeto; también se acepta el enlace completo `anytype://object?objectId=…`.

### Cómo funciona `<anytype-view>` (D-21)

- Es el «set en línea» que Anytype ya tiene: un bloque dataview real, guardado como **hijo del bloque HTML**, con el objeto como origen.
- Si el HTML pide una vista que aún no tiene su bloque, el fork lo crea solo la primera vez que alguien con permiso de edición abre la página. Por la API también se puede crear junto con la página (bloque `dataview` con `indent: 1` después del bloque de código).
- El fork no dibuja los hijos del bloque HTML debajo: cada vista aparece solo donde el HTML la pone.
- **Anytype oficial:** ve el código y, debajo, las vistas como sets en línea normales.
- Las vistas (filtros, orden, columnas) son una copia propia de esa página, como en cualquier set en línea: cambiarlas aquí no cambia el set original.
- Se descartó montar el set original directamente: todas las vistas compartirían el mismo identificador interno y los menús de la segunda vista de una página se abrirían sobre la primera.

## Seguridad del modo nativo

- `src/ts/plus/htmlParse.ts` limpia el HTML con DOMPurify: fuera `script`, `iframe`, `form`, `object`, `embed`, `meta`, `base`, `link`, manejadores `on…` y `javascript:`.
- `plus/scripts/probar-sanitizador.mjs` lo prueba dentro del Chromium de la app: 10 pruebas OK, incluida «nada se ejecuta al insertarlo».
- El CSS del autor queda encerrado en el shadow DOM. `html`, `body` y `:root` se reescriben al contenedor. Los `@import` se descartan.
- El contenedor tiene `contain: layout paint`: nada del HTML, ni con `position: fixed`, puede salir del bloque o tapar la app.
- Imágenes externas: la política de la app solo permite una lista de sitios. Las imágenes van como archivos de Anytype o como `data:`.

## MCP: lo verificado contra el fork

Además de la API directa, el camino completo se probó con el MCP oficial (`plus/scripts/mcp.mjs`): `API-create-type`, `API-create-template`, `API-update-type`, `API-create-object` (página con vista hija), `API-patch-object`, `API-get-object` y `API-delete-object`. La guía paso a paso está en [GUIA_HTML_PARA_IA.md](GUIA_HTML_PARA_IA.md).

| Operación | Cómo | Resultado |
|---|---|---|
| Crear página con HTML | `POST /v2/spaces/{s}/objects` con `{"type":"page","properties":{"name":…},"blocks":[{"type":"code","language":"html-vivo","text":…}]}` | OK, el fork la dibuja |
| Crear con markdown | `"markdown": "```html-vivo\n…\n```"` | OK, conserva el lenguaje |
| Leer | `GET …/objects/{id}?include=blocks` | Devuelve `language: "html-vivo"` y `fields.plusHeight` |
| Leer como markdown | `?format=md` | **Pierde el lenguaje**: no usarlo para HTML |
| Editar un trozo | `PATCH` con `{"op":"replace_text","find":…,"replace":…}` | OK, se redibuja solo |
| Reescribir el bloque | `PATCH` con `{"op":"update_block","id":…,"set":{"text":…}}` | OK |
| HTML grande | 539 KB en un bloque | Se crea en 0,1 s y abre en 0,4 s |
| Agregar vistas a un set en línea | `PATCH` con `{"op":"insert_view","block":ID,"name":…,"copy_from":ID_VISTA,"set":{"type":"kanban","group_by":…}}` | OK: kanban, galería y calendario creados y dibujados |
| Ver la estructura | `GET …?include=blocks` | El set en línea aparece como `dataview` con `indent: 1` bajo el bloque `code` |
| Otras ops | `insert_blocks`, `delete_block`, `move_block`, `replace_subtree`, `update_view`, `set_cell`… | Existen; sin probar aquí |

Cuidados:
- Las API keys son de cada instalación: la del Anytype oficial no sirve en Anytype Plus.
- El puerto 31009 lo toma la primera app que arranca.
- Crear no pone fecha de modificación: la página no sale en «Recently edited» hasta un `PATCH`.
- Con el cuerpo `blocks`, el nombre va en `properties.name`.

## Lista para que se sienta nativo

Cada punto se prueba en la app antes de darlo por hecho. Estado: ✅ hecho y probado, 🟡 parcial, ⬜ pendiente.

### Tamaño y forma
| Detalle | Nativo | Aislado |
|---|---|---|
| Alto según el contenido, sin espacio en blanco | ✅ | ✅ |
| Fijar el alto con manija, scroll interno, volver a automático | ✅ (750 → 500 px con scroll) | ✅ |
| Las vistas nativas respetan el ancho de donde están | ✅ tabla, kanban, galería y calendario (desborde 0 px) | no aplica |
| Vista más ancha que su lugar (kanban con muchas columnas, caja angosta) | ✅ confirmado por el usuario: barra de scroll visible y arrastrable, y rueda horizontal; las pestañas pasan a menú desplegable. Anytype oculta su barra normal y la propia solo funciona en la página, por eso el fork muestra una | no aplica |
| Ancho del bloque ajustable y página a ancho completo | ⬜ | ⬜ |
| Se reacomoda al cambiar la ventana o la barra lateral | ⬜ probar | ⬜ probar |

### Carga y estados
| Detalle | Estado |
|---|---|
| Indicador de carga mientras llega una vista | ✅ |
| Mensajes claros: falta el id, objeto sin vistas, objeto borrado | 🟡 |
| HTML vacío: invitación a escribir | 🟡 escrito, sin probar |
| Sin parpadeo al abrir ni al editar | ⬜ probar |
| En modo desarrollo la app a veces queda cargando tras una recarga | conocido; no pasa en la app empaquetada (por verificar) |

### Edición
| Detalle | Estado |
|---|---|
| Ver y ocultar el código; vista al día mientras se escribe | ✅ |
| Deshacer y rehacer cambios de código y de tamaño | ✅ tamaño · ⬜ código |
| Copiar, pegar, duplicar y mover el bloque con sus vistas | ✅ duplicar (la copia conserva lenguaje, texto y su vista con las 6 pestañas) · ⬜ pegar en otra página, mover |
| Insertar un objeto o una vista sin escribir ids: «Copiar para HTML» en los menús | 🟡 agregado al menú del objeto y al de clic derecho; sin probar a mano |
| Editor cómodo para HTML largo | ⬜ evaluar (hoy es el bloque de código) |
| Vistas que el HTML dejó de usar: avisar y ofrecer borrarlas | ⬜ |

### Interacción
| Detalle | Nativo | Aislado |
|---|---|---|
| Clic en un objeto lo abre | ✅ | ✅ |
| Cmd+clic pestaña nueva, Shift+clic popup | ✅ en `<anytype-object>` · ⬜ en `<a>` | ⬜ |
| Vista previa al pasar el mouse | ⬜ | ⬜ |
| Menú de clic derecho sobre un objeto | ⬜ | ⬜ |
| Seleccionar y copiar texto; buscar con Cmd+F | ✅ por construcción, ⬜ probar | solo dentro del iframe |
| Los atajos de la app siguen funcionando | ✅ por construcción, ⬜ probar | ⬜ reenviar teclas |
| El scroll sigue a la página | ✅ | ✅ |

### Apariencia
| Detalle | Nativo | Aislado |
|---|---|---|
| Colores del tema, también con temas nuevos | ✅ hereda las variables | 🟡 copia fija claro y oscuro |
| Misma fuente que la app | ✅ | ⬜ |
| Imprimir y exportar a PDF | ⬜ probar | ⬜ |
| Textos de la interfaz en español e inglés | ✅ `src/ts/plus/text.ts` | ✅ |

### Datos e integración
| Detalle | Estado |
|---|---|
| Nombre e ícono de los objetos siempre al día | ✅ |
| Vistas: pestañas, filtros, orden, crear objeto | ✅ |
| Kanban: arrastrar tarjetas | ⬜ probar a mano |
| Varias vistas en una misma página | ✅ dos a la vez, cada una con su id |
| Abrir en la vista pedida con `view="nombre"` | ✅ |
| Solo lectura para quien no puede editar | 🟡 |
| Enlaces del HTML en el grafo y en los backlinks | ⬜ Anytype no indexa enlaces dentro de código. Plan: propiedad «Referencias» que el fork y el sync mantienen (el grafo ya dibuja propiedades de tipo objeto; backlinks por verificar) |
| Página HTML como inicio del espacio | ✅ se puso como inicio, Anytype la devolvió como tal y se restauró |
| Tipo «Página HTML» con plantilla por defecto | ✅ creado por MCP; una página nueva nace con su bloque HTML |
| Página HTML a página completa, con botón para editar el HTML y volver | ✅ sin título ni marco en modo vista; página normal al editar |
| Tarjetas y búsquedas no muestran código crudo | 🟡 la guía pide `description` al crear |
| Dos personas editando el mismo HTML a la vez | ⬜ por verificar; si la fuente es un repo, manda el repo |
| Historial de versiones | ✅ es un bloque de texto normal |

## Fases (reemplazan la F4 anterior)

| Fase | Qué | Hecho cuando |
|---|---|---|
| F4a | Modo nativo sólido: kanban, galería y calendario con su ancho, atributo `view`, alto fijo, copiar y pegar, deshacer | Una página con tres vistas distintas se usa sin sorpresas |
| F4b | Piezas restantes: tarjeta, documento incrustado, propiedad, lista con template, imágenes | Cada etiqueta de la tabla está probada |
| F4c | Tipo «Página HTML» a página completa, modo edición, inicio del espacio | ✅ hecho en Get Started («Inicio (prueba MCP)»). Falta crear el tipo y la página en el espacio del equipo |
| F4d | Modo aislado con datos: `window.anytype` para leer, suscribirse y abrir; tema y teclas | Un gráfico con datos de Anytype hecho con JavaScript |
| F4e | Lista de «se siente nativo» completa | Todas las filas en ✅ o con decisión del usuario |
| F4f | Guía para IAs y MCP; propiedad «Referencias»; sync externo | ✅ guía ([GUIA_HTML_PARA_IA.md](GUIA_HTML_PARA_IA.md)) y página creada con el MCP real. Faltan «Referencias» y el sync |

## Archivos

| Archivo | Qué hace |
|---|---|
| `src/ts/plus/htmlParse.ts` | Detecta código ejecutable, limpia el HTML, saca estilos y cambia etiquetas por slots |
| `src/ts/plus/htmlNative.tsx` | Modo nativo: shadow DOM, estilos, enlaces, imágenes |
| `src/ts/plus/nativeSlot.tsx` | Piezas nativas: vista y objeto |
| `src/ts/plus/htmlLive.tsx` | Modo aislado (iframe) |
| `src/ts/plus/height.tsx` | Alto fijo con manija, compartido por los dos modos |
| `src/ts/plus/text.ts` | Textos propios en español e inglés |
| `src/ts/component/block/text.tsx` | Elige el modo (`// plus:`) |
| `src/ts/component/block/index.tsx` | No dibuja los hijos del bloque HTML debajo (`// plus:`) |
| `src/ts/plus/htmlPage.ts`, `src/scss/plus/htmlPage.scss` | Tipo «Página HTML» a página completa |
| `src/ts/plus/list.tsx` | `<anytype-list>` |
| `src/ts/plus/copyForHtml.ts` | «Copiar para HTML» en los menús de objeto |
| `plus/scripts/probar-sanitizador.mjs` | Prueba de seguridad dentro de la app |
| `plus/scripts/mcp.mjs` | Llama herramientas del MCP oficial igual que Claude, para probar el camino completo |
