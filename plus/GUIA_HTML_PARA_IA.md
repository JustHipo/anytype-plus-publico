---
para: cualquier IA (Claude por MCP o un sync externo) que cree o edite HTML en Anytype Plus
verificado: 2026-11-19 con el MCP oficial `@anyproto/anytype-mcp` contra Anytype Plus (heart 0.51.7)
---

# Guía: crear páginas y bloques HTML en Anytype Plus por MCP

Todo lo de esta guía se ejecutó con el MCP real (`plus/scripts/mcp.mjs`), salvo donde dice «sin probar».

## Antes de empezar

- La app Anytype Plus tiene que estar abierta. El MCP habla con la app por el puerto 31009, que toma la primera app de Anytype que arranca: cierra el Anytype oficial.
- La API key se crea dentro de Anytype Plus (Settings → API Keys). La del Anytype oficial no sirve.
- En las herramientas del MCP, el cuerpo va en `body` para `API-create-object`, `API-create-type` y `API-update-type`. En `API-create-template` y `API-patch-object` los campos van en la raíz.

## 1. Una vez por espacio: el tipo «Página HTML»

```json
API-create-type
{ "space_id": "ESPACIO",
  "body": { "api_key": "html_page", "name": "Página HTML", "plural_name": "Páginas HTML",
            "icon": { "format": "emoji", "emoji": "🌐" }, "layout": "basic" } }
```

La clave `html_page` es lo que Anytype Plus reconoce para mostrar la página completa. Plantilla para que una página nueva nazca con su bloque HTML:

```json
API-create-template
{ "space_id": "ESPACIO", "template_for": "html_page", "properties": { "name": "Página HTML" },
  "blocks": [ { "type": "code", "language": "html-vivo", "text": "<h1>Título</h1>" } ] }

API-update-type
{ "space_id": "ESPACIO", "type": "html_page", "body": { "default_template": "ID_DE_LA_PLANTILLA" } }
```

## 2. Crear una página HTML

```json
API-create-object
{ "space_id": "ESPACIO",
  "body": { "type": "html_page", "template": "none",
            "properties": { "name": "Inicio", "description": "Página de inicio" },
            "blocks": [
              { "type": "code", "language": "html-vivo", "text": "…HTML…" },
              { "type": "dataview", "indent": 1, "object_id": "ID_DEL_SET_O_TIPO",
                "views": [ { "name": "Kanban", "type": "kanban", "group_by": "done" },
                           { "name": "Todas", "type": "table" } ] }
            ] } }
```

- **Manda `"template": "none"` cuando envías `blocks`.** Si no, la plantilla por defecto del tipo agrega su propio bloque HTML de ejemplo antes de los tuyos, y ese queda primero (es el que se ve a página completa). Verificado.
- El primer bloque es el HTML: un bloque `code` con `language: "html-vivo"`.
- Cada vista nativa que el HTML use es un bloque `dataview` con `indent: 1` (hijo del bloque HTML) y `object_id` igual al del `<anytype-view>`. Si no lo mandas, Anytype Plus lo crea solo con las vistas del objeto original la primera vez que alguien con permiso de edición abre la página.
- Pon `description`: es lo que muestran las tarjetas en vez del código.
- Con `blocks`, el nombre va en `properties.name`.
- Un bloque HTML dentro de una página normal es lo mismo: un bloque `code` con `language: "html-vivo"` en cualquier objeto.
- **Objeto de otro tipo a página completa:** si el primer bloque de cualquier objeto es `html-vivo` y su HTML trae `<!-- plus:pagina -->` (o `<meta name="plus" content="pagina">`), se ve como una Página HTML: sin ícono, título ni marco, con el botón para editar en el margen. El objeto conserva su tipo, sus propiedades y sus vistas. Como en la Página HTML, en modo vista solo se ve ese primer bloque (y sus vistas hijas); el resto aparece en modo edición. Disponible desde la rama `plus/f2-temas-texto`.
- Después de crear, la página no aparece en «Recently edited» hasta su primera edición. Un `API-patch-object` cualquiera lo resuelve.

## 3. Qué HTML escribir

