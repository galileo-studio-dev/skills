// Muestrario del banco de motion. Cada pieza del catálogo aparece aquí en una
// <section data-pieza="<id>"> con el mismo id que su entrada en ../../../piezas.json.
// Ver LEEME.md: «Registrar una pieza nueva».
import { Reveal, Steps, Comparison, ComparisonColumn, PullQuote, SectionHeading, Rows, Row } from "@/components/motion";

// Piezas en prueba (2026-11): textos tomados de /ia-onpremise de galileo-studio-web
// (messages/es.json, clave iaOnpremise.*), para ver las piezas con contenido real de Galileo.

const Espacio = () => <div className="banco-espacio" aria-hidden="true" />;

export default function Muestrario() {
  return (
    <main className="banco-raiz overflow-x-hidden">
      {/* La cabecera NO usa piezas de motion: el H1 es el elemento LCP. */}
      <header style={{ minHeight: "140vh" }}>
        <h1 style={{ fontSize: "2.5rem", paddingTop: "4rem" }}>Muestrario de movimiento de marca</h1>
        <p>Banco de pruebas del kit de motion del plugin sau. Desplázate para ver cada pieza.</p>
      </header>

      <section data-pieza="reveal-rise">
        <Reveal>
          <p>Este párrafo sube y aparece al entrar en pantalla, solo con CSS.</p>
        </Reveal>
      </section>
      <Espacio />

      <section data-pieza="reveal-mask">
        <Reveal as="h2" variant="mask">
          Título de sección con máscara
        </Reveal>
      </section>
      <Espacio />

      <section data-pieza="reveal-grupo">
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(3, 1fr)" }}>
          <Reveal index={0}><p>Tarjeta uno del grupo escalonado.</p></Reveal>
          <Reveal index={1}><p>Tarjeta dos del grupo escalonado.</p></Reveal>
          <Reveal index={2}><p>Tarjeta tres del grupo escalonado.</p></Reveal>
        </div>
      </section>
      <Espacio />

      <section data-pieza="pasos">
        <Steps>
          <ol>
            <li><strong>Diagnóstico.</strong> Revisamos procesos y datos.</li>
            <li><strong>Prototipo.</strong> Construimos sobre tus datos.</li>
            <li><strong>Despliegue.</strong> Lo integramos en tu equipo.</li>
          </ol>
        </Steps>
      </section>
      <Espacio />

      <section data-pieza="comparativa">
        <Comparison>
          <ComparisonColumn title="Software genérico">
            <ul>
              <li>Rápido de empezar.</li>
              <li>No conoce tus documentos.</li>
            </ul>
          </ComparisonColumn>
          <ComparisonColumn title="Solución a medida" highlight>
            <ul>
              <li>Construida sobre tus datos.</li>
              <li>Datos bajo tu control.</li>
            </ul>
          </ComparisonColumn>
        </Comparison>
      </section>
      <Espacio />

      <section data-pieza="cita-destacada">
        <PullQuote>
          <p>Una buena solución empieza en tus propios datos.</p>
        </PullQuote>
      </section>
      <Espacio />

      {/* ---------- Piezas en prueba ---------- */}

      <section data-pieza="encabezado-seccion">
        <SectionHeading
          index="02"
          eyebrow="Por qué"
          title="Por qué una pyme española debería considerar IA on-premise"
          description="Los cuatro motivos más habituales para instalar la IA en casa en lugar de contratarla como servicio."
        />
      </section>
      <Espacio />

      <section data-pieza="filas">
        <Rows>
          <dl>
            <Row label="RGPD">
              Se aplica a cualquier empresa que trate datos personales, sea cual sea su tamaño. Las multas pueden llegar a
              20 millones de euros o al 4 % del volumen de negocio anual global, la cifra mayor.
            </Row>
            <Row label="AI Act">
              Reglamento (UE) 2024/1689, en vigor desde agosto de 2024 y de aplicación escalonada. El Ómnibus digital sobre
              IA aplazó las obligaciones de los sistemas de alto riesgo al 2 de diciembre de 2027 (anexo III).
            </Row>
            <Row label="AEPD · AESIA">
              En España, la AEPD supervisa el tratamiento de datos personales y ha publicado guías sobre IA; la AESIA es la
              agencia estatal creada para supervisar la inteligencia artificial.
            </Row>
          </dl>
        </Rows>
      </section>
      <Espacio />
    </main>
  );
}
