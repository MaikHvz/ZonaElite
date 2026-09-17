// Guide Tour Data — Pure data definitions for all onboarding tours
// No dependencies, no React — just data

export interface GuideStep {
  /** CSS selector for the element to spotlight */
  targetSelector: string;
  /** Step title */
  title: string;
  /** Step description (supports line breaks with \n) */
  description: string;
  /** Material Symbols icon name */
  icon?: string;
  /** Preferred tooltip position relative to the target */
  position?: "top" | "bottom" | "left" | "right" | "auto";
}

export interface GuideTourDef {
  /** Unique tour identifier */
  id: string;
  /** Page title shown in the tooltip header */
  pageTitle: string;
  /** Material Symbols icon for the tour */
  icon: string;
  /** Tour steps */
  steps: GuideStep[];
}

// ─── Tour definitions ────────────────────────────────────────────────

export const GUIDE_TOURS: Record<string, GuideTourDef> = {
  membresias: {
    id: "membresias",
    pageTitle: "Membresías",
    icon: "card_membership",
    steps: [
      {
        targetSelector: "[data-guide='membresias-resumen']",
        title: "Resumen de cobertura",
        description:
          "Aquí ves un resumen de todos tus beneficiarios (tú y tus cargas) con su estado de inscripción y membresía. Verde = cobertura completa, amarillo = parcial.",
        icon: "monitoring",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='membresias-beneficiary']",
        title: "Tarjeta de beneficiario",
        description:
          "Cada tarjeta muestra un beneficiario: su inscripción vigente, membresía activa, tokens disponibles para agendar clases y packs de clases personalizadas.",
        icon: "person",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='membresias-comprar-inscripcion']",
        title: "Comprar inscripción (matrícula)",
        description:
          "La inscripción es un requisito para comprar membresías y agendar clases. Si algún beneficiario no tiene inscripción vigente, usa este botón para adquirir una.",
        icon: "add_shopping_cart",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='membresias-historial']",
        title: "Historial de membresías",
        description:
          "Revisa todas tus membresías: activas, vencidas y canceladas. Usa los filtros para encontrar rápidamente lo que buscas.",
        icon: "history",
        position: "top",
      },
      {
        targetSelector: "[data-guide='membresias-filtros']",
        title: "Filtros de estado",
        description:
          "Filtra tus membresías por estado: Todas, Activas, Vencidas o Canceladas.",
        icon: "filter_list",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='membresias-personalizadas']",
        title: "Clases personalizadas",
        description:
          "Si compraste un pack de clases personalizadas, aquí ves los horarios disponibles, la próxima sesión y puedes agendar directamente.",
        icon: "school",
        position: "top",
      },
    ],
  },

  horarios: {
    id: "horarios",
    pageTitle: "Agendamiento de Clases",
    icon: "calendar_month",
    steps: [
      {
        targetSelector: "[data-guide='horarios-modo']",
        title: "Tipo de clase",
        description:
          "Alterna entre clases de Membresías (incluidas en tu plan mensual) y clases Personalizadas (consumen un pack aparte).",
        icon: "toggle_on",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='horarios-filtros']",
        title: "Filtro por disciplina",
        description:
          "Filtra las clases por disciplina: Kenpo, Kickboxing, MMA, Funcional, etc. Solo se muestran las disciplinas con horarios activos.",
        icon: "filter_list",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='horarios-grilla']",
        title: "La grilla semanal",
        description:
          "Cada celda muestra una clase: disciplina (color), profesor, categoría (niños/adultos), fecha de la próxima sesión y cupos disponibles.",
        icon: "grid_on",
        position: "top",
      },
      {
        targetSelector: "[data-guide='horarios-celda']",
        title: "Agendar una clase",
        description:
          "Haz clic en una celda disponible para inscribirte. Se abrirá un modal donde seleccionas el beneficiario, se valida tu membresía e inscripción, y se confirma. Cada inscripción consume 1 token de tu membresía.",
        icon: "event_available",
        position: "auto",
      },
      {
        targetSelector: "[data-guide='horarios-leyenda']",
        title: "Leyenda de colores",
        description:
          "Verde = cupo disponible. Amarillo (borde) = últimos cupos. Rojo = clase llena. Las clases llenas no se pueden agendar.",
        icon: "palette",
        position: "top",
      },
    ],
  },

  cargas: {
    id: "cargas",
    pageTitle: "Cargas / Dependientes",
    icon: "group",
    steps: [
      {
        targetSelector: "[data-guide='cargas-header']",
        title: "¿Qué son las cargas?",
        description:
          "Las cargas son tus familiares o dependientes (hijos, pareja). Al agregarlos, puedes comprar membresías e inscripciones para ellos y agendar sus clases.",
        icon: "family_restroom",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='cargas-agregar']",
        title: "Agregar nueva carga",
        description:
          "Haz clic aquí para registrar un nuevo dependiente. Necesitarás su nombre, RUT, fecha de nacimiento y categoría (niño, juvenil o adulto).",
        icon: "person_add",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='cargas-card']",
        title: "Ficha de la carga",
        description:
          "Cada tarjeta muestra los datos de tu carga: nombre, categoría, RUT, dirección, datos físicos y perfil deportivo (cinturón y podios). Puedes editar los datos con el botón ✏️.",
        icon: "badge",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='cargas-tutor-sport']",
        title: "Tu perfil deportivo",
        description:
          "Aquí se muestra tu propio perfil deportivo como titular: disciplina, grado (cinturón) e historial de podios. Estos datos los gestiona el administrador de la academia.",
        icon: "sports_martial_arts",
        position: "bottom",
      },
    ],
  },

  perfil: {
    id: "perfil",
    pageTitle: "Mi Perfil",
    icon: "person",
    steps: [
      {
        targetSelector: "[data-guide='perfil-header']",
        title: "Tu perfil",
        description:
          "Aquí ves tu avatar con iniciales, nombre y email. Tu información se usa en recibos de pago y en el checkout de membresías.",
        icon: "account_circle",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='perfil-info']",
        title: "Información personal",
        description:
          "Edita tu nombre, teléfono, RUT, fecha de nacimiento y dirección. Estos datos se usan al comprar membresías y generar recibos.",
        icon: "badge",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='perfil-fisico']",
        title: "Datos físicos",
        description:
          "Registra tu peso (kg), altura (cm) y mano dominante. Esta información es útil para tu ficha deportiva y para los instructores.",
        icon: "monitor_weight",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='perfil-seguridad']",
        title: "Seguridad",
        description:
          "Verifica tu email y cambia tu contraseña de acceso en cualquier momento. La contraseña debe tener al menos 6 caracteres.",
        icon: "shield",
        position: "top",
      },
      {
        targetSelector: "[data-guide='perfil-sesion']",
        title: "Cerrar sesión",
        description:
          "Cierra tu sesión en este dispositivo. Deberás iniciar sesión nuevamente para acceder a tu cuenta.",
        icon: "logout",
        position: "top",
      },
    ],
  },

  landing: {
    id: "landing",
    pageTitle: "Guía de Compra y Uso",
    icon: "help_center",
    steps: [
      {
        targetSelector: "[data-guide='landing-pasos']",
        title: "Proceso en 3 Pasos",
        description:
          "Para entrenar en Zona Elite solo debes: 1) Pagar la Inscripción anual. 2) Elegir y comprar tu Membresía. 3) Agendar tus clases en la grilla horaria.",
        icon: "touch_app",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='landing-inscripcion']",
        title: "Inscripción Anual (Matrícula)",
        description:
          "Es la matrícula de la academia. Es obligatoria para ti y tus cargas familiares antes o durante la compra de membresías.",
        icon: "card_membership",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='landing-membresias']",
        title: "Selecciona tu Membresía",
        description:
          "Elige entre nuestros planes. Presiona 'Comprar Plan' para ir al checkout seguro con Webpay de Transbank.",
        icon: "shopping_cart",
        position: "top",
      },
      {
        targetSelector: "[data-guide='landing-personalizadas']",
        title: "Clases Personalizadas",
        description:
          "Si buscas un entrenamiento enfocado 1 a 1, también puedes adquirir packs de clases personalizadas y coordinar con nuestros instructores.",
        icon: "fitness_center",
        position: "top",
      },
    ],
  },

  dashboard: {
    id: "dashboard",
    pageTitle: "Panel Principal",
    icon: "dashboard",
    steps: [
      {
        targetSelector: "[data-guide='dashboard-greeting']",
        title: "Bienvenido a tu Panel",
        description:
          "Desde aquí tienes un resumen en tiempo real de tu cuenta: estado de inscripción, membresías activas, asistencia y notificaciones.",
        icon: "space_dashboard",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='dashboard-inscripcion']",
        title: "Estado de Inscripción",
        description:
          "Verifica si tu inscripción (matrícula anual) está activa. Es el requisito indispensable para adquirir membresías y reservar clases.",
        icon: "badge",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='dashboard-stats']",
        title: "Resumen de Métricas",
        description:
          "Visualiza tus clases asistidas, tokens mensuales disponibles y estado de tus pagos.",
        icon: "monitoring",
        position: "bottom",
      },
      {
        targetSelector: "[data-guide='dashboard-membresia']",
        title: "Tu Membresía Activa",
        description:
          "Acceso rápido a tu plan vigente, fecha de vencimiento y disciplinas incluidas.",
        icon: "card_membership",
        position: "top",
      },
      {
        targetSelector: "[data-guide='dashboard-actividad']",
        title: "Notificaciones y Actividad",
        description:
          "Revisa las últimas novedades, recordatorios de clases y confirmaciones de pago de la academia.",
        icon: "notifications",
        position: "top",
      },
    ],
  },
};

/** Get a tour definition by ID */
export function getGuideTour(id: string): GuideTourDef | null {
  return GUIDE_TOURS[id] || null;
}

/** All available tour IDs */
export const GUIDE_TOUR_IDS = Object.keys(GUIDE_TOURS);

/** LocalStorage key prefix for tracking viewed tours */
export const GUIDE_VIEWED_PREFIX = "ze_guide_viewed_";