Sin `<script>` ni atributos `on…`: así el HTML se dibuja dentro de la página y puede usar las piezas nativas. Con scripts se dibuja aislado en un iframe, sin piezas nativas.

```html
<style>
  body { display: grid; gap: 20px; }            /* body, html y :root apuntan al contenedor de la página */
  .cols { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start; }
</style>

<h1>Inicio</h1>
<div class="cols">
  <section>
    <!-- Vista nativa completa de un set, una colección o un tipo -->
    <anytype-view object="ID" view="Kanban"></anytype-view>
  </section>

  <aside class="plus-card">
    <!-- Objeto concreto: ícono y nombre siempre al día; clic lo abre -->
    <anytype-object object="ID"></anytype-object>

    <!-- Enlace normal a un objeto y a la web -->
    <a href="anytype://object?objectId=ID">Documento</a>
    <a href="https://ejemplo.com">Sitio</a>

    <!-- Lista propia: lo de adentro se repite por cada objeto -->
    <ul>
      <anytype-list source="ID" limit="5" sort="name">
        <li><a href="{{url}}">{{name}}</a> {{done}}</li>
      </anytype-list>
    </ul>
  </aside>
</div>
```

| Pieza | Atributos | Notas |
|---|---|---|
| `<anytype-view>` | `object` (set, colección o tipo), `view` (nombre o id de la vista inicial) | Vista nativa: pestañas, filtros, orden, crear objetos. Se ajusta al ancho de donde está y tiene scroll si no cabe. Si las pestañas no caben a lo ancho, Anytype las muestra como menú desplegable (es su comportamiento normal); se vuelve a medir cuando cambia el espacio disponible |
| `<anytype-object>` | `object` | Enlace vivo; clic lo abre. Cmd+clic y Shift+clic usan la función de Anytype para pestaña y popup (sin probar a mano) |
| `<anytype-list>` | `source` (tipo, colección o set), `filter` (gramática de la API: `estado_decision IN ("Vigente") AND name CONTAINS "DE-"`; operadores `= != > < >= <= IN`, `NOT IN`, `ALL IN`, `CONTAINS`, `NOT CONTAINS`, `IS EMPTY`, `IS NOT EMPTY`), `limit` (50 por defecto, máximo 500), `sort` (clave; `-clave` descendente) | Variables: `{{name}}`, `{{id}}`, `{{url}}`, `{{icon}}` y cualquier propiedad. Claves: la de la API (`origen`, `created_date`) o la interna. En `filter`, las opciones de select van por su nombre. Con un set de fuente se aplican también los filtros de su primera vista, y su orden si no hay `sort`. Select y multi_select muestran el nombre de la opción; objetos, su nombre; fechas, «19 nov 2026». Los valores se escapan. No usarla dentro de `<table>` |
| `<anytype-folders>` | `key` (propiedad con la ruta; por defecto `ruta_repo`), `source` (opcional: tipo, colección o set; sin él, todo el espacio), `filter` (misma gramática que `<anytype-list>`), `root` (muestra solo lo que está bajo esa carpeta), `open` (niveles que empiezan abiertos; 1 por defecto, 0 todo cerrado), `hint="no"` (oculta el nombre de archivo a la derecha, para cajas angostas) | Árbol de carpetas armado con la ruta de cada objeto, como un explorador de archivos: carpetas plegables con su cantidad de documentos y cada objeto como enlace. Quita anclas (`§1`, `#seccion`) y `../`. Junta carpetas que solo contienen otra (`a/b`). Las carpetas que se abren o cierran quedan así aunque los documentos cambien. Se puede estilizar con las clases `.plus-folders`, `.plus-folders-dir`, `.plus-folders-file`, `.plus-folders-name`, `.plus-folders-count` y `.plus-folders-hint`. Llega con la versión siguiente a `plus-v0.57.703` |
| `<anytype-changes>` | `limit` (10 por defecto, hasta 100), `space` (`actual`, por defecto, o `todos`) | Lo que otras personas editaron hace poco, de la misma fuente que la bandeja «Cambios» (lo posterior a «visto hasta» de cada persona). Sin contenido dibuja filas con las clases `.row`, `.e`, `.t` y `.m` (fáciles de estilizar desde la página), con la clase `unread` en las no vistas. Con contenido, ese HTML es la plantilla de cada fila con `{{url}}`, `{{icon}}`, `{{name}}`, `{{who}}`, `{{when}}`, `{{type}}`, `{{space}}` y `{{unread}}`. Solo en modo nativo. En la rama local `plus/colaboracion`, sin publicar |
| `<a href="anytype://object?objectId=ID">` | | Abre el objeto dentro de la app. Basta el `objectId`: el fork completa el espacio actual. Para otro espacio, `&spaceId=` debe ser el id interno (`bafy…`, el de `API-list-spaces` con `"ids": "full"`), nunca el corto de la API (`qqtzya`) |
| `<img src="anytype://file/ID">` | | Imagen guardada en Anytype (verificado: carga la imagen, también de otro espacio de la cuenta). Las imágenes de otros sitios web no cargan: súbelas a Anytype o usa `data:` |

