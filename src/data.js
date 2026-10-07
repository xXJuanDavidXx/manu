// Contenido de la galaxia: la playlist, los planetas que se pueden visitar y
// las notas de amor que aparecen dentro de los juegos.

export const playlist = [
  { name: 'Donde Nadie Pueda Ir', src: 'music/Donde Nadie Pueda Ir.mp3', colors: { in: '#00ffff', out: '#6a0dad' } },
  { name: 'Put Your Head On My Shoulder', src: 'music/Paul Anka — Put Your Head On My Shoulder [Letra + video].mp3', colors: { in: '#ff1493', out: '#00bfff' } },
  { name: 'La Casa Verde', src: 'music/La Casa Verde.mp3', colors: { in: '#00ff88', out: '#ff00ff' } },
  { name: 'Canserbero - Querer Querernos', src: 'music/Canserbero - Querer Querernos (Versión Acústica).mp3', colors: { in: '#ff4500', out: '#240046' } },
  { name: "I Don't Want to Set the World on Fire", src: "music/I Don't Want to Set the World on Fire.mp3", colors: { in: '#ff8c00', out: '#008080' } },
  { name: 'Kharmasutra', src: 'music/Kharmasutra.mp3', colors: { in: '#bf00ff', out: '#10002b' } },
  { name: 'Mägo De Oz - Pensando en ti', src: 'music/Mägo De Oz - Pensando en ti __ Letra.mp3', colors: { in: '#ffd700', out: '#ff00ff' } },
  { name: 'Mon Laferte - La Nave del Olvido', src: 'music/Mon Laferte - La Nave del Olvido _ Homenaje a José José, Vive Latino 2020.mp3', colors: { in: '#e01e37', out: '#3a0ca3' } },
  { name: 'Serenauta - Edson Velandia', src: 'music/Serenauta- Edson Velandia.mp3', colors: { in: '#ccff00', out: '#ff007f' } },
  { name: 'Shine On You Crazy Diamond', src: 'music/Shine On You Crazy Diamond (Pts. 1-5).mp3', colors: { in: '#4cc9f0', out: '#4361ee' } },
  { name: 'Fly Me To The Moon', src: 'music/Frank Sinatra - Fly Me To The Moon (Audio) ft. Count Basie And His Orchestra.mp3', colors: { in: '#ffbe0b', out: '#023e8a' } },
  { name: "What You Won't Do for Love", src: "music/What You Won't Do for Love.mp3", colors: { in: '#fb5607', out: '#3a86ff' } },
  { name: 'MAS QUE AMIGOS - BLESSD', src: 'music/MAS QUE AMIGOS _ BLESSD ❌ HADES 66 ❌ BLACKINNY ❌ YOUNG FATTY.mp3', colors: { in: '#ff006e', out: '#8338ec' } },
  // — nuevas —
  { name: 'Dann Jhonny - 2006', src: 'music/Dann Jhonny - 2006 (Catalina la Grande Freestyle).mp3', colors: { in: '#ff9e00', out: '#3a0ca3' } },
  { name: 'Paulo Londra - Adán y Eva', src: 'music/Paulo Londra - Adan y Eva (Official Video).mp3', colors: { in: '#38b000', out: '#d00000' } },
  { name: 'Paulo Londra - Nena Maldición', src: 'music/Paulo Londra ft Lenny Tavarez - Nena Maldicion (Official Video).mp3', colors: { in: '#c1121f', out: '#10002b' } },
  { name: 'Samantha Barrón - Dibújame', src: 'music/Samantha Barrón - Dibújame Feat. Nanpa Básico (Video Oficial).mp3', colors: { in: '#ffafcc', out: '#4361ee' } },
  { name: 'Blessd - Trinidad Bendita', src: 'music/URUS BLUE      BLESSD ( TRINIDAD BENDITA ).mp3', colors: { in: '#00b4d8', out: '#ffd60a' } },
  { name: 'Vilma Palma e Vampiros - Auto Rojo', src: 'music/Vilma Palma E Vampiros - Auto Rojo [Video Oficial].mp3', colors: { in: '#e63946', out: '#1d3557' } },
];

// Planetas que orbitan la galaxia. Los que tienen `game` se pueden visitar;
// los demás "duermen" hasta que se les construya su juego.
//   orbit: radio de la órbita · speed: rad/s · phase: ángulo inicial · tilt: inclinación
export const planets = [
  {
    key: 'ritmo', name: 'Planeta Ritmo', subtitle: 'Atrapa los corazones al ritmo de nuestra música',
    colors: ['#ff5d8f', '#5a189a'], radius: 0.62, orbit: 7.6, speed: 0.045, phase: 0.6, tilt: 0.12,
    ring: true, game: 'ritmo',
  },
  {
    key: 'recuerdos', name: 'Planeta Recuerdos', subtitle: 'Aún duerme… pronto despertará',
    colors: ['#4cc9f0', '#1d3557'], radius: 0.5, orbit: 10, speed: 0.032, phase: 2.7, tilt: -0.18,
  },
  {
    key: 'retro', name: 'Planeta Retro', subtitle: 'Aún duerme… pronto despertará',
    colors: ['#ffd166', '#c1121f'], radius: 0.56, orbit: 12.4, speed: 0.024, phase: 4.6, tilt: 0.08,
  },
];

// Se muestran, en orden, cada vez que ella alcanza un hito en los juegos.
export const loveNotes = [
  'Cada corazón que atrapas ya era tuyo 💖',
  'Te amo más que a todas estas estrellas juntas ✨',
  'Contigo hasta la música suena más bonita 🎶',
  'Eres mi lugar favorito en todo el universo 🌌',
  'Que Hécate guarde tus tres caminos; yo te acompaño en todos 🌙',
  'Gracias por existir, mi amor 🕯️',
  'Te elegiría en cada galaxia, una y otra vez 💫',
  'Eres la luz de mis antorchas 🔥',
];
