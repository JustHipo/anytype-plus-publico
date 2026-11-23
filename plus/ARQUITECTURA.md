---
version: 1
fecha: 2026-11-19
base: anytype-ts v0.57.7 (commit 724519c3d7)
---

# Arquitectura

Las referencias a código son de la versión base v0.57.7 y se verificaron **leyendo el código**, salvo donde dice «por verificar».

## La restricción que manda

Seguimos en la red oficial de Anytype y con la misma cuenta (decisión D-02). Esto implica:

- **heart no se toca:** `./update.sh` baja el heart oficial de la versión base. Un bloque o un mensaje gRPC nuevo exigiría cambiar heart, y los clientes oficiales no lo entenderían.
- **Todo lo nuevo se guarda en piezas que ya existen:**
  1. **Campos de bloque (`fields`):** cada bloque tiene un mapa libre de claves y valores que se sincroniza y que el cliente oficial ignora si no lo conoce. Se escriben con `C.BlockSetFields` y `C.BlockListSetFields` (`src/ts/lib/api/command.ts:480` y `:850`). Nuestras claves llevan el prefijo `plus`.
  2. **Bloques de código** con lenguaje `html` o `json`.
  3. **El embed «Anytype Mini App»**, que ya existe (ver abajo).
  4. **Tipos y propiedades del espacio**, creados como cualquier tipo de usuario.
- **Qué ve el Anytype oficial:** para cada feature, la tabla de abajo dice qué ve alguien sin el fork.

## Pieza clave encontrada: el embed «Anytype Mini App»

Anytype v0.57.7 ya trae un embed que ejecuta HTML propio (commit `1063c99d1c`, «mini app init»):

- Aparece en el menú de embeds como «Anytype Mini App» (`src/ts/lib/util/menu.ts:188`; procesador 27 en `src/ts/interface/block/embed.ts:31`).
- Toma el HTML de un **bloque de código hermano** con lenguaje `html` o `markup`, y un estado opcional de un bloque hermano `json` (`src/ts/component/block/embed.tsx:89`).
- Lo ejecuta en un iframe aislado (`allow-scripts allow-same-origin allow-popups`, `embed.tsx:537`), servido desde un origen distinto al de la app (`embedOrigin`, `src/ts/lib/util/embed.ts:495`), así que el HTML no ve la sesión ni los datos.
- El HTML puede guardar estado: manda `anytypeMiniAppState` y la app lo escribe en el bloque `json` (`embed.tsx:674`).
- El HTML puede pedir abrir enlaces con el mensaje `openUrl` (`embed.tsx:665`).
- Los enlaces a objetos ya tienen formato: `anytype://object?objectId=<id>&spaceId=<espacio>` o `https://object.any.coop/<id>` (`src/ts/lib/objectLink.ts`).

**Consecuencia:** el bloque HTML y las Páginas HTML se construyen extendiendo el Mini App, no desde cero.

**Verificado en el fork (2026-11-19, ejecutando):**
- En Anytype 0.57.7 el Mini App solo aparece en el menú con «Experimental features» (menú Sudo), así que el Anytype oficial normal no lo ofrece. El dibujo del bloque no revisa esa opción: un bloque ya creado se dibuja en cualquier cliente 0.57.7 (por probar en el oficial).
- El fork lo muestra siempre como «HTML (Mini App)» (`src/ts/lib/util/menu.ts`, `// plus:`).
- Tal como venía, el texto del HTML no se veía: el iframe de embeds tiene `#root { font-size: 0px }`. El fork le da tamaño normal y texto seleccionable solo al Mini App (`dist/embed/iframe.html`, clase `isMiniApp`).
- Tal como venía, un enlace `anytype://object?...` navegaba el iframe y lo dejaba en blanco. El fork intercepta los clics en enlaces del Mini App y los manda a la app (`openUrl`); el objeto se abre dentro de Anytype.
- JavaScript dentro del HTML funciona (un contador con `onclick`).
- Ojo al crear por código: `C.BlockCreate` no guarda `fields`; el `lang: html` se pone después con `C.BlockListSetFields`.

## Cómo se guarda cada feature

