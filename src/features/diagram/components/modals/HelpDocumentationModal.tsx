import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  BookOpen,
  CheckCircle2,
  FlaskConical,
  AlertTriangle,
  Telescope,
  Languages,
  Mail,
  Rocket,
  Layers,
  Cpu,
  GitBranch,
  Cloud,
  UserCircle2,
  ArrowRightLeft,
  PackageCheck,
  Heart,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'es';

// ─── Bilingual Content Dictionary ─────────────────────────────────────────────

const COPY = {
  en: {
    // ── UI chrome ──────────────────────────────────────────────────────────
    modalTitle: 'Help & Roadmap',
    modalSubtitle: 'LibreUML v0.7.0 — Beta',
    langToggleLabel: 'Español',
    closeLabel: 'Close',

    // ── Section 1: Welcome ─────────────────────────────────────────────────
    s1Title: 'Welcome to LibreUML v0.7.0',
    s1Lead:
      'LibreUML is a free, open-source UML editor built for students and engineers who believe that professional-grade software design tools should be available to everyone — without paywalls, subscriptions, or artificial limits.',
    s1Mission:
      'Our mission is simple: give you the environment you need to learn real software architecture and communicate design ideas clearly, whether you are working on a university assignment, a team project, or your first open-source contribution.',
    s1Thanks:
      'You are part of our first beta cohort, and your feedback is the most valuable contribution you can make. Every bug you report, every suggestion you leave, and every hour you spend working with the tool helps us build something better.',
    s1Quote: '"Every bug reported makes LibreUML better."',
    s1ContactLabel: 'Found a bug or have a suggestion?',
    s1ContactLine: 'Write to us at',
    s1Email: 'support.libreuml@gmail.com',

    // ── Section 2: Stable Features ─────────────────────────────────────────
    s2Title: 'What LibreUML Does Today',
    s2Badge: 'Stable · v0.7.0',
    s2Intro:
      'The following features are considered stable and ready for everyday use in your projects and coursework.',
    s2Features: [
      {
        title: 'UML Class Diagrams',
        body: 'Create fully featured class diagrams with Classes, Abstract Classes, Interfaces, Enumerations, Attributes (with visibility and types), and Methods. Connect them with all six standard UML relationship types: Association, Inheritance, Realization, Dependency, Aggregation, and Composition.',
      },
      {
        title: 'High-Fidelity Exports (PNG / SVG)',
        body: 'Export your diagrams to crisp PNG images at 1×, 2×, or 4× resolution, or as clean SVG vector files. The export engine captures the entire diagram viewport without scrollbars or clipping artifacts.',
      },
      {
        title: 'Standalone Environments (State Forking)',
        body: 'NEW: We isolated the memory. Each file can operate in an independent semantic "Sandbox" via State Forking. This creates an exclusive Semantic Model (Single Source of Truth) for that file, preventing data leaks and allowing safe experimentation without corrupting the global project.',
      },
      {
        title: 'Project-Based Workspaces (VFS)',
        body: 'Organize multiple diagram files inside a single project container (.luml.zip). The built-in virtual file system lets you create folders, rename files inline, and switch between diagrams without losing context.',
      },
    ],

    // ── Section 3: Experimental ────────────────────────────────────────────
    s3Title: 'Experimental Phase',
    s3Badge: 'Experimental — Use with Caution',
    s3Intro:
      'The features below are functional but actively being hardened. You may encounter edge cases or inconsistencies. Your reports on these features are especially valuable.',
    s3Features: [
      {
        title: 'Legacy File Import (.luml)',
        body: 'LibreUML can open and attempt to map diagram files created in earlier versions of the tool. The importer handles most structural cases, but complex diagrams with custom metadata may not migrate perfectly. Always keep a backup of your original files.',
      },
      {
        title: 'Basic Code Generation — Java Forward Mapping',
        body: 'Generate Java source code stubs directly from a UML Class Diagram. The generator produces class skeletons with field declarations, constructor signatures, and method stubs based on your diagram model. This feature currently targets Java and is in the process of being extended to additional target languages.',
      },
    ],

    // ── Section 4: Limitations & Short-Term Roadmap ────────────────────────
    s4Title: 'Current Limitations & Short-Term Roadmap',
    s4Badge: 'Known Limitations',
    s4LimitationsTitle: 'Known Limitations',
    s4Limitations: [
      {
        title: 'Performance on Massive Diagrams',
        body: 'Diagrams with 80+ nodes might experience latency. The technical reason is our current DOM-based rendering engine (React Flow). Rendering massive nested subtrees bottlenecks the browser\'s repaint cycle. Our top short-term priority is migrating the engine to HTML5 Canvas (React-Konva) for infinite scalability.',
      },
    ],
    s4RoadmapTitle: 'Coming Soon',
    s4Roadmap: [
      {
        title: 'Canvas Engine Migration → React-Konva (HTML5 Canvas)',
        body: 'We are planning a full migration of the rendering engine from DOM-based React Flow to a native HTML5 Canvas implementation using React-Konva. This will unlock near-infinite scalability, GPU-accelerated rendering, and dramatically smoother interactions on large diagrams.',
      },
      {
        title: 'Undo / Redo (Ctrl+Z / Ctrl+Y)',
        body: 'A full command-history stack for all diagram editing operations is one of our highest-priority short-term features.',
      },
      {
        title: 'Visually Nested Packages',
        body: 'Package containers will be rendered as visual bounding boxes that physically surround their member classes on the canvas, rather than being listed only in the sidebar.',
      },
      {
        title: 'Orthogonal Smart-Routing for Arrows',
        body: 'Relationship arrows will automatically route around obstacles using an orthogonal (right-angle) pathfinding algorithm, eliminating diagonal lines that cross over nodes.',
      },
    ],

    // ── Section 5: Mid-Term Vision ─────────────────────────────────────────
    s5Title: 'Mid-Term Vision',
    s5Badge: 'On the Horizon',
    s5Intro:
      'These are the capabilities we are designing toward. Nothing here is guaranteed for a specific release, but they represent the direction LibreUML is heading.',
    s5Items: [
      {
        icon: 'cloud',
        title: 'Cloud Synchronization & Storage',
        body: 'Save and load projects directly from a secure cloud backend. Access your diagrams from any device without manual file transfers.',
      },
      {
        icon: 'user',
        title: 'User Authentication — Login & Profiles',
        body: 'Personal accounts with project ownership, sharing permissions, and contribution history for collaborative workflows.',
      },
      {
        icon: 'reverse',
        title: 'Robust Reverse Engineering (Java → UML)',
        body: 'Parse real Java source code or compiled .class files and automatically reconstruct the corresponding UML Class Diagram with accurate relationships, types, and visibility modifiers.',
      },
      {
        icon: 'github',
        title: 'Direct GitHub Export & Synchronization',
        body: 'Push diagram files and generated source code directly to a GitHub repository. Keep your architecture documentation version-controlled alongside your code.',
      },
    ],

    // ── Section 6: Cornerstone (Community) ─────────────────────────────────
    s6Title: 'The Cornerstone of LibreUML',
    s6Body:
      'You, our beta testers, are the engine of this project. Every bug you report and every hour you spend designing here is another brick in our architecture. Thank you for building LibreUML alongside us.',
    s6ContactLine: 'Questions or reports? Reach out at: ',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SPANISH
  // ══════════════════════════════════════════════════════════════════════════

  es: {
    // ── UI chrome ──────────────────────────────────────────────────────────
    modalTitle: 'Ayuda y Hoja de Ruta',
    modalSubtitle: 'LibreUML v0.7.0 — Beta',
    langToggleLabel: 'English',
    closeLabel: 'Cerrar',

    // ── Sección 1: Bienvenida ──────────────────────────────────────────────
    s1Title: 'Bienvenido a LibreUML v0.7.0',
    s1Lead:
      'LibreUML es un editor UML gratuito y de código abierto creado para estudiantes e ingenieros que creen que las herramientas de diseño de software de nivel profesional deben estar disponibles para todos — sin muros de pago, sin suscripciones, sin límites artificiales.',
    s1Mission:
      'Nuestra misión es simple: darte el entorno que necesitas para aprender arquitectura de software real y comunicar ideas de diseño con claridad, ya sea que estés trabajando en una tarea universitaria, un proyecto de equipo, o tu primera contribución de código abierto.',
    s1Thanks:
      'Eres parte de nuestro primer grupo de beta testers, y tu retroalimentación es la contribución más valiosa que puedes hacer. Cada error que reportas, cada sugerencia que dejas, y cada hora que trabajas con la herramienta nos ayuda a construir algo mejor.',
    s1Quote: '"Cada error reportado hace que LibreUML sea mejor."',
    s1ContactLabel: '¿Encontraste un error o tienes una sugerencia?',
    s1ContactLine: 'Escríbenos a',
    s1Email: 'support.libreuml@gmail.com',

    // ── Sección 2: Funcionalidades Estables ────────────────────────────────
    s2Title: 'Lo que LibreUML hace hoy',
    s2Badge: 'Estable · v0.7.0',
    s2Intro:
      'Las siguientes funcionalidades se consideran estables y están listas para el uso cotidiano en tus proyectos y cursos.',
    s2Features: [
      {
        title: 'Diagramas de Clases UML',
        body: 'Crea diagramas de clases completos con Clases, Clases Abstractas, Interfaces, Enumeraciones, Atributos (con visibilidad y tipos) y Métodos. Conéctalos con los seis tipos de relaciones estándar de UML: Asociación, Herencia, Realización, Dependencia, Agregación y Composición.',
      },
      {
        title: 'Exportaciones de Alta Fidelidad (PNG / SVG)',
        body: 'Exporta tus diagramas a imágenes PNG nítidas en resolución 1×, 2× o 4×, o como archivos vectoriales SVG limpios. El motor de exportación captura todo el viewport del diagrama sin barras de desplazamiento ni recortes.',
      },
      {
        title: 'Entornos Standalone (Bifurcación de Estado)',
        body: 'NUEVO: Aislamos la memoria. Cada archivo puede operar en un "Sandbox" semántico independiente mediante Bifurcación de Estado (State Forking). Esto crea un Modelo Semántico (Single Source of Truth) exclusivo para ese archivo, previniendo fugas de datos y permitiendo experimentación segura sin corromper el proyecto global.',
      },
      {
        title: 'Espacios de Trabajo por Proyecto (VFS)',
        body: 'Organiza múltiples archivos de diagrama dentro de un único contenedor de proyecto (.luml.zip). El sistema de archivos virtual integrado te permite crear carpetas, renombrar archivos en línea y cambiar entre diagramas sin perder el contexto.',
      },
    ],

    // ── Sección 3: Fase Experimental ──────────────────────────────────────
    s3Title: 'En Fase Experimental',
    s3Badge: 'Experimental — Usar con Precaución',
    s3Intro:
      'Las funcionalidades a continuación son operativas pero se están robusteciendo activamente. Es posible que encuentres casos extremos o inconsistencias. Tus reportes sobre estas funcionalidades son especialmente valiosos.',
    s3Features: [
      {
        title: 'Importación de Archivos Legados (.luml)',
        body: 'LibreUML puede abrir e intentar mapear archivos de diagrama creados en versiones anteriores de la herramienta. El importador maneja la mayoría de los casos estructurales, pero los diagramas complejos con metadatos personalizados pueden no migrarse perfectamente. Conserva siempre una copia de seguridad de tus archivos originales.',
      },
      {
        title: 'Generación Básica de Código — Mapeo Directo a Java',
        body: 'Genera esqueletos de código fuente Java directamente desde un Diagrama de Clases UML. El generador produce estructuras de clases con declaraciones de campos, firmas de constructores y stubs de métodos basados en tu modelo de diagrama. Esta funcionalidad actualmente apunta a Java y está en proceso de ser extendida a lenguajes adicionales.',
      },
    ],

    // ── Sección 4: Limitaciones y Hoja de Ruta a Corto Plazo ──────────────
    s4Title: 'Limitaciones Actuales y Hoja de Ruta',
    s4Badge: 'Limitaciones Conocidas',
    s4LimitationsTitle: 'Limitaciones Conocidas',
    s4Limitations: [
      {
        title: 'Rendimiento en Diagramas Masivos',
        body: 'Los diagramas con más de 80 nodos pueden experimentar latencia. La razón técnica es nuestro motor actual (React Flow), el cual depende del DOM. Renderizar árboles anidados masivos satura el repintado del navegador. Nuestra máxima prioridad a corto plazo es migrar el motor a HTML5 Canvas (React-Konva) para lograr escalabilidad infinita.',
      },
    ],
    s4RoadmapTitle: 'Próximamente',
    s4Roadmap: [
      {
        title: 'Migración del Motor de Canvas → React-Konva (HTML5 Canvas)',
        body: 'Estamos planeando una migración completa del motor de renderizado desde React Flow (basado en DOM) hacia una implementación nativa en HTML5 Canvas usando React-Konva. Esto desbloqueará escalabilidad prácticamente ilimitada, renderizado acelerado por GPU e interacciones mucho más fluidas en diagramas grandes.',
      },
      {
        title: 'Deshacer / Rehacer (Ctrl+Z / Ctrl+Y)',
        body: 'Una pila de historial de comandos completa para todas las operaciones de edición de diagramas es una de nuestras funcionalidades de mayor prioridad a corto plazo.',
      },
      {
        title: 'Paquetes Visualmente Anidados',
        body: 'Los contenedores de paquetes se renderizarán como cajas delimitadoras visuales que rodean físicamente a sus clases miembro en el canvas, en lugar de aparecer listados únicamente en la barra lateral.',
      },
      {
        title: 'Enrutamiento Ortogonal Inteligente para Flechas',
        body: 'Las flechas de relación se enrutarán automáticamente alrededor de los obstáculos usando un algoritmo de búsqueda de caminos ortogonal (ángulos rectos), eliminando las líneas diagonales que cruzan sobre los nodos.',
      },
    ],

    // ── Sección 5: Visión a Mediano Plazo ─────────────────────────────────
    s5Title: 'Visión a Mediano Plazo',
    s5Badge: 'En el Horizonte',
    s5Intro:
      'Estas son las capacidades hacia las que estamos diseñando. Nada aquí está garantizado para una versión específica, pero representan la dirección en la que LibreUML está avanzando.',
    s5Items: [
      {
        icon: 'cloud',
        title: 'Sincronización y Almacenamiento en la Nube',
        body: 'Guarda y carga proyectos directamente desde un backend seguro en la nube. Accede a tus diagramas desde cualquier dispositivo sin transferencias manuales de archivos.',
      },
      {
        icon: 'user',
        title: 'Autenticación de Usuarios — Login y Perfiles',
        body: 'Cuentas personales con propiedad de proyectos, permisos de compartición e historial de contribuciones para flujos de trabajo colaborativos.',
      },
      {
        icon: 'reverse',
        title: 'Ingeniería Inversa Robusta (Java → UML)',
        body: 'Analizar código fuente Java real o archivos .class compilados y reconstruir automáticamente el Diagrama de Clases UML correspondiente con relaciones, tipos y modificadores de visibilidad precisos.',
      },
      {
        icon: 'github',
        title: 'Exportación y Sincronización Directa con GitHub',
        body: 'Envía archivos de diagrama y código fuente generado directamente a un repositorio de GitHub. Mantén la documentación de tu arquitectura versionada junto a tu código.',
      },
    ],

    // ── Sección 6: Cornerstone (Community) ─────────────────────────────────
    s6Title: 'La Piedra Angular de LibreUML',
    s6Body:
      'Ustedes, nuestros beta testers, son el motor de este proyecto. Cada bug que reportan y cada hora que diseñan en esta herramienta es un ladrillo más en nuestra arquitectura. Gracias por construir LibreUML con nosotros.',
    s6ContactLine: '¿Dudas o reportes? Escríbenos a: ',
  },
} as const;

// ─── Icon Resolver ─────────────────────────────────────────────────────────────

function VisionIcon({ icon }: { icon: string }) {
  const cls = 'w-5 h-5';
  switch (icon) {
    case 'cloud':   return <Cloud className={cls} />;
    case 'user':    return <UserCircle2 className={cls} />;
    case 'reverse': return <ArrowRightLeft className={cls} />;
    case 'github':  return <GitBranch className={cls} />;
    default:        return <Rocket className={cls} />;
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionBadge({ label, variant }: { label: string; variant: 'stable' | 'experimental' | 'warning' | 'horizon' }) {
  const styles = {
    stable:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    experimental: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
    warning:      'bg-red-500/10    text-red-400    border-red-500/20',
    horizon:      'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border rounded-full ${styles[variant]}`}>
      {label}
    </span>
  );
}

function SectionDivider() {
  return <hr className="border-surface-border my-8" />;
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-surface-secondary border border-surface-border">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
        <p className="text-xs leading-relaxed text-text-secondary">{body}</p>
      </div>
    </div>
  );
}

function ExperimentalCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
      <FlaskConical className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-amber-300 mb-1">{title}</p>
        <p className="text-xs leading-relaxed text-text-secondary">{body}</p>
      </div>
    </div>
  );
}

function LimitationCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-red-300 mb-1">{title}</p>
        <p className="text-xs leading-relaxed text-text-secondary">{body}</p>
      </div>
    </div>
  );
}

function RoadmapCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
      <Rocket className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-blue-300 mb-1">{title}</p>
        <p className="text-xs leading-relaxed text-text-secondary">{body}</p>
      </div>
    </div>
  );
}

function VisionCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex gap-3 p-4 rounded-lg bg-surface-secondary border border-surface-border hover:border-purple-500/30 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
        <VisionIcon icon={icon} />
      </div>
      <div>
        <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
        <p className="text-xs leading-relaxed text-text-secondary">{body}</p>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface HelpDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpDocumentationModal({ isOpen, onClose }: HelpDocumentationModalProps) {
  const [lang, setLang] = useState<Lang>('en');
  const c = COPY[lang];

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary leading-tight">
                {c.modalTitle}
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5 font-mono">
                {c.modalSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
              title="Toggle language / Cambiar idioma"
            >
              <Languages className="w-3.5 h-3.5" />
              {c.langToggleLabel}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-text-muted hover:text-text-primary"
              title={c.closeLabel}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-0">

          {/* ── Section 1: Welcome ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/logoTitle.svg"
                alt="LibreUML"
                className="w-8 h-8 object-contain drop-shadow-sm"
              />
              <h3 className="text-xl font-bold text-text-primary">
                {c.s1Title}
              </h3>
            </div>

            <p className="text-sm leading-7 text-text-secondary mb-3">
              {c.s1Lead}
            </p>
            <p className="text-sm leading-7 text-text-secondary mb-5">
              {c.s1Mission}
            </p>
            <p className="text-sm leading-7 text-text-secondary mb-5">
              {c.s1Thanks}
            </p>

            {/* Pull-quote */}
            <blockquote className="border-l-4 border-blue-500/50 pl-4 py-1 mb-5">
              <p className="text-sm italic text-blue-300 font-medium">
                {c.s1Quote}
              </p>
            </blockquote>

            {/* Contact card */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-secondary border border-surface-border">
              <Mail className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
              <div className="text-xs text-text-secondary">
                <span className="font-medium text-text-primary">{c.s1ContactLabel}</span>
                {' '}{c.s1ContactLine}{' '}
                <a
                  href={`mailto:${c.s1Email}`}
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.s1Email}
                </a>
              </div>
            </div>
          </section>

          <SectionDivider />

          {/* ── Section 2: Stable Features ──────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-1.5 bg-emerald-500/10 rounded-md">
                <PackageCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-text-primary">{c.s2Title}</h3>
            </div>
            <div className="mb-4">
              <SectionBadge label={c.s2Badge} variant="stable" />
            </div>
            <p className="text-sm leading-7 text-text-secondary mb-4">{c.s2Intro}</p>
            <div className="space-y-3">
              {c.s2Features.map((f) => (
                <FeatureCard key={f.title} title={f.title} body={f.body} />
              ))}
            </div>
          </section>

          <SectionDivider />

          {/* ── Section 3: Experimental ─────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-1.5 bg-amber-500/10 rounded-md">
                <FlaskConical className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-text-primary">{c.s3Title}</h3>
            </div>
            <div className="mb-4">
              <SectionBadge label={c.s3Badge} variant="experimental" />
            </div>
            <p className="text-sm leading-7 text-text-secondary mb-4">{c.s3Intro}</p>
            <div className="space-y-3">
              {c.s3Features.map((f) => (
                <ExperimentalCard key={f.title} title={f.title} body={f.body} />
              ))}
            </div>
          </section>

          <SectionDivider />

          {/* ── Section 4: Limitations & Roadmap ────────────────────────── */}
          <section>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-1.5 bg-red-500/10 rounded-md">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <h3 className="text-base font-bold text-text-primary">{c.s4Title}</h3>
            </div>
            <div className="mb-4">
              <SectionBadge label={c.s4Badge} variant="warning" />
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">
              {c.s4LimitationsTitle}
            </p>
            <div className="space-y-3 mb-6">
              {c.s4Limitations.map((item) => (
                <LimitationCard key={item.title} title={item.title} body={item.body} />
              ))}
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">
              {c.s4RoadmapTitle}
            </p>
            <div className="space-y-3">
              {c.s4Roadmap.map((item) => (
                <RoadmapCard key={item.title} title={item.title} body={item.body} />
              ))}
            </div>
          </section>

          <SectionDivider />

          {/* ── Section 5: Mid-Term Vision ───────────────────────────────── */}
          <section>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-1.5 bg-purple-500/10 rounded-md">
                <Telescope className="w-4 h-4 text-purple-400" />
              </div>
              <h3 className="text-base font-bold text-text-primary">{c.s5Title}</h3>
            </div>
            <div className="mb-4">
              <SectionBadge label={c.s5Badge} variant="horizon" />
            </div>
            <p className="text-sm leading-7 text-text-secondary mb-4">{c.s5Intro}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {c.s5Items.map((item) => (
                <VisionCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
            </div>
          </section>

          <SectionDivider />

          {/* ── Section 6: Cornerstone (Community) ───────────────────────── */}
          <section className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-6 text-center">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">
              {c.s6Title}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed max-w-lg mx-auto mb-4">
              {c.s6Body}
            </p>
            <p className="text-xs text-text-muted">
              {c.s6ContactLine}
              <a
                href={`mailto:${c.s1Email}`}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {c.s1Email}
              </a>
            </p>
          </section>

          {/* ── Footer padding ───────────────────────────────────────────── */}
          <div className="h-4" />
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-surface-border flex items-center justify-between shrink-0 bg-surface-primary rounded-b-xl">
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <Cpu className="w-3.5 h-3.5" />
            <span>LibreUML v0.7.0 · Open Source</span>
            <span className="opacity-40">·</span>
            <Layers className="w-3.5 h-3.5" />
            <span>React + Electron</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {c.closeLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}