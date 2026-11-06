// Muestrario del banco de motion. Cada pieza del catálogo aparece aquí en una
// <section data-pieza="<id>"> con el mismo id que su entrada en ../../../piezas.json.
// Ver LEEME.md: «Registrar una pieza nueva».
import { Reveal, Steps, Comparison, ComparisonColumn, PullQuote } from "@/components/motion";

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
    </main>
  );
}