| Feature | Dónde se guarda | Qué ve el Anytype oficial |
|---|---|---|
| Bloque HTML | Bloque de código con lenguaje `html-vivo` (D-18); alto fijo opcional en `fields.plusHeight`. Los embeds Mini App viejos (código `html` + embed) siguen funcionando | El código HTML como bloque de código |
| Página HTML | Objeto de tipo **Página HTML** cuyo cuerpo es un bloque de código `html` (y opcionalmente `json`). El fork lo dibuja a página completa con el motor del Mini App | El objeto con su código |
| Enlace a objeto dentro del HTML | `href="anytype://object?objectId=…&spaceId=…"`; el fork intercepta el clic y abre el objeto dentro de la app | El código del enlace |
| Vista nativa dentro del HTML | Etiqueta `<anytype-view object="<set o colección>" view="<vista>">` en el HTML, más un bloque de set en línea real en el mismo objeto | El set en línea como bloque normal, debajo del código |
| Columnas en grilla | Las columnas de Anytype ya guardan su ancho en `fields.width`; el fork redondea a 1/12 | Las mismas columnas, con ese ancho |
| Estilo de bloque (tarjeta) | `fields.plusStyle` en el bloque | El bloque sin el estilo |
| Fuente y tamaño por página | `fields.plusFont`, `fields.plusFontSize` en el bloque raíz del objeto | La página con la fuente normal |
| Tamaño de texto general | Ajuste local de la app (no se sincroniza) | Nada |
| Documento incrustado | Bloque de enlace normal con `fields.plusEmbed = true` | Un enlace normal al objeto |
| Visor DOCX | Archivo normal de Anytype; el fork agrega el visor | El archivo para descargar |
| Vista por carpetas | Nada nuevo: el árbol se arma en el cliente con la propiedad `ruta_repo` que un sync externo escribe en cada documento | La propiedad `ruta_repo` como texto; puede agrupar por ella en una vista normal |
| Tema Solarized | Ajuste local, hojas de estilo en `src/scss/plus/` | Nada |
| Avisos y bandeja de cambios | Ajustes locales y, por espacio, «visto hasta» en el almacenamiento local de la app (`plusChangeInbox`); usa una suscripción a objetos modificados por otra persona | Nada |

### Páginas HTML en detalle
- **Modo vista:** el HTML ocupa la página, con el motor del Mini App, el tema de la app y alto automático.
- **Modo edición:** se muestra el bloque de código. Primero con el editor de código de Anytype; después se evalúa un editor mejor (decisión abierta A-03).
- **Vistas nativas por superposición:** el iframe crece al alto de su contenido (mensaje `resize`), así que no tiene scroll propio. Un script nuestro dentro del iframe mide cada `<anytype-view>` y manda su posición; la app dibuja encima el set en línea nativo en esa posición. Así el kanban es el de Anytype de verdad (se arrastran tarjetas), aunque esté «dentro» del HTML. Por verificar en la F4: que el set en línea se pueda dibujar fuera de su lugar en el árbol de bloques.
- **Copiar para HTML:** en el menú de una vista o de un objeto, copia `<anytype-view …>` o el enlace `anytype://…` listo para pegar en el HTML o dárselo a Claude.

### Avisos de cambios en detalle
- Una suscripción de búsqueda (la misma maquinaria que usan los widgets) sobre los objetos del espacio ordenados por fecha de modificación, filtrando los que no modificó la persona que usa la app.
- El aviso usa la notificación del sistema que la app ya usa para el chat (`Notification` de Electron en `electron/ts/api.ts`) y una lista de cambios recientes dentro de la app.
- Ajustes: por espacio y por tipo. Los modos de aviso de chat ya existen (`NotificationMode`, `src/ts/interface/space.ts:98`).

- **Bandeja (F11, rama local `plus/colaboracion`):** todos los espacios se vigilan (también los que se suman con la sesión abierta); el modo de Ajustes solo decide los avisos emergentes. Por espacio se guarda `seenUntil` (fecha del cambio más nuevo ya visto, sacada de `lastModifiedDate`, nunca del reloj local) y los objetos vistos uno a uno. La primera vez que se vigila un espacio en una máquina, lo que ya existía cuenta como visto. Página `/main/plusChanges`, fila «Cambios» con contador en la barra lateral y etiqueta `<anytype-changes>`. Código: `src/ts/plus/changesInbox.ts` (funciones puras), `changeAlerts.ts`, `changesPage.tsx`, `changesWidget.tsx`, `changesList.tsx`.

### Vista por carpetas en detalle
- Una suscripción trae los objetos del espacio que tienen `ruta_repo` (`documentacion/empresa/O-01.md`, etc.) y el cliente arma el árbol partiendo cada ruta por `/`.
- Se muestra como un panel o widget de la barra lateral y como una vista a página completa: carpetas que se abren y cierran, y al hacer clic en un documento se abre su objeto.
- Las Páginas HTML que vengan de un `.html` del repo llevan la misma propiedad, así que aparecen en el mismo árbol.
- No se crea un tipo de vista nuevo de sets (los tipos de vista viven en heart y el cliente oficial no los conocería).
- Por verificar en su fase: que todas las fuentes del sync (no solo documentos y traspasos) lleven `ruta_repo`.

