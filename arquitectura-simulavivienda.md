# SimulaVivienda.co — Documento de Arquitectura
**Versión:** 1.0  
**Fecha:** Mayo 2026  
**Arquitecto:** [Tu nombre]  
**Estado:** Pre-desarrollo — aprobado para construcción

---

## Tabla de contenido

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Contexto y oportunidad de negocio](#2-contexto-y-oportunidad-de-negocio)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Infraestructura y alojamiento](#4-infraestructura-y-alojamiento)
5. [Estructura de carpetas](#5-estructura-de-carpetas)
6. [Módulos funcionales — los 8 puntos](#6-módulos-funcionales--los-8-puntos)
7. [Modelo de monetización](#7-modelo-de-monetización)
8. [Costos reales del proyecto](#8-costos-reales-del-proyecto)
9. [Mantenimiento](#9-mantenimiento)
10. [Hoja de ruta de desarrollo](#10-hoja-de-ruta-de-desarrollo)

---

## 1. Resumen ejecutivo

SimulaVivienda.co es un simulador hipotecario neutral e independiente para el mercado colombiano. A diferencia de los simuladores existentes —que pertenecen a bancos o portales inmobiliarios con agenda comercial propia— este sitio no vende propiedades ni tiene convenio con ninguna entidad financiera.

El producto es una herramienta web estática construida con Vanilla JavaScript, sin backend ni base de datos, alojada gratuitamente en Cloudflare Pages. Genera ingresos a través de dos canales: publicidad (Google AdSense) y generación de leads para brokers hipotecarios.

El diferencial técnico principal frente al AI Overview de Google es que el sitio produce outputs que una caja de texto no puede reemplazar: tablas de amortización de hasta 360 filas, comparaciones multi-banco con los datos del propio usuario, y archivos PDF descargables.

---

## 2. Contexto y oportunidad de negocio

### El problema

En Colombia, toda persona que quiere comprar vivienda con crédito hipotecario necesita entender cuánto pagará, cuánto le cobrarán en intereses y qué banco le conviene más. Las opciones actuales tienen un problema estructural:

- **Simuladores de los bancos** (Bancolombia, Davivienda, BBVA, etc.): solo muestran las condiciones del propio banco. No permiten comparar.
- **Portales inmobiliarios** (La Haus, Estrenar Vivienda, Amarilo): tienen el simulador como gancho para vender propiedades o referir al banco con el que tienen convenio.
- **Comparabien.com.co**: superficial, sin tabla de amortización completa, con modelo de lead gen que muestra su agenda comercial.

**No existe en Colombia un simulador neutral, completo e independiente.**

### El mercado

- Aproximadamente 100.000–180.000 búsquedas mensuales en Colombia relacionadas con créditos hipotecarios y simuladores.
- El keyword principal "simulador crédito hipotecario colombia" tiene entre 30.000 y 50.000 búsquedas mensuales estimadas.
- El FNA desde 2026 financia el 100% de viviendas VIS y VIP nuevas, lo que incrementa el interés de personas que antes no consideraban comprar.
- El RPM (ingreso por cada mil visitas) en el nicho financiero es de 5 a 15 USD, entre 5 y 15 veces superior al nicho de gaming o construcción.

### Por qué Google AI Overview no puede reemplazar este sitio

Google AI Overview responde preguntas con texto en una cajita de resultados. Hay tres cosas que estructuralmente no puede hacer:

1. Generar una tabla de amortización de 360 filas descargable en PDF.
2. Comparar múltiples bancos simultáneamente con los datos específicos del usuario.
3. Recalcular dinámicamente cuando el usuario cambia un input (plazo, cuota inicial, abono extraordinario).

El sitio está diseñado para que su valor central viva exactamente en esos tres puntos.

---

## 3. Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Lenguaje | Vanilla JavaScript (ES Modules) | Sin dependencias, sin build step, sin complejidad innecesaria |
| Markup | HTML5 semántico | Máxima velocidad de carga, óptimo para SEO |
| Estilos | CSS3 con variables custom | Sin frameworks, sin clases utilitarias, control total |
| Exportación PDF | jsPDF (CDN) | Única dependencia externa, genera PDF en el navegador sin backend |
| Control de versiones | Git + GitHub | Estándar de la industria, integración directa con Cloudflare Pages |
| Formularios | Formspree | Manejo de leads sin backend, 50 envíos/mes gratis |

### Por qué no React

React es una herramienta para interfaces complejas con estado compartido entre muchos componentes. Un simulador hipotecario tiene inputs, cálculos y tablas — eso no justifica añadir un framework con su ecosistema de dependencias, proceso de build y curva de aprendizaje. Vanilla JS con ES Modules hace exactamente lo mismo con cero overhead.

### Por qué no Railway

Railway está diseñado para aplicaciones backend: APIs en Node.js, bases de datos PostgreSQL, servicios que corren en un servidor 24/7. Este proyecto es un sitio estático — archivos que se sirven directamente desde una CDN. Usar Railway aquí añade costo (ya no tiene tier gratuito real en 2026), complejidad operativa y cero beneficio técnico.

---

## 4. Infraestructura y alojamiento

### Arquitectura de servicios

```
[Tu computador]
      │
      │ git push
      ▼
[GitHub — repositorio privado]
      │
      │ webhook automático
      ▼
[Cloudflare Pages — hosting + CDN]
      │
      ├── simulavivienda.com.co ──► Usuario en Colombia
      │                             (servidor CDN más cercano)
      │
      └── Formulario lead gen ──► [Formspree] ──► Email al broker
```

### GitHub

- **Rol:** Repositorio de código fuente y control de versiones.
- **Plan:** Free (repositorio privado incluido).
- **Función crítica:** Cada `git push` dispara automáticamente un nuevo deploy en Cloudflare Pages. El historial de commits permite volver a cualquier versión anterior si algo se rompe.
- **Costo:** $0/mes.

### Cloudflare Pages

- **Rol:** Hosting del sitio estático + CDN global.
- **Por qué Cloudflare y no Netlify o Vercel:**
  - Netlify (cuentas nuevas post-Sep 2025): 300 créditos/mes ≈ 30GB de ancho de banda. Insuficiente cuando el tráfico escale.
  - Vercel: el plan gratuito (Hobby) prohíbe explícitamente el uso comercial. Un sitio con ads y lead gen es uso comercial desde el día uno.
  - Cloudflare Pages: ancho de banda ilimitado, sin restricciones de uso comercial, mejor CDN del mundo con presencia fuerte en Colombia.
- **Plan:** Free (incluye SSL, dominio custom, 500 builds/mes, ancho de banda ilimitado).
- **Costo:** $0/mes.

### Formspree

- **Rol:** Manejo del formulario de captación de leads sin backend.
- **Funcionamiento:** El usuario llena nombre y teléfono → Formspree envía un email → el propietario reenvía el lead al broker.
- **Plan gratuito:** 50 envíos/mes — suficiente para validar el modelo de lead gen.
- **Plan de pago cuando escale:** $8 USD/mes para envíos ilimitados.
- **Costo inicial:** $0/mes.

### Dominio

- **Dominio recomendado:** `simulavivienda.com.co` o `calculahipoteca.co`
- **Importancia del .com.co para SEO:** Google da preferencia geográfica a dominios de país en búsquedas locales. Un .com.co rankea más fácil en Colombia que un .com genérico para keywords como "simulador hipotecario colombia".
- **Dónde comprar:** Namecheap o Porkbun (~25 USD/año).
- **Costo:** ~$25 USD/año ($2 USD/mes).

---

## 5. Estructura de carpetas

```
simulavivienda/
│
├── public/
│   ├── favicon.ico
│   ├── robots.txt                  ← Instrucciones para Google (SEO)
│   └── og-image.png                ← Imagen que aparece al compartir en WhatsApp
│
├── src/
│   │
│   ├── config/                     ← ★ ÚNICO LUGAR DONDE VIVEN LOS DATOS
│   │   ├── banks.js                ← Tasas de cada banco (actualizar trimestralmente)
│   │   ├── subsidios.js            ← Montos Mi Casa Ya por rango de ingresos
│   │   └── constants.js            ← SMMLV, tope VIS, regla 30% endeudamiento
│   │
│   ├── calculators/                ← MATEMÁTICAS PURAS — sin UI, sin DOM
│   │   ├── amortization.js         ← Fórmula francesa: cuota, capital, interés, saldo
│   │   ├── capacity.js             ← Fórmula inversa: cuánto puedo pedir
│   │   ├── uvr.js                  ← Conversión pesos ↔ UVR
│   │   └── extraPayments.js        ← Recálculo con abonos extraordinarios
│   │
│   ├── modules/                    ← MÓDULOS INDEPENDIENTES — cada uno es autónomo
│   │   │
│   │   ├── BankComparator/         ← Módulo 1: comparar todos los bancos en una tabla
│   │   │   ├── index.js
│   │   │   └── BankRow.js
│   │   │
│   │   ├── AmortizationTable/      ← Módulo 2: tabla de 360 filas
│   │   │   ├── index.js
│   │   │   ├── AnnualView.js       ← Vista resumen por año (30 filas)
│   │   │   └── MonthlyView.js      ← Vista mensual detallada con paginación
│   │   │
│   │   ├── CapacityCalc/           ← Módulo 3: cuánto puedo pedir según ingresos
│   │   │   └── index.js
│   │   │
│   │   ├── ExtraPayments/          ← Módulo 4: simulador de abonos extraordinarios
│   │   │   └── index.js
│   │   │
│   │   ├── UVRComparator/          ← Módulo 5: pesos vs UVR interactivo
│   │   │   └── index.js
│   │   │
│   │   ├── Subsidies/              ← Módulo 6: calculadora Mi Casa Ya
│   │   │   └── index.js
│   │   │
│   │   └── LeadForm/               ← Módulo 7: formulario de captación de leads
│   │       └── index.js
│   │
│   ├── components/                 ← UI REUTILIZABLE — piezas compartidas entre módulos
│   │   ├── Slider.js               ← Slider interactivo con valor en tiempo real
│   │   ├── TabBar.js               ← Barra de pestañas reutilizable
│   │   ├── MetricCard.js           ← Tarjeta de métrica (cuota, intereses, total)
│   │   ├── DataTable.js            ← Tabla con paginación usada en múltiples módulos
│   │   └── ExportPDF.js            ← Botón + lógica de exportación a PDF con jsPDF
│   │
│   ├── hooks/                      ← LÓGICA DE ESTADO — separada de la UI
│   │   ├── useAmortization.js      ← Estado, cálculos y efectos del simulador principal
│   │   ├── useBankComparison.js    ← Comparación multi-banco con los inputs actuales
│   │   └── useUVR.js               ← Fetch del valor UVR actual desde API del Banrep
│   │
│   ├── utils/                      ← HELPERS — funciones puras sin estado
│   │   ├── formatters.js           ← formatCOP(), formatMillions(), formatPct()
│   │   ├── pdfExport.js            ← Construcción del PDF con jsPDF
│   │   └── validators.js           ← Validación de inputs (rangos, tipos)
│   │
│   ├── styles/
│   │   ├── theme.css               ← Variables CSS: colores, fuentes, espaciado
│   │   └── global.css              ← Reset, estilos base, tipografía
│   │
│   ├── app.js                      ← Punto de entrada: monta y conecta los módulos
│   └── index.html                  ← HTML principal con meta tags SEO
│
├── .gitignore
├── README.md
└── package.json                    ← Solo contiene jsPDF como dependencia
```

### Principio de modularidad

Cada módulo en `modules/` es completamente independiente. Si `UVRComparator` falla porque la API del Banco de la República no responde, el resto del sitio sigue funcionando. En `app.js` cada módulo se puede desactivar con un flag sin tocar ningún otro archivo.

### Principio de fuente única de verdad

Todos los datos de negocio (tasas, subsidios, constantes legales) viven exclusivamente en `config/`. Ningún número hardcodeado en los módulos o componentes. Cambiar la tasa de Bancolombia de 10.5% a 11% requiere modificar una sola línea en `config/banks.js`.

---

## 6. Módulos funcionales — los 8 puntos

### Punto 1 — Tabla de amortización completa

**Qué hace:** Genera la tabla mes a mes de todo el plazo del crédito (hasta 360 filas para 30 años). Cada fila muestra: número de cuota, valor de la cuota fija, porción de intereses, porción de capital amortizado y saldo restante.

**Por qué es el diferenciador principal:** Ningún simulador de banco en Colombia muestra esto de forma clara y descargable. Google AI Overview puede decirte cuánto es la cuota mensual aproximada, pero no puede generar una tabla de 360 filas en tu pantalla y en un PDF.

**Cómo funciona técnicamente:** La fórmula de amortización francesa es matemática pura. Dados el capital, la tasa mensual equivalente (calculada desde la EA del banco) y el número de cuotas, la cuota fija se calcula con:

```
C = P × r / (1 - (1 + r)^-n)
```

Donde P = capital prestado, r = tasa mensual, n = número de cuotas. Cada mes se recalcula el interés sobre el saldo y el resto va a capital.

**Dos vistas:** Resumen anual (30 filas, una por año) para una lectura rápida. Detalle mensual (paginado de 12 en 12) para quién quiere ver cada cuota.

**Exportación:** Botón "Descargar PDF" genera el archivo en el navegador del usuario con jsPDF. Sin servidor, sin subir datos a ningún lado.

---

### Punto 2 — Comparador multi-banco

**Qué hace:** El usuario ingresa sus datos una sola vez (valor del inmueble, cuota inicial, plazo) y ve en una tabla cuánto pagaría de cuota mensual, total de intereses y total pagado en cada banco simultáneamente.

**Bancos incluidos (Mayo 2026):**

| Banco | Tasa EA referencia | Nota |
|---|---|---|
| FNA | 9.3% | Con traslado de cesantías, vivienda VIS |
| Bancolombia | 10.5% | Tasa preferencial |
| Davivienda | 10.8% | Proyectos aliados |
| AV Villas | 10.9% | |
| Banco de Bogotá | 11.0% | |
| BBVA Colombia | 11.2% | |
| Promedio mercado | 13.0% | No-VIS, perfil estándar |

**Qué revela:** La diferencia entre la tasa más baja (FNA 9.3%) y el promedio del mercado (13%) para un crédito de $200M COP a 20 años representa aproximadamente $40-60M COP en intereses totales. Ningún banco te muestra esto.

**Mantenimiento:** Las tasas se actualizan en `config/banks.js` cada trimestre consultando la Superintendencia Financiera de Colombia (superfinanciera.gov.co). Proceso: 30 minutos cada 3 meses.

---

### Punto 3 — Comparación pesos vs UVR

**Qué hace:** Muestra al usuario la diferencia entre tomar el crédito en pesos (cuota fija durante todo el plazo) versus en UVR (cuota indexada al IPC, que sube con la inflación).

**Por qué importa:** Los bancos raramente explican esto con claridad. En pesos la cuota es fija pero la tasa EA suele ser más alta. En UVR la tasa es menor pero la cuota sube cada año con la inflación. Para ingresos que crecen con el tiempo puede ser conveniente; para ingresos fijos puede ser una trampa.

**Cómo funciona técnicamente:** 
- El valor UVR actual se obtiene de la API pública del Banco de la República (sin costo, sin registro).
- Endpoint: `https://www.banrep.gov.co/es/-/valoruvr`
- Se cachea en `sessionStorage` para no hacer múltiples peticiones en la misma visita.
- Si la API falla, el módulo muestra un aviso y se desactiva sin afectar el resto del sitio.

**Proyección:** La comparación muestra ambas modalidades a 10, 20 y 30 años con una proyección de inflación ajustable (por defecto 4% anual, el target del Banco de la República).

---

### Punto 4 — Simulador de abonos extraordinarios

**Qué hace:** Permite al usuario preguntar "¿qué pasa si hago un abono extra de $X millones en el mes Y?" y ver inmediatamente cuántos meses menos de crédito tendrá y cuánto se ahorra en intereses totales.

**Casos de uso reales:** Prima de diciembre, herencia, bono laboral, venta de un bien. Son decisiones financieras muy concretas que las personas toman varias veces durante un crédito a 20 años.

**Cómo funciona técnicamente:** Se recalcula la tabla de amortización desde el mes del abono en adelante. El abono reduce el saldo de capital, lo que reduce los intereses de todas las cuotas siguientes. El resultado es una tabla modificada con menos cuotas totales.

**Diferencial frente a la competencia:** Ningún simulador bancario en Colombia tiene esta funcionalidad. Es el módulo más valorado por personas que ya tienen un crédito activo y quieren saber cuánto les conviene abonar.

---

### Punto 5 — Calculadora Mi Casa Ya

**Qué hace:** Determina automáticamente si el usuario aplica al subsidio de vivienda Mi Casa Ya del gobierno colombiano según sus ingresos y el precio del inmueble, y cuánto le descuenta del crédito.

**Cómo funciona técnicamente:** Los criterios son públicos y estables durante cada vigencia del programa:
- Ingresos del hogar hasta 8 SMMLV para VIS.
- Precio máximo del inmueble según la categoría (VIS o VIP).
- El subsidio es una reducción directa del saldo del crédito, no de la cuota mensual.

Los valores se mantienen en `config/subsidios.js` y se actualizan cuando el gobierno abre una nueva convocatoria o modifica los montos.

**Mantenimiento:** Verificar con el Ministerio de Vivienda cuando hay cambios de gobierno o de vigencia del programa. Ocurre 1-2 veces por año.

---

### Punto 6 — ¿Cuánto puedo pedir?

**Qué hace:** Modo inverso del simulador. El usuario ingresa sus ingresos mensuales, el porcentaje de cuota inicial que tiene disponible y el plazo que desea, y el sistema calcula cuál es el precio máximo de inmueble que puede financiar.

**Base legal:** La Superintendencia Financiera de Colombia establece que la cuota mensual de un crédito hipotecario no puede superar el 30% del ingreso mensual del deudor. Este es el límite que aplican todos los bancos al estudiar una solicitud.

**Cómo funciona técnicamente:** Es la fórmula de amortización resuelta para el capital:
```
P = (ingreso × 0.30) × (1 - (1 + r)^-n) / r
```

Donde P es el máximo que puede pedir, que luego se divide por el porcentaje de financiación del banco (70-80%) para obtener el precio máximo del inmueble.

**Valor para el usuario:** Es la primera pregunta que tiene cualquier persona que quiere comprar vivienda. Responderla sin que tenga que hablar con un banco primero genera confianza y tiempo en el sitio.

---

### Punto 7 — Slider interactivo cuota inicial

**Qué hace:** Un control deslizante (slider) que va del 20% al 50% de cuota inicial. Al moverlo, todos los cálculos del simulador se actualizan en tiempo real — cuota mensual, total de intereses, comparación de bancos.

**Por qué es importante:** La cuota inicial es la variable que más controla el usuario. Ver cómo cada punto porcentual adicional de entrada reduce la cuota mensual y el total de intereses es una visualización poderosa que ningún banco muestra de forma interactiva.

**Cómo funciona técnicamente:** Evento `input` en el slider → recalcula `calcAmortization()` → actualiza el DOM con los nuevos valores. Sin recarga de página, sin latencia perceptible.

---

### Punto 8 — Exportación a PDF

**Qué hace:** Genera un archivo PDF descargable con la tabla de amortización completa, el resumen del crédito simulado y los datos de comparación entre bancos.

**Por qué es un diferenciador fuerte:** Una persona que está gestionando un crédito hipotecario necesita compartir escenarios con su pareja, su asesor o el banco. Un PDF profesional con sus datos específicos es un documento que ningún simulador bancario genera gratis y de forma instantánea.

**Cómo funciona técnicamente:** La librería jsPDF (cargada desde CDN en cdnjs.cloudflare.com) genera el PDF completamente en el navegador del usuario. No se envía ningún dato a ningún servidor. El archivo se descarga directamente.

**Contenido del PDF:**
- Encabezado con logo y fecha de generación.
- Resumen: valor del inmueble, cuota inicial, monto financiado, banco, tasa EA, plazo.
- Tabla comparativa de todos los bancos.
- Tabla de amortización completa (una página por año en vista compacta).
- Disclaimer legal: "Los cálculos son referenciales. Consulta con tu entidad financiera."

---

## 7. Modelo de monetización

### Canal 1 — Google AdSense (pasivo puro)

- **Cómo funciona:** Se coloca el código de AdSense en el HTML. Google muestra anuncios automáticamente según el contenido y el perfil del visitante. No requiere ninguna gestión activa.
- **RPM financiero:** Entre 5 y 15 USD por cada 1.000 visitas (5-15 veces superior al nicho de gaming).
- **Proyección:**
  - Mes 6: 2.000–5.000 visitas → $10–50 USD/mes.
  - Mes 12: 10.000–25.000 visitas → $50–250 USD/mes.
  - Mes 18: 30.000–60.000 visitas → $150–600 USD/mes.
  - Mes 24: 60.000–120.000 visitas → $300–1.200 USD/mes.
- **Requisito de AdSense:** El sitio debe tener contenido original suficiente, buena experiencia de usuario y cumplir las políticas de Google. No hay un mínimo de tráfico para aplicar, pero la aprobación es más fácil con algo de tráfico establecido.

### Canal 2 — Lead generation para brokers hipotecarios (escalable)

- **Qué es un broker hipotecario:** Intermediario entre el cliente y los bancos. Consigue el mejor crédito para su cliente y cobra una comisión del banco cuando el crédito se desembolsa. En Colombia operan cientos de gestores independientes y empresas especializadas.
- **Cómo funciona el flujo:**
  1. Usuario simula un crédito de $280M COP a 20 años.
  2. Ve sus resultados. Aparece el formulario: "¿Quieres que un asesor certificado te ayude a conseguir la mejor tasa? Es gratis para ti."
  3. Usuario deja nombre y número de teléfono (via Formspree).
  4. El propietario del sitio reenvía el contacto al broker con quien tiene acuerdo.
  5. El broker contacta al usuario, lo asesora, gestiona el crédito.
  6. Si el crédito se aprueba, el banco paga al broker. El broker paga al sitio.
- **Por qué el broker paga:** Un lead con intención real (alguien que ya simuló un crédito específico) vale entre 50.000 y 150.000 COP para el broker, porque si el crédito se aprueba, el banco le paga entre 2M y 8M COP de comisión.
- **Modelos de pago posibles:**
  - Pago por lead: 30.000–80.000 COP por contacto entregado.
  - Pago por crédito aprobado: 200.000–500.000 COP, solo si el crédito se desembolsa.
  - Tarifa mensual fija: el broker paga una cuota mensual por exclusividad de los leads.
- **Proyección conservadora (mes 12):**
  - 15.000 visitas/mes × 2% conversión = 300 leads/mes.
  - 300 leads × 50.000 COP = 15M COP/mes ($3.750 USD).
- **Lo que no es pasivo:** Conseguir el acuerdo con el broker requiere contacto directo (LinkedIn, WhatsApp, referidos). Una vez establecido el acuerdo, el flujo es automático.

---

## 8. Costos reales del proyecto

### Costos fijos mensuales

| Concepto | Proveedor | Costo |
|---|---|---|
| Hosting del sitio | Cloudflare Pages | $0 USD |
| CDN y SSL | Cloudflare (incluido) | $0 USD |
| Repositorio de código | GitHub Free | $0 USD |
| Formulario de leads | Formspree Free (50/mes) | $0 USD |
| **Total operación (0–50 leads/mes)** | | **$0 USD/mes** |

### Costos únicos de lanzamiento

| Concepto | Proveedor | Costo |
|---|---|---|
| Dominio .com.co (1 año) | Namecheap o Porkbun | ~$25 USD |
| **Total inversión inicial** | | **~$25 USD** |

### Costos cuando el sitio escale

| Umbral | Concepto | Costo adicional |
|---|---|---|
| Más de 50 leads/mes | Formspree Basic | $8 USD/mes |
| Más de 100K visitas/mes | Cloudflare Pages sigue gratis | $0 USD |
| Cuando se requiera backend | Railway (Node.js + DB) | ~$10-20 USD/mes |

### Resumen de rentabilidad esperada

| Mes | Costo total | Ingreso estimado (ads) | Ingreso estimado (ads + leads) |
|---|---|---|---|
| 1–3 | $2 USD | $0–5 USD | $0–50 USD |
| 6 | $2 USD | $10–50 USD | $50–300 USD |
| 12 | $2 USD | $50–250 USD | $500–2.000 USD |
| 18 | $10 USD | $150–600 USD | $1.500–5.000 USD |
| 24 | $10 USD | $300–1.200 USD | $3.000–10.000 USD |

---

## 9. Mantenimiento

### Mantenimiento trimestral (2–3 horas cada 3 meses)

- **Actualizar tasas en `config/banks.js`:** Consultar la Superintendencia Financiera de Colombia (superfinanciera.gov.co → Tasas de captación y colocación) y verificar las tasas actuales de cada banco.
- **Verificar el SMMLV en `config/constants.js`:** Cambia cada enero. La cifra la publica el Ministerio del Trabajo.

### Mantenimiento anual (1–2 horas)

- **Actualizar `config/subsidios.js`:** Los montos de Mi Casa Ya cambian con cada convocatoria del Ministerio de Vivienda.
- **Verificar el tope VIS:** El valor máximo de vivienda VIS en SMMLV lo fija la ley, pero su valor en pesos cambia con el SMMLV.

### Mantenimiento puntual (según eventos)

- **Cambios regulatorios:** Si la Superfinanciera modifica el límite de endeudamiento del 30%, actualizar `config/constants.js`.
- **Nueva versión de jsPDF:** Verificar que el CDN sigue disponible. Si cambia la URL, actualizar el script tag en `index.html`.
- **Caída de la API del Banrep:** El módulo UVR tiene manejo de error propio. Si la API cambia su estructura, actualizar `src/hooks/useUVR.js`.

---

## 10. Hoja de ruta de desarrollo

### Semana 1 — Cimientos (no hay UI todavía)

| Día | Tarea | Resultado |
|---|---|---|
| 1 | Crear repositorio en GitHub, configurar Cloudflare Pages | Sitio vacío en producción |
| 1 | Escribir `config/banks.js` con las 7 entidades | Fuente única de datos lista |
| 1 | Escribir `config/constants.js` y `config/subsidios.js` | Todos los datos configurados |
| 1 | Escribir `utils/formatters.js` | formatCOP(), formatM(), formatPct() |
| 2 | Escribir `calculators/amortization.js` | La matemática central testeada |
| 2 | Escribir `calculators/capacity.js` | Fórmula inversa testeada |
| 3 | Crear `index.html` con estructura base y meta tags SEO | Esqueleto HTML listo |
| 3 | Escribir `styles/theme.css` y `styles/global.css` | Identidad visual aplicada |

### Semana 2 — MVP funcional

| Día | Tarea | Resultado |
|---|---|---|
| 4 | `modules/BankComparator/` completo | Comparador de 7 bancos funcionando |
| 5 | `modules/AmortizationTable/` — AnnualView | Tabla anual visible |
| 6 | `modules/AmortizationTable/` — MonthlyView + paginación | Tabla mensual completa |
| 7 | `modules/CapacityCalc/` completo | Modo "cuánto puedo pedir" funcionando |
| 7 | Integrar `app.js` — todo conectado | **MVP lanzable** |

### Semana 3 — Diferenciadores y monetización

| Día | Tarea | Resultado |
|---|---|---|
| 8 | `utils/pdfExport.js` + botón descarga | PDF de la tabla de amortización |
| 9 | `calculators/extraPayments.js` + `modules/ExtraPayments/` | Abonos extraordinarios funcionando |
| 10 | `modules/LeadForm/` + integración Formspree | Captación de leads activa |
| 11 | Configurar Google AdSense | Primera fuente de ingresos activa |
| 11 | SEO on-page: title, meta description, headings, schema markup | Sitio indexable correctamente |

### Semana 4 — Módulos avanzados

| Día | Tarea | Resultado |
|---|---|---|
| 12 | `hooks/useUVR.js` + `modules/UVRComparator/` | Comparación pesos vs UVR |
| 13 | `modules/Subsidies/` con lógica Mi Casa Ya | Calculadora de subsidio |
| 14 | Slider interactivo de cuota inicial con actualización en tiempo real | Feature 7 completo |
| 15 | QA completo: probar todos los cálculos, responsive, velocidad de carga | Sitio en producción |

---

## Notas finales del arquitecto

**Lo que hace este proyecto viable a largo plazo:**

Cada módulo resuelve un problema concreto que un colombiano tiene en el momento exacto en que está considerando comprar vivienda. No es contenido informacional que Google puede reemplazar con un párrafo — es una herramienta que genera outputs personalizados, descargables e interactivos.

**Lo que requiere paciencia:**

Los primeros 6 meses el tráfico orgánico será mínimo. Google tarda en darle autoridad a un dominio nuevo. El modelo de ingresos solo funciona con tráfico, y el tráfico llega con tiempo y con contenido de calidad. El lead gen puede acelerar los ingresos si se establece el acuerdo con un broker antes de lanzar.

**El riesgo técnico más importante:**

La API del Banco de la República para el valor UVR. Si cambia su estructura o se cae temporalmente, el módulo UVR falla. Por eso está diseñado con manejo de error propio y el resto del sitio es completamente independiente de esa llamada.

**La actualización más crítica:**

Las tasas de los bancos en `config/banks.js`. Si quedan desactualizadas más de un trimestre, el comparador pierde credibilidad y el sitio pierde su diferencial principal. Es la única tarea de mantenimiento que no puede posponerse.

---

*Documento generado en Mayo 2026. Revisión prevista: Agosto 2026.*
