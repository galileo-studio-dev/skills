// Muestrario del banco de motion. Cada pieza del catálogo aparece aquí en una
// <section data-pieza="<id>"> con el mismo id que su entrada en ../../../piezas.json.
// Ver LEEME.md: «Registrar una pieza nueva».
import { Reveal, Steps, Comparison, ComparisonColumn, PullQuote, SectionHeading, Rows, Row, Bento, BentoItem } from "@/components/motion";

// Piezas en prueba (2026-11): textos tomados de /ia-onpremise de galileo-studio-web
// (messages/es.json, clave iaOnpremise.*), para ver las piezas con contenido real de Galileo.

const Espacio = () => <div className="banco-espacio" aria-hidden="true" />;

/** Icono de trazo fino (sustituye a lucide-react en el banco, que no tiene dependencias de iconos). */
const Icono = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

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

      <section data-pieza="bento-rejilla">
        <Bento columns={4} variant="grid" numbered>
          <ul>
            <BentoItem title="Protección de datos de negocio" icon={<Icono d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />}>
              <p>Datos de clientes, propuestas, proyectos o cifras financieras se procesan en tu infraestructura.</p>
            </BentoItem>
            <BentoItem title="RGPD y AI Act: control demostrable" icon={<Icono d="M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z" />}>
              <p>Si no envías datos personales a un proveedor de IA, tienes menos encargados del tratamiento y menos transferencias que justificar.</p>
            </BentoItem>
            <BentoItem title="Coste predecible a largo plazo" icon={<Icono d="M4 12a8 6 0 1016 0 8 6 0 10-16 0M12 9v6" />}>
              <p>En on-premise, el coste principal es la infraestructura y su mantenimiento, y depende menos del número de usuarios.</p>
            </BentoItem>
            <BentoItem title="Personalización: una IA que conoce tu empresa" icon={<Icono d="M8 4h8v6h4v8h-6v-4H8z" />}>
              <p>Con RAG trabaja sobre tu documentación interna; con integraciones, sobre tu CRM o tu ERP.</p>
            </BentoItem>
          </ul>
        </Bento>
      </section>
      <Espacio />

      <section data-pieza="bento-tarjetas">
        <Bento columns={4}>
          <ul>
            <BentoItem title="Infraestructura" icon={<Icono d="M4 5h16v6H4zM4 13h16v6H4z" />}>
              <p>Compra de un servidor con GPU o alquiler de un servidor dedicado.</p>
            </BentoItem>
            <BentoItem title="Implantación" icon={<Icono d="M12 3l4 9-4 9-4-9z" />}>
              <p>Diagnóstico, despliegue, integraciones y piloto. Se paga una vez por caso de uso.</p>
            </BentoItem>
            <BentoItem title="Operación" icon={<Icono d="M12 8a4 4 0 100 8 4 4 0 000-8M12 2v3M12 19v3M2 12h3M19 12h3" />}>
              <p>Mantenimiento, actualizaciones, energía o cuota del centro de datos, y soporte.</p>
            </BentoItem>
            <BentoItem title="Frente a la nube" muted icon={<Icono d="M7 18h10a4 4 0 000-8 6 6 0 00-11 2 3 3 0 001 6z" />}>
              <p>Las suscripciones se pagan por usuario o por consumo cada mes.</p>
            </BentoItem>
          </ul>
        </Bento>
      </section>
      <Espacio />

      {/* Lo que produce el blog con :::bento{columnas=3 numerada} (fixtures/markdown/bento.md):
          el renderizador `div` del blog devuelve <Bento> con la lista del Markdown dentro. */}
      <section data-pieza="bento-blog">
        <Bento columns={3} numbered>
          <ul>
            <li><strong>Datos en casa.</strong> Nada sale de tu red.</li>
            <li><strong>Cumplimiento.</strong> RGPD y AI Act desde el diseño.</li>
            <li><strong>Coste previsible.</strong> Sin pago por uso.</li>
          </ul>
        </Bento>
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