## Convivir con el Anytype oficial

Hoy el fork se llama igual que la app oficial (`package.json`: `appId` `com.anytype.anytype`, `productName` `Anytype`, protocolo `anytype`). En la F1 se cambia:

- **Nombre y `appId` propios** («Anytype Plus»), para instalar las dos apps lado a lado.
- **Carpeta de datos propia:** sale de `app.getPath('userData')` (`electron/ts/main.ts:48`) y cambia sola con el nombre. Las dos apps nunca comparten la misma base local.
- **Misma cuenta:** se entra con la frase de recuperación; para la red, el fork es un dispositivo más de la cuenta.
- **Por verificar en la F1:** si las dos apps abiertas a la vez chocan en el puerto de la API local (31009), que usan el MCP y el sync externo. Si chocan, se deja una sola abierta o se cambia el puerto del fork.

## Sync externo con HTML

Vive en otro repositorio, no aquí. La idea:

- Un `.html` del repo corresponde a una Página HTML en Anytype, igual que hoy un `.md` corresponde a un documento.
- En Anytype los enlaces apuntan al objeto (`anytype://object?objectId=…`). Al bajar al repo, el sync los cambia por la ruta real del archivo (`../documentacion/x.md`). Al subir, hace lo inverso con su mapa de rutas y objetos.
- Desde el HTML nunca se apunta directo al `.md` del repo: se apunta al objeto de Anytype.

## Builds para Mac y Windows

- Anytype ya trae los scripts (`bun run dist:mac`, `bun run dist:win`) y un workflow de GitHub Actions (`.github/workflows/build.yml`) que compila para las tres plataformas con firma.
- Nosotros: un workflow propio sin firma (o firmado, si hay certificado). Sin firma, macOS pide abrir con clic derecho la primera vez y Windows muestra el aviso de SmartScreen.

## Mantenerse al día con Anytype

- `git fetch upstream --tags` y `git merge v0.x.y` en una rama, compilar, probar y mergear a `main`.
- Por eso el código nuestro va en carpetas propias y los toques al código de Anytype se marcan con `// plus:` y se mantienen chicos.
- **Riesgo:** el Mini App es nuevo y puede cambiar en versiones siguientes.
- **Riesgo:** según una nota del 2026-11-17, Anytype anunció «Anytwo», una app nueva incompatible ([community.anytype.io/t/31235](https://community.anytype.io/t/31235)). Si Anytype deja de evolucionar, el fork sigue funcionando mientras la red oficial acepte esta versión. No lo verifiqué aquí.

## HTML en vivo (D-18)

- **Formato:** un bloque de código con `fields.lang = "html-vivo"`. Por la API (MCP): `{ "type": "code", "language": "html-vivo", "text": "<div class=\"plus-card\">…</div>" }`.
- **Dibujo:** `src/ts/plus/htmlLive.tsx` monta el iframe del Mini App (`dist/embed/iframe.html`, otro origen, sin acceso a la sesión) y le manda el HTML con `plusLive: true`. El iframe mide el alto real de `#root` y lo informa, así el bloque crece y se achica.
- **Alto fijo:** la manija guarda `fields.plusHeight`; con alto fijo el iframe tiene scroll. Doble clic lo borra.
- **Enlaces:** `anytype://object?objectId=…&spaceId=…` abre el objeto en la app; los enlaces web abren el navegador (por probar).
- **Tema:** variables `--plus-*` y clase `.plus-card` dentro del iframe (claro y oscuro).
- **Anytype oficial:** ve el bloque como código con lenguaje desconocido.
- **API keys:** son de cada instalación. Para usar el MCP con el fork hay que crear la key dentro de Anytype Plus.
- **Crear por MCP (verificado 2026-11-19):** `POST /v2/spaces/{space}/objects` con `{ "type": "page", "blocks": [ { "type": "code", "language": "html-vivo", "text": "…" } ] }` crea la página y el fork la dibuja. Ojo: crear por la API no pone `last_modified_date`, así que la página no aparece en «Recently edited» hasta la primera edición. Para que aparezca, después de crear hacer un `PATCH` (por ejemplo `set_properties` con la descripción).
- **Volver al alto automático:** doble clic en la manija (detectado a mano en el `mousedown`) o el botón «Alto automático», que aparece junto a «Ver código» cuando el alto está fijo.
