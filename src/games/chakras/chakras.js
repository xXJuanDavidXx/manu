// Los siete chakras, de la raíz a la corona: el sendero del despertar.
// Cada uno trae su color, su elemento, su sonido semilla (bija mantra), la
// frecuencia con que se le asocia, lo que significa y una afirmación.
//   palette: [profundo, medio, brillante] · scene: escena del túnel y de los objetos que flotan
//   hz: frecuencia solfeggio que suena en el cuenco · petals: pétalos del loto

export const chakras = [
  {
    key: 'muladhara', name: 'Muladhara', title: 'Chakra raíz', element: 'Tierra', mantra: 'LAM', hz: 396, petals: 4,
    palette: ['#2b0306', '#c1121f', '#ff6b4a'], scene: 0,
    place: 'En la base de la columna',
    meaning: 'Es la raíz que te sostiene: seguridad, cuerpo, pertenencia. Aquí empieza el viaje, sintiendo que la tierra te recibe y que estás a salvo.',
    affirmation: 'Estoy a salvo. Pertenezco. La tierra me sostiene.',
    teachings: [
      'Siente el peso de tu cuerpo… no tienes que ir a ningún lado',
      'Todo lo que necesitas para empezar ya está en ti',
      'Respira hacia abajo, como si echaras raíces',
    ],
  },
  {
    key: 'svadhisthana', name: 'Svadhisthana', title: 'Chakra sacro', element: 'Agua', mantra: 'VAM', hz: 417, petals: 6,
    palette: ['#2a0a00', '#f3722c', '#ffc078'], scene: 1,
    place: 'Bajo el ombligo',
    meaning: 'Es el agua que fluye: emociones, creatividad, placer, la dulzura de estar viva. Aquí se aprende a sentir sin miedo y a dejarse llevar.',
    affirmation: 'Me permito sentir. Fluyo con la vida.',
    teachings: [
      'Las emociones son olas: llegan, te mueven y se van',
      'No hay que empujar el río, solo dejarse llevar',
      'Crear también es una forma de amar',
    ],
  },
  {
    key: 'manipura', name: 'Manipura', title: 'Plexo solar', element: 'Fuego', mantra: 'RAM', hz: 528, petals: 10,
    palette: ['#2a1a00', '#f9c80e', '#fff3b0'], scene: 2,
    place: 'Sobre el ombligo, en el centro del cuerpo',
    meaning: 'Es el sol interior: voluntad, confianza, poder personal. El fuego que transforma el miedo en valor y la duda en decisión.',
    affirmation: 'Brillo con mi propia luz. Confío en mí.',
    teachings: [
      'Tu fuego no quema a nadie: te ilumina el camino',
      'Eres capaz de mucho más de lo que crees',
      'Cruza los anillos de fuego: cada uno es un miedo que sueltas',
    ],
  },
  {
    key: 'anahata', name: 'Anahata', title: 'Chakra del corazón', element: 'Aire', mantra: 'YAM', hz: 639, petals: 12,
    palette: ['#021c10', '#2dc653', '#ff8fab'], scene: 3,
    place: 'En el centro del pecho',
    meaning: 'Es el puente entre la tierra y el cielo: amor, compasión, perdón. Su nombre significa «el que no ha sido golpeado»: un amor que nada puede romper.',
    affirmation: 'Doy y recibo amor libremente.',
    teachings: [
      'El amor que das vuelve multiplicado',
      'Perdonar es dejar de cargar con lo que pesa',
      'Aquí, en el corazón, siempre hay espacio para ti',
    ],
  },
  {
    key: 'vishuddha', name: 'Vishuddha', title: 'Chakra de la garganta', element: 'Éter · Sonido', mantra: 'HAM', hz: 741, petals: 16,
    palette: ['#00121f', '#00b4d8', '#caf0f8'], scene: 4,
    place: 'En la garganta',
    meaning: 'Es el espacio donde nace el sonido: expresión, verdad, comunicación. Decir lo que sientes con calma y escuchar de verdad.',
    affirmation: 'Mi voz es libre y verdadera.',
    teachings: [
      'Escucha: todo vibra, también tú',
      'Tu verdad dicha con amor nunca sobra',
      'El silencio también es una forma de hablar',
    ],
  },
  {
    key: 'ajna', name: 'Ajna', title: 'Tercer ojo', element: 'Luz', mantra: 'OM', hz: 852, petals: 2,
    palette: ['#0a0326', '#5a3fd8', '#d0b8ff'], scene: 5,
    place: 'Entre las cejas',
    meaning: 'Es la mirada interior: intuición, imaginación, sabiduría. Ver más allá de lo que se ve, confiar en lo que sabes sin saber por qué.',
    affirmation: 'Veo con claridad. Confío en mi intuición.',
    teachings: [
      'Cierra los ojos un momento… ¿qué ves?',
      'Tu intuición es tu sabiduría hablándote bajito',
      'Todo es reflejo de todo',
    ],
  },
  {
    key: 'sahasrara', name: 'Sahasrara', title: 'Chakra corona', element: 'Conciencia', mantra: 'Silencio', hz: 963, petals: 1000,
    palette: ['#14002b', '#b388ff', '#fff6ff'], scene: 6,
    place: 'Sobre la coronilla',
    meaning: 'Es el loto de mil pétalos: unidad, paz, conexión con todo lo que existe. Aquí termina el sendero y empieza la luz: ya no hay separación.',
    affirmation: 'Soy uno con todo lo que existe.',
    teachings: [
      'No hay nada que alcanzar: ya eres luz',
      'Suelta incluso el deseo de soltar',
      'Todo está bien. Todo es uno.',
    ],
  },
];

export const ORDINALS = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo'];

export const ending = {
  title: 'Iluminación',
  text: 'Recorriste el sendero completo: de la tierra que te sostiene a la luz que eres.\nCada color era una parte de ti despertando.',
  love: 'Y en cada uno de ellos estuve pensando en ti 💜',
};