Estilos:
- Variables que siguen el tema de la app: `--plus-bg`, `--plus-surface`, `--plus-text`, `--plus-muted`, `--plus-border`, `--plus-accent`, `--plus-radius`. También sirven las de Anytype (`--color-text-primary`, etc.).
- Clase lista para usar: `.plus-card`.
- No se permiten: `script`, `iframe`, `form`, `object`, `embed`, `meta`, `link`, `@import`.
- `position: fixed` queda encerrado en el bloque.

## 4. Editar

```json
API-patch-object
{ "space_id": "ESPACIO", "object_id": "PAGINA",
  "ops": [ { "op": "replace_text", "find": "texto exacto y único", "replace": "texto nuevo" } ] }
```

| Quiero | Operación |
|---|---|
| Cambiar un trozo | `replace_text` con `find` y `replace` |
| Reescribir todo el HTML | `update_block` con `id` del bloque (o `match`) y `set: { "text": "…" }` |
| Agregar una vista a un set en línea | `insert_view` con `block`, `name`, `copy_from` (id de otra vista) y `set: { "type": "kanban", "group_by": "…" }` |
| Leer la página | `API-get-object` con `include: "blocks"`. No usar `format: "md"` para HTML: pierde el lenguaje del bloque |

La app abierta se redibuja sola después de cada cambio.

## 5. Página de inicio del espacio

En la app: ajustes del espacio → Home → elegir la página. Verificado ejecutando: una Página HTML se puso como inicio del espacio, Anytype la devolvió como su inicio y se restauró el anterior. La API no tiene esta operación.

## Cuidados

- Versiones: los arreglos de enlaces y de nombres de opciones llegaron con `plus-v0.57.7-2`. `filter`, los filtros de la vista del set, las claves de API de las propiedades propias (`{{origen}}`) y las fechas cortas llegan con `plus-v0.57.703`.

- Tamaño: un bloque de 539 KB funciona. Evita imágenes embebidas grandes.
- Dos personas editando el mismo bloque HTML a la vez: sin verificar; evítalo.
- Anytype oficial: muestra el código y, debajo, las vistas como sets en línea normales.
- Los enlaces escritos dentro del HTML no aparecen en backlinks ni en el grafo (pendiente: propiedad «Referencias»).

## Formato de páginas (bloques normales, por la API)

- **Tarjeta:** `fields.plusStyle` en un bloque, con valor `"card"` o `"accent"` (borde de acento a la izquierda). Si el bloque tiene hijos (`indent`), la tarjeta los envuelve: así se arma una sección.
- **Objeto completo:** un bloque de enlace con `fields.plusEmbed: true` muestra el objeto entero en solo lectura, en lugar de la tarjeta. En HTML: `<anytype-object object="ID" as="embed">`. El Anytype oficial lo sigue mostrando como enlace.
- **Columnas:** los anchos (`fields.width` de cada columna) son fracciones de la fila. Usa doceavos (`0.25`, `0.3333`, `0.5`…) para que coincidan con la grilla.
- Llegan con la versión siguiente a `plus-v0.57.703`.
