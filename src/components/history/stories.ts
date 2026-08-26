export interface StoryChapter {
  id: string;
  period: string;
  yearLabel: string;
  title: string;
  lead: string;
  paragraphs: string[];
  quote?: { text: string; author: string };
  facts?: string[];
}

export interface DisciplineStory {
  id: "kenpo" | "kickboxing" | "sport_kempo";
  name: string;
  subtitle: string;
  icon: string;
  tagline: string;
  short: string;
  badge?: string;
  accent: string;
  whatIs: {
    kicker: string;
    title: string;
    paragraphs: string[];
    quote?: { text: string; author: string };
  };
  chapters: StoryChapter[];
  ending: {
    title: string;
    text: string;
    action: string;
  };
}

export const STORIES: DisciplineStory[] = [
  {
    id: "kenpo",
    name: "Kenpo",
    subtitle: "American Kenpo",
    icon: "sports_martial_arts",
    tagline: "El arte de la velocidad y la lógica",
    short:
      "Nuestra raíz. El sistema de defensa personal más científico del mundo, del maestro Ed Parker.",
    badge: "Nuestra raíz",
    accent: "#ff544c",
    whatIs: {
      kicker: "01 — La base de ZonaElite",
      title: "¿Qué es el American Kenpo?",
      paragraphs: [
        "El American Kenpo es un sistema de defensa personal moderna nacido de la fusión entre las artes marciales chinas, el boxeo y la experiencia callejera. Su creador, el maestro Ed Parker, lo definió como «el arte de la velocidad y la lógica»: no busca coreografías para el escenario, sino respuestas eficientes, adaptables y devastadoramente rápidas ante una amenaza real.",
        "«Kenpo» significa «ley del puño» (ken = puño, po = ley o método). Pero el American Kenpo va mucho más allá de los golpes: es un método de pensamiento marcial que enseña a reconocer patrones de ataque, a estructurar la respuesta en fracciones de segundo y a moverse con economía absoluta de energía.",
        "En ZonaElite, el Kenpo es la columna vertebral de la academia: primero entendemos de dónde viene, porque solo respetando la raíz se construye técnica con verdad.",
      ],
      quote: {
        text: "Lo que funciona en la calle es lo que queda. El resto, es entretención.",
        author: "Principio del American Kenpo",
      },
    },
    chapters: [
      {
        id: "shaolin",
        period: "S. VI",
        yearLabel: "Siglo VI",
        title: "La semilla en el templo Shaolin",
        lead: "Todo gran río nace de una fuente pequeña. El camino del puño comienza en las montañas de China.",
        paragraphs: [
          "La historia del Kenpo se remonta a más de mil años, a los legendarios monasterios Shaolin de China, donde los monjes combinaban la meditación con un arte marcial práctico que les permitía protegerse en sus largas peregrinaciones. Allí se codificaron los primeros principios de golpeo, evasión y estructura corporal.",
          "Con el tiempo, la línea del «Puño Blanco» (Bai Mei) y otras ramas del boxeo del sur de China guardaron celosamente estos conocimientos. El movimiento empezó a viajar: primero dentro de China y luego, con la gran diáspora del siglo XIX, hacia los puertos del Pacífico. El camino del puño se preparaba para cruzar el océano.",
        ],
        quote: {
          text: "El golpe nace en el suelo, viaja por las piernas y explota en el puño.",
          author: "Máxima del boxeo chino",
        },
        facts: [
          "Kenpo deriva de la expresión china «quánfǎ», que significa «método del puño».",
          "El templo Shaolin es considerado la cuna de la mayoría de los estilos del sur de China.",
        ],
      },
      {
        id: "mitose",
        period: "1930-40",
        yearLabel: "1942",
        title: "El viaje a Hawái: James Mitose",
        lead: "Un hombre nacido entre dos culturas lleva el arte a un archipiélago donde se mezclarían todos los puños del mundo.",
        paragraphs: [
          "A comienzos del siglo XX, la inmigración china y japonesa convirtió a Hawái en un crisol de artes marciales. Allí vivía James Mitose, un joven de ascendencia japonesa que pasó años en Japón aprendiendo el Kosho Ryu, el arte familiar de su linaje: un sistema de defensa personal que no distinguía entre el combate de pie, los agarres o el suelo.",
          "En los años treinta y cuarenta, Mitose abrió su escuela en Honolulu y empezó a enseñar lo que llamó «Kenpo Karate». Sus clases no eran coreografías: eran lecciones de supervivencia ante un atacante real. Entre sus alumnos más dedicados estaba un joven luchador llamado William K.S. Chow.",
        ],
        quote: {
          text: "No me interesa cuántos movimientos conoces. Me interesa qué haces cuando tu vida depende de uno.",
          author: "James Mitose",
        },
        facts: [
          "El Kosho Ryu de Mitose significa «la escuela del viejo pino».",
          "Mitose enfrentó la Segunda Guerra Mundial enseñando defensa personal a la población civil de Hawái.",
        ],
      },
      {
        id: "chow",
        period: "1940-50",
        yearLabel: "1950",
        title: "William Chow y el Kenpo Karate",
        lead: "La mezcla entre la tradición asiática y la dureza de las calles hawaianas produce un sistema nuevo.",
        paragraphs: [
          "William K.S. Chow no se conformó con repetir lo aprendido. Criado entre las peleas callejeras de Honolulu, tomó las técnicas del Kosho Ryu y las fusionó con los golpes del boxeo occidental y el instinto de la pelea real. Nacía una versión más directa, más dura y más urbana del Kenpo.",
          "Chow fue parte del grupo de pioneros que también participó en la creación del Kajukenbo, otro sistema híbrido de Hawái, pero su gran contribución fue pulir el Kenpo Karate como un método propio: técnica limpia, desplazamientos agresivos y una obsesión por la autodefensa efectiva. Su escuela formaría a los hombres que llevarían el arte al continente americano.",
        ],
        quote: {
          text: "Un solo golpe bien pensado vale más que mil movimientos sin propósito.",
          author: "William K.S. Chow",
        },
        facts: [
          "Chow enseñó a muchos de los grandes nombres que luego popularizaron el Kenpo en EE. UU.",
          "Fue cofundador intelectual de la corriente que dio origen al Kajukenbo.",
        ],
      },
      {
        id: "parker",
        period: "1954-56",
        yearLabel: "1956",
        title: "Ed Parker: nace el American Kenpo",
        lead: "Un estudiante de Chow cruza el Pacífico y transforma el Kenpo en una ciencia de la autodefensa para el mundo moderno.",
        paragraphs: [
          "Ed Parker nació en Hawái en 1931. Tras formarse bajo la tutela de William Chow, se mudó al continente para estudiar en la Universidad Brigham Young, en Utah. En 1954 abrió su primera escuela de Kenpo en Provo y en 1956 fundó su célebre academia en Pasadena, California. Allí bautizó su método como «American Kenpo».",
          "Parker no era un tradicionalista dogmático: era un estudiante incansable de anatomía, física y psicología del conflicto. Aplicó la ciencia al arte. Reorganizó el sistema en cinturones con técnicas de defensa numeradas, eliminó lo decorativo y dejó lo esencial: velocidad, lógica y adaptabilidad. La calle —decía— no perdona lo innecesario.",
        ],
        quote: {
          text: "El Kenpo es la ciencia de la autodefensa: se mueve con la lógica de la física y la velocidad del rayo.",
          author: "Ed Parker",
        },
        facts: [
          "Ed Parker fundó la Asociación Internacional de Kenpo Karate (IKKA) en 1957.",
          "Sus primeras escuelas en Provo y Pasadena definieron el estándar del American Kenpo.",
        ],
      },
      {
        id: "hollywood",
        period: "1960-70",
        yearLabel: "1960",
        title: "Hollywood y la era de oro",
        lead: "Las cámaras descubren al maestro y el Kenpo se convierte en el arte marcial más famoso de la pantalla.",
        paragraphs: [
          "Ed Parker era también un comunicador brillante. Enseñó a celebridades como Elvis Presley, Robert Wagner, James Caan y Warren Beatty, y coreografió escenas de pelea para el cine de Hollywood. De pronto, el Kenpo dejó de ser un secreto de la costa del Pacífico: estaba en la portada de las revistas y en la boca de todos.",
          "Lejos de corromper al arte, esa exposición lo potenció. Parker organizó los primeros torneos internacionales de karate moderno (los «Long Beach Internationals»), donde el Kenpo se midió con todos los estilos de la época. La pantalla le dio fama; el tatami le dio legitimidad.",
        ],
        quote: {
          text: "La fama abre puertas, pero es la técnica la que las sostiene abiertas.",
          author: "Ed Parker",
        },
        facts: [
          "Elvis Presley entrenó Kenpo con Ed Parker y alcanzó el grado de cinturón negro.",
          "Los torneos de Long Beach de Parker son considerados los más influyentes de su era.",
        ],
      },
      {
        id: "ciencia",
        period: "1970-90",
        yearLabel: "1980",
        title: "La ciencia del combate",
        lead: "Parker convierte décadas de experiencia en un sistema documentado y enseñable: el método definitivo.",
        paragraphs: [
          "A lo largo de los años setenta y ochenta, Ed Parker maduró su obra. Escribió la serie «Infinite Insights into Kenpo», cinco volúmenes en los que sistematizó los principios del movimiento: las «armonías acumuladas», los «qué pasaría si» (What If), los ángulos de ataque y las presunciones de la defensa personal.",
          "El American Kenpo dejó de ser un estilo de la memoria para convertirse en una ciencia del análisis. Cada técnica podía explicarse, descomponerse y adaptarse a cualquier escenario. El alumno ya no memorizaba movimientos: aprendía a pensar en combate. Ese enfoque racional es el que hace al Kenpo atemporal.",
        ],
        quote: {
          text: "No me enseñes el movimiento. Enséñame la idea y crearé mil movimientos.",
          author: "Ed Parker",
        },
        facts: [
          "«Infinite Insights into Kenpo» (1982-1987) es la obra magna del sistema.",
          "El método «What If» entrena al alumno a resolver escenarios impredecibles en tiempo real.",
        ],
      },
      {
        id: "legado",
        period: "1990-hoy",
        yearLabel: "Hoy",
        title: "Expansión mundial y el legado en ZonaElite",
        lead: "Tras la partida del maestro, el American Kenpo se multiplica en el mundo. Y llega hasta La Serena.",
        paragraphs: [
          "Ed Parker falleció en 1990, pero su legado ya no dependía de una sola persona. Sus estudiantes fundaron organizaciones propias y el American Kenpo se expandió por América, Europa y Asia. Cada escuela lo adaptó a su realidad, pero todas conservaron el núcleo: defensa personal real, velocidad y lógica.",
          "Esa línea de transmisión llega hasta ZonaElite, en La Serena. Nuestro Kenpo no es una reliquia de museo: es un sistema vivo que se entrena, se analiza y se actualiza cada día. La raíz sigue siendo la misma —la del templo, la de Hawái, la de Pasadena—, pero hoy su técnica se enseña en el corazón de Chile, a hombres, mujeres, niños y niñas que quieren sentirse capaces de proteger lo que aman.",
        ],
        quote: {
          text: "Cada generación recibe el arte y tiene el deber de hacerlo mejor.",
          author: "Filosofía ZonaElite",
        },
        facts: [
          "El American Kenpo se enseña hoy en más de 30 países.",
          "ZonaElite es parte de esa red viva: tradición e innovación en cada clase.",
        ],
      },
    ],
    ending: {
      title: "Fin de la historia del Kenpo",
      text: "Ese es el camino que nos trajo hasta aquí: mil años de evolución que hoy se entrenan en tu academia. Si el Kenpo encendió tu curiosidad, la historia del Kickboxing y del Sport Kempo también vale la pena.",
      action: "Explorar otra historia",
    },
  },
  {
    id: "kickboxing",
    name: "Kickboxing",
    subtitle: "Kickboxing",
    icon: "sports_kabaddi",
    tagline: "Potencia explosiva y combate de pie",
    short:
      "El deporte que nació de fusionar el boxeo con el Muay Thai, en Japón y en América.",
    accent: "#ffb84d",
    whatIs: {
      kicker: "01 — Qué es",
      title: "¿Qué es el Kickboxing?",
      paragraphs: [
        "El Kickboxing es un deporte de combate de pie que combina los puños del boxeo occidental con las patadas de las artes marciales de golpeo. Nació del cruce entre culturas: la precisión del jab y el cross, con la potencia del roundhouse kick y el low kick.",
        "Su mayor virtud es su lógica simple y efectiva: distancia, timing y potencia. Es la puerta de entrada perfecta al combate para quienes quieren golpear con técnica, ganar condición física y aprender a defenderse sin rodeos.",
        "En ZonaElite, el Kickboxing es la herramienta de acondicionamiento y coraje: forja el físico y templa el carácter, golpe tras golpe.",
      ],
      quote: {
        text: "El jab es la pregunta. La respuesta llega en forma de cross.",
        author: "Refrán de gimnasio",
      },
    },
    chapters: [
      {
        id: "raices",
        period: "Siglos",
        yearLabel: "Antigüedad",
        title: "Raíces: Muay Thai y boxeo",
        lead: "Dos grandes tradiciones de golpeo se preparan, sin saberlo, para encontrarse.",
        paragraphs: [
          "Por un lado, el arte marcial de Tailandia: el Muay Thai, conocido como «el arte de las ocho extremidades» porque usa puños, codos, rodillas y espinillas. Durante siglos fue el sistema de combate de pie más letal del sudeste asiático, desarrollado en el campo de batalla y perfeccionado en el ring.",
          "Por el otro, el boxeo occidental, que convirtió el arte del puño en un deporte con ciencia propia: juego de pies, combinaciones, defensa y economía de movimiento. Cuando en el siglo XX ambas tradiciones se encontraron en Asia y luego en América, el resultado era inevitable: un nuevo deporte.",
        ],
        quote: {
          text: "El Muay Thai da el arma. El boxeo da la estrategia.",
          author: "Historiadores del kickboxing",
        },
        facts: [
          "El Muay Thai se menciona en registros tailandeses desde hace más de 800 años.",
          "El boxeo moderno se consolidó en Inglaterra en los siglos XVIII y XIX.",
        ],
      },
      {
        id: "japon",
        period: "1960",
        yearLabel: "1960",
        title: "Japón: nace la palabra «Kickboxing»",
        lead: "Un promotor japonés hace lo impensado: karatecas contra boxeadores tailandeses, y de ahí nace todo.",
        paragraphs: [
          "A mediados de los años sesenta, el promotor japonés Osamu Noguchi organizó combates en los que karatecas se enfrentaban a expertos en Muay Thai. Los japoneses perdieron varias veces, pero el espectáculo fue tan intenso que Noguchi decidió crear un deporte nuevo: el «Kick-Boxing», una fusión reglada de boxeo y Muay Thai.",
          "En 1966 se fundó la primera organización profesional japonesa y apareció la primera gran estrella: Tadashi Sawamura, cuyo estilo agresivo llenó estadios y elevó el kickboxing a fenómeno de masas. La semilla estaba plantada en el lado correcto del Pacífico.",
        ],
        quote: {
          text: "No inventamos las armas. Inventamos las reglas para usarlas.",
          author: "Osamu Noguchi",
        },
        facts: [
          "El término «Kick-Boxing» fue acuñado por Noguchi en la década de 1960.",
          "Sawamura se convirtió en héroe nacional japonés por su bravura.",
        ],
      },
      {
        id: "america",
        period: "1970",
        yearLabel: "1970",
        title: "América: el Full Contact",
        lead: "Al otro lado del océano, los karatecas americanos crean su propia versión del deporte.",
        paragraphs: [
          "Mientras Japón consolidaba su kickboxing, en Estados Unidos los campeones de karate de punto buscaban algo más real: el «full contact karate», combates a plena potencia con guantes de boxeo y protección. En 1974 se fundó la PKA (Professional Karate Association) y el primer campeonato mundial de full contact se transmitió en televisión nacional.",
          "Nacieron las primeras superestrellas americanas: Joe Lewis, el pionero; Bill Wallace, «Superfoot», cuya pierna era temida; Benny Urquidez, «The Jet», invicto durante décadas; y Don «The Dragon» Wilson. Estos hombres convirtieron el kickboxing en un deporte de estadio en Norteamérica.",
        ],
        quote: {
          text: "Un kickboxer se entrena para la primera patada y para la última.",
          author: "Bill Wallace",
        },
        facts: [
          "La PKA celebró el primer campeonato mundial de full contact en 1974.",
          "Benny Urquidez ganó títulos mundiales durante más de veinte años.",
        ],
      },
      {
        id: "k1",
        period: "1990",
        yearLabel: "1993",
        title: "K-1: el deporte se vuelve planeta",
        lead: "Un torneo japonés reúne a los mejores del mundo y el kickboxing conquista la era de la TV global.",
        paragraphs: [
          "En 1993, Kazuyoshi Ishii fundó el K-1, un torneo que reunía a los campeones de kickboxing, Muay Thai, karate y savate de todo el planeta en un formato de eliminación directa. El K-1 fue el primer gran escaparate global del kickboxing: patadas altas, nocks outs legendarios y rivalidades que llenaron el Tokyo Dome.",
          "Surgieron los nombres que hoy son historia: el holandés Peter Aerts, el técnico Ernesto Hoost, el espectacular suizo Andy Hug, y el croata Mirko Cro Cop. El K-1 demostró que el kickboxing no era una moda, sino el combate de pie más exigente del mundo.",
        ],
        quote: {
          text: "En el K-1 no hay excusas: cada noche sale un rey.",
          author: "Peter Aerts",
        },
        facts: [
          "El primer K-1 Grand Prix se celebró en 1993 en Tokio.",
          "Andy Hug, kickboxer suizo, es recordado como uno de los más espectaculares de la historia.",
        ],
      },
      {
        id: "hoy",
        period: "Hoy",
        yearLabel: "Actualidad",
        title: "El kickboxing en el mundo y en Chile",
        lead: "Del estadio al gimnasio: un deporte que hoy entrena todo el mundo, y también en La Serena.",
        paragraphs: [
          "Hoy el kickboxing se practica en todos los continentes, en dos grandes vertientes: el deporte competitivo (reglas K-1, Muay Thai, kick light) y el kickboxing fitness, que transformó el arte en uno de los sistemas de acondicionamiento más efectivos que existen.",
          "En Chile, el kickboxing vive un auge enorme: campeonatos nacionales, figuras internacionales y gimnasios por todo el país. En ZonaElite lo entrenamos con esa misma energía: técnica de campeón para cada alumno, desde el que quiere competir hasta el que busca su mejor versión física.",
        ],
        quote: {
          text: "La patada que hoy fallas es la que mañana te enseña.",
          author: "Máxima del entrenamiento",
        },
        facts: [
          "El kickboxing fue reconocido por organismos deportivos internacionales y busca su lugar olímpico.",
          "ZonaElite integra el kickboxing con el Kenpo y el Sport Kempo en un plan de combate completo.",
        ],
      },
    ],
    ending: {
      title: "Fin de la historia del Kickboxing",
      text: "Del ring tailandés a los estadios japoneses y a tu gimnasio en La Serena: esa es la potencia del kickboxing. Queda una historia más: la del arte marcial más joven del planeta.",
      action: "Leer la historia del Sport Kempo",
    },
  },
  {
    id: "sport_kempo",
    name: "Sport Kempo",
    subtitle: "Kempo Deportivo",
    icon: "shield",
    tagline: "La vertiente competitiva del Kenpo",
    short:
      "La rama reglamentada y moderna del Kenpo, diseñada para la competición internacional con reglas justas.",
    accent: "#e91e63",
    whatIs: {
      kicker: "01 — Qué es",
      title: "¿Qué es el Sport Kempo?",
      paragraphs: [
        "El Sport Kempo (o Kempo Deportivo) es la vertiente competitiva, reglamentada y moderna de las artes marciales del Kenpo. Nació de la necesidad de unificar bajo un mismo marco normativo a las distintas escuelas tradicionales de Kenpo/Kempo que existían a nivel mundial, permitiendo que practicantes de diversos estilos comparen sus habilidades en un entorno seguro, deportivo y estructurado.",
        "A diferencia del entrenamiento tradicional —que suele enfocarse estrictamente en la defensa personal callejera, la ejecución de formas técnicas (katas) y la filosofía marcial—, el Sport Kempo está diseñado específicamente para el alto rendimiento y la competición internacional, rigiéndose por estándares deportivos globales.",
        "En ZonaElite, el Sport Kempo complementa el Kenpo tradicional y el Kickboxing: la defensa personal, la potencia de golpeo y ahora la disciplina competitiva reglamentada que te permite medirte en igualdad de condiciones.",
      ],
      quote: {
        text: "No basta con saber pelear: hay que demostrarlo bajo reglas justas.",
        author: "Filosofía del Sport Kempo",
      },
    },
    chapters: [
      {
        id: "necesidad",
        period: "Siglo XX",
        yearLabel: "Siglo XX",
        title: "La necesidad de unificar",
        lead: "Décadas de escuelas fragmentadas pidieron a gritos un marco común.",
        paragraphs: [
          "Durante gran parte del siglo XX, el Kenpo y el Kempo se practicaban en escuelas tradicionales alrededor del mundo, cada una con sus propias reglas, grados y formas de competir. No existía un criterio统一 que permitiera a un practicante de Kenpo estadounidense enfrentarse a uno japonés o chileno bajo las mismas condiciones.",
          "Esta fragmentación impedía que el Kenpo pudiera demostrar su valía en torneos internacionales. Los practicantes querían competir, pero no había un organismo central que regulara las reglas, los criterios de puntuación ni la ética deportiva.",
        ],
        quote: {
          text: "Sin reglas comunes, no hay competencia justa.",
          author: "Maestros fundadores del Sport Kempo",
        },
        facts: [
          "El Kenpo/Kempo se practicaba en más de 40 países sin un reglamento unificado.",
          "Cada escuela tenía sus propias formas técnicas y criterios de evaluación.",
        ],
      },
      {
        id: "ikf",
        period: "1970-80",
        yearLabel: "1970s",
        title: "La International Kempo Federation",
        lead: "Nace el organismo que unifica al Kenpo mundial bajo un mismo reglamento.",
        paragraphs: [
          "La International Kempo Federation (IKF) surgió como respuesta a esta necesidad de unificación. Su misión fue establecer reglas estándar de combate, arbitraje y puntuación que fueran justas, transparentes y accesibles a practicantes de todos los estilos de Kenpo/Kempo del mundo.",
          "La IKF no solo creó un reglamento: construyó una estructura deportiva profesional con certificaciones de árbitros, categorías por peso y edad, y un código ético que garantiza la seguridad de los competidores. Desde el inicio, la federación adoptó los estándares de la Agencia Mundial Antidopaje (WADA), asegurando la limpieza del deporte.",
        ],
        quote: {
          text: "La unificación no borra las tradiciones: las pone a competir en igualdad.",
          author: "International Kempo Federation",
        },
        facts: [
          "La IKF reúne a federaciones nacionales de más de 40 países.",
          "El reglamento IKF es compatible con las normativas de WADA desde su fundación.",
        ],
      },
      {
        id: "categorias",
        period: "Evolución",
        yearLabel: "Inclusión",
        title: "Categorías para todos",
        lead: "Desde niños hasta adultos mayores, el Sport Kempo abre sus puertas a todos.",
        paragraphs: [
          "Una de las grandes virtudes del Sport Kempo es su estructura de inclusión. A diferencia de otros deportes de combate que suelen centrarse en adultos jóvenes, el Sport Kempo está diseñado para abarcar a todos: categorías infantiles, juveniles, adultos, sénior e incluso modalidades adaptadas para deportistas con limitaciones de movilidad.",
          "Esta filosofía de inclusión permite que el arte marcial se practique durante toda la vida. Un niño que empieza a los 6 años puede competir en categorías juveniles, luego adultas, y seguir activo en sénior. El Kenpo no tiene edad: tiene reglas que se adaptan a cada etapa.",
        ],
        quote: {
          text: "El verdadero deportista no se retira: se adapta.",
          author: "Filosofía del Sport Kempo",
        },
        facts: [
          "Las categorías infantiles usan protecciones especiales y reglas reducidas.",
          "Las categorías sénior y adaptadas son reconocidas internacionalmente por la IKF.",
        ],
      },
      {
        id: "reglas",
        period: "Reglamento",
        yearLabel: "Reglas",
        title: "Reglas Unificadas de Combate",
        lead: "Criterios de puntuación y arbitraje que hacen justa la competencia.",
        paragraphs: [
          "El Sport Kempo se rige por reglas unificadas que estandarizan los criterios de puntuación, los tiempos de combate, las técnicas permitidas y los protocolos de seguridad. Esto permite que competidores de diferentes ramas del Kenpo se enfrenten bajo las mismas condiciones, sin ventajas por estilo.",
          "Los árbitros certificados por la IKF aplican un sistema de puntuación que valora la precisión, la velocidad, la potencia y la técnica correcta. Cada golpe, cada patada y cada técnica de defensa tiene un criterio claro: no hay ambigüedad ni favoritismos.",
        ],
        quote: {
          text: "Las reglas no limitan al luchador: lo hacen crecer.",
          author: "Principios del Sport Kempo",
        },
        facts: [
          "El sistema de puntuación incluye puntos por golpes técnicos, barridos y proyecciones.",
          "Los combates se disputan en 2 o 3 asaltos de 2 minutos según la categoría.",
        ],
      },
      {
        id: "chile",
        period: "Hoy",
        yearLabel: "Actualidad",
        title: "Sport Kempo en Chile",
        lead: "De las competencias internacionales al gimnasio de La Serena.",
        paragraphs: [
          "Hoy el Sport Kempo es una disciplina con presencia en competiciones internacionales organizadas por la IKF. Países de todos los continentes envían selecciones nacionales a campeonatos mundiales y continentales, donde el Kenpo demuestra su valor como deporte de combate reglamentado.",
          "En Chile, el Sport Kempo está en crecimiento. En ZonaElite lo integramos como la vertiente competitiva del Kenpo: entrenamiento técnico, preparación física de alto rendimiento y la posibilidad de competir bajo reglas internacionales. Si quieres llevar tu Kenpo al siguiente nivel, el Sport Kempo es tu camino.",
        ],
        quote: {
          text: "El Sport Kempo no reemplaza al Kenpo: lo eleva.",
          author: "Filosofía ZonaElite",
        },
        facts: [
          "Chile participa en campeonatos Panamericanos de Sport Kempo.",
          "ZonaElite integra el Sport Kempo en su plan de formación marcial.",
        ],
      },
    ],
    ending: {
      title: "Fin de la historia del Sport Kempo",
      text: "De las escuelas tradicionales fragmentadas a las competencias internacionales unificadas: así nació el Sport Kempo. Las tres historias —Kenpo, Kickboxing y Sport Kempo— se encuentran en ZonaElite, donde hoy puedes entrenarlas todas.",
      action: "Volver al inicio de la historia",
    },
  },
];

export const DEFAULT_STORY_ID = "kenpo" as const;
