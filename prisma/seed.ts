import 'dotenv/config';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // ==========================================
  // 1. CREAR SUPER ADMIN
  // ==========================================
  const hashedPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mindtalent.com' },
    update: {},
    create: {
      email: 'admin@mindtalent.com',
      password: hashedPassword,
      cedula: '1700000001',
      firstName: 'Super',
      lastName: 'Administrador',
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`Admin creado: ${admin.email}`);

  // Admin de prueba
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin2 = await prisma.user.upsert({
    where: { email: 'admin2@mindtalent.com' },
    update: {},
    create: {
      email: 'admin2@mindtalent.com',
      password: adminPassword,
      cedula: '1700000005',
      firstName: 'Maria',
      lastName: 'Garcia',
      role: 'ADMIN',
    },
  });
  console.log(`Admin creado: ${admin2.email}`);

  // ==========================================
  // 1.1 USUARIOS REALES DE PRODUCCION
  // ==========================================
  const kennethPassword = await bcrypt.hash('Kith29090604', 10);
  const kenneth = await prisma.user.upsert({
    where: { email: 'kenntaipe@gmail.com' },
    update: { password: kennethPassword, role: 'SUPER_ADMIN' },
    create: {
      email: 'kenntaipe@gmail.com',
      password: kennethPassword,
      cedula: '1700000100',
      firstName: 'Kenneth',
      lastName: 'Taipe',
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`Super Admin creado: ${kenneth.email}`);

  const jefaturaPassword = await bcrypt.hash('Agus1234', 10);
  const jefatura = await prisma.user.upsert({
    where: { email: 'jefatura.tthh@mindtalentrh.com' },
    update: { password: jefaturaPassword, role: 'ADMIN' },
    create: {
      email: 'jefatura.tthh@mindtalentrh.com',
      password: jefaturaPassword,
      cedula: '1700000101',
      firstName: 'Jefatura',
      lastName: 'TTHH',
      role: 'ADMIN',
    },
  });
  console.log(`Admin creado: ${jefatura.email}`);

  const gerenciaPassword = await bcrypt.hash('Emilio1234', 10);
  const gerencia = await prisma.user.upsert({
    where: { email: 'gerencia@mindtalentrh.com' },
    update: { password: gerenciaPassword, role: 'ADMIN' },
    create: {
      email: 'gerencia@mindtalentrh.com',
      password: gerenciaPassword,
      cedula: '1700000102',
      firstName: 'Emilio',
      lastName: 'Gerencia',
      role: 'ADMIN',
    },
  });
  console.log(`Admin creado: ${gerencia.email}`);

  // Examinador de prueba
  const examinerPassword = await bcrypt.hash('Examiner123!', 10);
  const examiner = await prisma.user.upsert({
    where: { email: 'examinador@test.com' },
    update: {},
    create: {
      email: 'examinador@test.com',
      password: examinerPassword,
      cedula: '1700000003',
      firstName: 'Carlos',
      lastName: 'Lopez',
      role: 'EXAMINER',
    },
  });
  console.log(`Examinador creado: ${examiner.email}`);

  // Candidato de prueba
  const candidatePassword = await bcrypt.hash('Candidato123!', 10);
  const candidate = await prisma.user.upsert({
    where: { email: 'candidato@test.com' },
    update: {},
    create: {
      email: 'candidato@test.com',
      password: candidatePassword,
      cedula: '1700000002',
      firstName: 'Juan',
      lastName: 'Perez',
      role: 'CANDIDATE',
    },
  });
  console.log(`Candidato creado: ${candidate.email}`);

  // Auditor de prueba
  const auditorPassword = await bcrypt.hash('Auditor123!', 10);
  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@test.com' },
    update: {},
    create: {
      email: 'auditor@test.com',
      password: auditorPassword,
      cedula: '1700000004',
      firstName: 'Ana',
      lastName: 'Martinez',
      role: 'AUDITOR',
    },
  });
  console.log(`Auditor creado: ${auditor.email}`);

  // ==========================================
  // 2. TEST KOSTICK (PAPI)
  // ==========================================
  const kostick = await prisma.test.create({
    data: {
      name: 'Kostick (PAPI)',
      description: 'Inventario de Personalidad y Preferencias - mide 20 escalas de necesidades y roles laborales',
      type: 'KOSTICK',
      questionFormat: 'FORCED_CHOICE_PAIR',
      timeLimitMin: 30,
      totalQuestions: 90,
      instructions: 'A continuacion se presentan 90 pares de frases. Elija la que mejor lo describe en su entorno laboral. No hay respuestas correctas o incorrectas.',
      createdById: admin.id,
      scales: {
        create: [
          { code: 'G', name: 'Necesidad de terminar una tarea', maxScore: 9, order: 1 },
          { code: 'A', name: 'Necesidad de logro', maxScore: 9, order: 2 },
          { code: 'N', name: 'Necesidad de control', maxScore: 9, order: 3 },
          { code: 'L', name: 'Rol de lider', maxScore: 9, order: 4 },
          { code: 'P', name: 'Necesidad de organizar', maxScore: 9, order: 5 },
          { code: 'I', name: 'Facilidad de tomar decisiones', maxScore: 9, order: 6 },
          { code: 'T', name: 'Ritmo de trabajo', maxScore: 9, order: 7 },
          { code: 'V', name: 'Rol de trabajar con vigor', maxScore: 9, order: 8 },
          { code: 'S', name: 'Necesidad de pertenecer', maxScore: 9, order: 9 },
          { code: 'B', name: 'Extension social', maxScore: 9, order: 10 },
          { code: 'O', name: 'Necesidad de cercanía', maxScore: 9, order: 11 },
          { code: 'X', name: 'Necesidad de ser notado', maxScore: 9, order: 12 },
          { code: 'C', name: 'Actitud hacia conflicto', maxScore: 9, order: 13 },
          { code: 'D', name: 'Necesidad de cambio', maxScore: 9, order: 14 },
          { code: 'Z', name: 'Necesidad de actividad', maxScore: 9, order: 15 },
          { code: 'E', name: 'Rol emocional', maxScore: 9, order: 16 },
          { code: 'K', name: 'Necesidad de agresividad', maxScore: 9, order: 17 },
          { code: 'F', name: 'Necesidad de apoyo', maxScore: 9, order: 18 },
          { code: 'W', name: 'Necesidad de reglas', maxScore: 9, order: 19 },
          { code: 'R', name: 'Rol de seguidor', maxScore: 9, order: 20 },
        ],
      },
    },
  });

  // Preguntas Kostick (muestra de 90 pares)
  const kostickPairs = [
    { n: 1, a: 'Me gusta trabajar duro', b: 'Me gusta ser el lider del grupo', sa: 'G', sb: 'L' },
    { n: 2, a: 'Soy una persona muy activa', b: 'Busco el apoyo de los demas', sa: 'Z', sb: 'F' },
    { n: 3, a: 'Me agrada organizar las cosas', b: 'Me gusta destacar entre los demas', sa: 'P', sb: 'X' },
    { n: 4, a: 'Tomo decisiones con facilidad', b: 'Me gusta que las cosas cambien', sa: 'I', sb: 'D' },
    { n: 5, a: 'Busco siempre lograr mis metas', b: 'Me gusta pertenecer a un grupo', sa: 'A', sb: 'S' },
    { n: 6, a: 'Trabajo a un ritmo rapido', b: 'Me gusta tener relaciones cercanas', sa: 'T', sb: 'O' },
    { n: 7, a: 'Manejo bien los conflictos', b: 'Necesito que me den reglas claras', sa: 'C', sb: 'W' },
    { n: 8, a: 'Controlo las situaciones', b: 'Soy un seguidor confiable', sa: 'N', sb: 'R' },
    { n: 9, a: 'Trabajo con mucha energia', b: 'Me expreso emocionalmente', sa: 'V', sb: 'E' },
    { n: 10, a: 'Me gusta convencer a otros', b: 'Puedo ser agresivo cuando es necesario', sa: 'B', sb: 'K' },
    { n: 11, a: 'Siempre termino lo que empiezo', b: 'Me gusta planificar todo', sa: 'G', sb: 'P' },
    { n: 12, a: 'Me siento motivado por los logros', b: 'Prefiero liderar el equipo', sa: 'A', sb: 'L' },
    { n: 13, a: 'Tomo decisiones rapidas', b: 'Trabajo con mucha intensidad', sa: 'I', sb: 'V' },
    { n: 14, a: 'Me gusta socializar', b: 'Necesito estructura y orden', sa: 'B', sb: 'W' },
    { n: 15, a: 'Me adapto bien a los cambios', b: 'Soy una persona activa fisicamente', sa: 'D', sb: 'Z' },
    { n: 16, a: 'Me gusta controlar las cosas', b: 'Busco cercanía con las personas', sa: 'N', sb: 'O' },
    { n: 17, a: 'Me gusta trabajar en equipo', b: 'Manejo el estres emocional', sa: 'S', sb: 'E' },
    { n: 18, a: 'Soy competitivo', b: 'Sigo las instrucciones fielmente', sa: 'K', sb: 'R' },
    { n: 19, a: 'Me gusta ser reconocido', b: 'Necesito el apoyo de otros', sa: 'X', sb: 'F' },
    { n: 20, a: 'Trabajo a ritmo acelerado', b: 'Enfrento los conflictos directamente', sa: 'T', sb: 'C' },
    { n: 21, a: 'Termino las tareas a tiempo', b: 'Me motivan los retos', sa: 'G', sb: 'A' },
    { n: 22, a: 'Dirijo al grupo naturalmente', b: 'Soy organizado y meticuloso', sa: 'L', sb: 'P' },
    { n: 23, a: 'Decido sin dudar mucho', b: 'Me gusta el cambio constante', sa: 'I', sb: 'D' },
    { n: 24, a: 'Trabajo con fuerza y vigor', b: 'Me gusta estar activo siempre', sa: 'V', sb: 'Z' },
    { n: 25, a: 'Necesito estar con gente', b: 'Me comunico con facilidad', sa: 'S', sb: 'B' },
    { n: 26, a: 'Busco relaciones profundas', b: 'Me gusta sobresalir', sa: 'O', sb: 'X' },
    { n: 27, a: 'Resuelvo conflictos eficazmente', b: 'Manejo mis emociones bien', sa: 'C', sb: 'E' },
    { n: 28, a: 'Controlo mi entorno', b: 'Respeto la autoridad', sa: 'N', sb: 'R' },
    { n: 29, a: 'Soy persistente y agresivo', b: 'Pido ayuda cuando la necesito', sa: 'K', sb: 'F' },
    { n: 30, a: 'Prefiero reglas claras', b: 'Trabajo rapido y eficiente', sa: 'W', sb: 'T' },
    { n: 31, a: 'Siempre completo mis tareas', b: 'Busco posiciones de liderazgo', sa: 'G', sb: 'L' },
    { n: 32, a: 'Me esfuerzo por ser el mejor', b: 'Organizo mi tiempo eficientemente', sa: 'A', sb: 'P' },
    { n: 33, a: 'Actuo con determinacion', b: 'Trabajo con energia constante', sa: 'I', sb: 'V' },
    { n: 34, a: 'Me gustan los nuevos desafios', b: 'Mantengo relaciones sociales', sa: 'D', sb: 'S' },
    { n: 35, a: 'Hago muchas cosas a la vez', b: 'Extiendo mi circulo social', sa: 'Z', sb: 'B' },
    { n: 36, a: 'Valoro la cercanía emocional', b: 'Quiero ser notado por otros', sa: 'O', sb: 'X' },
    { n: 37, a: 'No evito las confrontaciones', b: 'Tengo control sobre mi mismo', sa: 'C', sb: 'N' },
    { n: 38, a: 'Muestro mis sentimientos', b: 'Sigo las reglas establecidas', sa: 'E', sb: 'W' },
    { n: 39, a: 'Defiendo mi posicion firmemente', b: 'Acato las decisiones del grupo', sa: 'K', sb: 'R' },
    { n: 40, a: 'Necesito respaldo de otros', b: 'Trabajo a ritmo constante', sa: 'F', sb: 'T' },
    { n: 41, a: 'Completo tareas con dedicacion', b: 'Alcanzo metas altas', sa: 'G', sb: 'A' },
    { n: 42, a: 'Tomo el mando facilmente', b: 'Planifico con anticipacion', sa: 'L', sb: 'P' },
    { n: 43, a: 'Decido con confianza', b: 'Busco variedad en mi trabajo', sa: 'I', sb: 'D' },
    { n: 44, a: 'Pongo energia en todo', b: 'Estoy siempre en movimiento', sa: 'V', sb: 'Z' },
    { n: 45, a: 'Necesito compania', b: 'Influyo en otros facilmente', sa: 'S', sb: 'B' },
    { n: 46, a: 'Formo vinculos estrechos', b: 'Llamo la atencion del grupo', sa: 'O', sb: 'X' },
    { n: 47, a: 'Enfrento problemas de frente', b: 'Controlo mis reacciones', sa: 'C', sb: 'E' },
    { n: 48, a: 'Domino las situaciones', b: 'Obedezco instrucciones', sa: 'N', sb: 'R' },
    { n: 49, a: 'Lucho por lo que quiero', b: 'Busco guia y apoyo', sa: 'K', sb: 'F' },
    { n: 50, a: 'Sigo procedimientos', b: 'Trabajo con rapidez', sa: 'W', sb: 'T' },
    { n: 51, a: 'Persisto hasta terminar', b: 'Lidero con ejemplo', sa: 'G', sb: 'L' },
    { n: 52, a: 'Quiero superarme siempre', b: 'Soy metódico y ordenado', sa: 'A', sb: 'P' },
    { n: 53, a: 'Tomo la iniciativa', b: 'Pongo fuerza en mi trabajo', sa: 'I', sb: 'V' },
    { n: 54, a: 'Me aburre la rutina', b: 'Disfruto estar en grupo', sa: 'D', sb: 'S' },
    { n: 55, a: 'No paro de hacer cosas', b: 'Conozco mucha gente', sa: 'Z', sb: 'B' },
    { n: 56, a: 'Soy intimo con pocos', b: 'Me gusta ser el centro', sa: 'O', sb: 'X' },
    { n: 57, a: 'No huyo de los problemas', b: 'Mantengo la compostura', sa: 'C', sb: 'N' },
    { n: 58, a: 'Expreso lo que siento', b: 'Me apego a las normas', sa: 'E', sb: 'W' },
    { n: 59, a: 'Soy firme en mis ideas', b: 'Acepto la guia de otros', sa: 'K', sb: 'R' },
    { n: 60, a: 'Pido consejo frecuentemente', b: 'Trabajo a buen ritmo', sa: 'F', sb: 'T' },
    { n: 61, a: 'No dejo nada a medias', b: 'Logro lo que me propongo', sa: 'G', sb: 'A' },
    { n: 62, a: 'Guio a los demas', b: 'Todo tiene su lugar', sa: 'L', sb: 'P' },
    { n: 63, a: 'Resuelvo rapido los dilemas', b: 'Me atraen las novedades', sa: 'I', sb: 'D' },
    { n: 64, a: 'Doy el maximo esfuerzo', b: 'Mantengo alta actividad', sa: 'V', sb: 'Z' },
    { n: 65, a: 'Necesito compañeros', b: 'Convenzo con argumentos', sa: 'S', sb: 'B' },
    { n: 66, a: 'Prefiero pocos amigos cercanos', b: 'Quiero destacar publicamente', sa: 'O', sb: 'X' },
    { n: 67, a: 'Abordo conflictos abiertamente', b: 'Controlo mis impulsos', sa: 'C', sb: 'E' },
    { n: 68, a: 'Tengo control de la situacion', b: 'Sigo directrices con gusto', sa: 'N', sb: 'R' },
    { n: 69, a: 'Peleo por mis objetivos', b: 'Valoro la asistencia de otros', sa: 'K', sb: 'F' },
    { n: 70, a: 'Cumplo las reglas fielmente', b: 'Produzco resultados rapido', sa: 'W', sb: 'T' },
    { n: 71, a: 'Finalizo todas mis tareas', b: 'Asumo el rol de jefe', sa: 'G', sb: 'L' },
    { n: 72, a: 'Busco la excelencia', b: 'Administro bien los recursos', sa: 'A', sb: 'P' },
    { n: 73, a: 'No dudo al actuar', b: 'Tengo resistencia fisica', sa: 'I', sb: 'V' },
    { n: 74, a: 'Prefiero lo nuevo', b: 'Me integro en equipos', sa: 'D', sb: 'S' },
    { n: 75, a: 'Siempre estoy ocupado', b: 'Tengo muchos contactos', sa: 'Z', sb: 'B' },
    { n: 76, a: 'Cultivo amistades profundas', b: 'Busco protagonismo', sa: 'O', sb: 'X' },
    { n: 77, a: 'Confronto los desacuerdos', b: 'Manejo mi autoridad', sa: 'C', sb: 'N' },
    { n: 78, a: 'Soy expresivo', b: 'Respeto la jerarquia', sa: 'E', sb: 'W' },
    { n: 79, a: 'Defiendo mi postura', b: 'Colaboro con el lider', sa: 'K', sb: 'R' },
    { n: 80, a: 'Consulto antes de actuar', b: 'Trabajo eficientemente', sa: 'F', sb: 'T' },
    { n: 81, a: 'Soy perseverante', b: 'Aspiro a grandes logros', sa: 'G', sb: 'A' },
    { n: 82, a: 'Asumo responsabilidades de lider', b: 'Planifico cada detalle', sa: 'L', sb: 'P' },
    { n: 83, a: 'Actuo con decision', b: 'Disfruto de la variedad', sa: 'I', sb: 'D' },
    { n: 84, a: 'Trabajo intensamente', b: 'No paro de moverme', sa: 'V', sb: 'Z' },
    { n: 85, a: 'Necesito sentirme parte del grupo', b: 'Comunico mis ideas con eficacia', sa: 'S', sb: 'B' },
    { n: 86, a: 'Tengo amigos muy cercanos', b: 'Me gusta el reconocimiento', sa: 'O', sb: 'X' },
    { n: 87, a: 'Resuelvo disputas', b: 'Mantengo estabilidad emocional', sa: 'C', sb: 'E' },
    { n: 88, a: 'Ejerzo autoridad', b: 'Respeto las decisiones superiores', sa: 'N', sb: 'R' },
    { n: 89, a: 'Soy competitivo y directo', b: 'Valoro el apoyo de mi equipo', sa: 'K', sb: 'F' },
    { n: 90, a: 'Me ciño a los procedimientos', b: 'Produzco a buen ritmo', sa: 'W', sb: 'T' },
  ];

  for (const q of kostickPairs) {
    await prisma.question.create({
      data: {
        testId: kostick.id,
        number: q.n,
        optionA: q.a,
        optionB: q.b,
        scoring: { A: q.sa, B: q.sb },
      },
    });
  }
  console.log(`Kostick: ${kostickPairs.length} preguntas creadas`);

  // ==========================================
  // 3. TEST VALANTI
  // ==========================================
  // Valanti (Cuestionario de Valores y Antivalores) evalua 5 dimensiones
  // asociadas a niveles de la personalidad segun el manual original:
  //   V = Verdad        (nivel intelectual, funcion: pensar)
  //   R = Rectitud      (nivel fisico,      funcion: actuar)
  //   P = Paz           (nivel emocional,   funcion: sentir)
  //   A = Amor          (nivel psiquico,    funcion: intuir)
  //   N = No-violencia  (nivel espiritual,  funcion: ser)
  //
  // Estructura del test: 80 pares = 40 de valores (parte I) + 40 de antivalores
  // (parte II). En cada par, el candidato reparte 3 puntos entre A y B, con
  // asignaciones permitidas: 3-0, 0-3, 2-1 o 1-2.
  //   Parte I (valores):     A y B son dos valores; los puntos que asigna se
  //                          suman a la dimension correspondiente.
  //   Parte II (antivalores): A y B son dos antivalores; los puntos reflejan
  //                          cuan inaceptable considera cada uno. Se suman
  //                          igual a la dimension del antivalor (alto puntaje
  //                          = mayor rechazo = mayor valoracion de la virtud).
  //
  // Max score por dimension: 32 apariciones × 3 pts = 96 pts.
  //   (cada dimension aparece 16 veces en valores + 16 en antivalores).
  const valanti = await prisma.test.create({
    data: {
      name: 'Valanti',
      description: 'Cuestionario de Valores y Antivalores - mide 5 dimensiones: Verdad, Rectitud, Paz, Amor y No-violencia',
      type: 'VALANTI',
      questionFormat: 'PAIR_DISTRIBUTION',
      timeLimitMin: 30,
      totalQuestions: 80,
      instructions: 'Este cuestionario consta de 80 pares de afirmaciones. Para cada par, distribuya 3 puntos entre las opciones A y B segun la importancia que usted les da. Las distribuciones validas son: 3-0, 0-3, 2-1 o 1-2 (no puede dar 3-3 ni 0-0). En la primera parte se presentan valores; reparta los puntos segun la importancia que cada afirmacion tiene en su vida. En la segunda parte se presentan antivalores; reparta los puntos segun cuan inaceptable considere cada afirmacion. No hay respuestas correctas ni incorrectas.',
      createdById: admin.id,
      scales: {
        create: [
          { code: 'V', name: 'Verdad',       description: 'Nivel intelectual - buscar y sostener lo verdadero', maxScore: 96, order: 1 },
          { code: 'R', name: 'Rectitud',     description: 'Nivel fisico - actuar con integridad y coherencia',  maxScore: 96, order: 2 },
          { code: 'P', name: 'Paz',          description: 'Nivel emocional - armonia interior y equilibrio',    maxScore: 96, order: 3 },
          { code: 'A', name: 'Amor',         description: 'Nivel psiquico - empatia y servicio a los demas',    maxScore: 96, order: 4 },
          { code: 'N', name: 'No-violencia', description: 'Nivel espiritual - respeto por toda forma de vida',  maxScore: 96, order: 5 },
        ],
      },
    },
  });

  // Items por dimension (8 valores + 8 antivalores por dimension)
  const valantiItems: Record<string, { values: string[]; antivalues: string[] }> = {
    V: {
      values: [
        'Sostener la verdad aunque resulte incomoda',
        'Ser coherente entre lo que pienso y lo que hago',
        'Investigar los hechos antes de opinar',
        'Reconocer mis errores y aprender de ellos',
        'Decir lo que pienso con honestidad',
        'Buscar evidencia antes de emitir un juicio',
        'Aceptar cuando alguien me corrige con razon',
        'Basar mis decisiones en informacion verificada',
      ],
      antivalues: [
        'Mentir para evitar una consecuencia',
        'Aparentar saber cuando no se',
        'Ocultar informacion a quien tiene derecho a saberla',
        'Distorsionar los hechos para quedar bien',
        'Negar la realidad cuando no me conviene',
        'Fabricar excusas para justificar mis fallos',
        'Propagar rumores sin verificar',
        'Engañar con verdades a medias',
      ],
    },
    R: {
      values: [
        'Cumplir la palabra dada',
        'Ser puntual con mis compromisos',
        'Actuar con integridad en situaciones dificiles',
        'Ser leal con quienes confian en mi',
        'Asumir mis responsabilidades sin excusas',
        'Respetar los acuerdos aun cuando nadie me observa',
        'Ser justo con todos por igual',
        'Cumplir las normas que acepto voluntariamente',
      ],
      antivalues: [
        'Apropiarme de lo que no es mio',
        'Romper un compromiso por conveniencia',
        'Aprovecharme de mi posicion para beneficio propio',
        'Ser desleal con quien confio en mi',
        'Actuar con hipocresia frente a otros',
        'Usar trampas para ganar una ventaja',
        'Evadir mis obligaciones',
        'Abusar de la confianza recibida',
      ],
    },
    P: {
      values: [
        'Mantener la calma ante situaciones adversas',
        'Cultivar la paciencia en la convivencia',
        'Perdonar y soltar resentimientos',
        'Aceptar con serenidad lo que no puedo cambiar',
        'Buscar el equilibrio emocional en mi vida',
        'Practicar momentos de silencio y reflexion',
        'Resolver mis conflictos internos con tranquilidad',
        'Evitar alimentar la angustia innecesaria',
      ],
      antivalues: [
        'Guardar rencor por mucho tiempo',
        'Discutir acaloradamente por cualquier desacuerdo',
        'Preocuparme por cosas que no puedo controlar',
        'Alimentar la envidia hacia los demas',
        'Reaccionar con ira ante la frustracion',
        'Vivir en constante ansiedad',
        'Culpar a otros de mis propios malestares',
        'Mantener pensamientos obsesivos que me quitan la paz',
      ],
    },
    A: {
      values: [
        'Ayudar a quien lo necesita sin esperar retribucion',
        'Escuchar con empatia a quien me habla',
        'Aceptar a las personas tal como son',
        'Ser generoso con mi tiempo y recursos',
        'Acompañar al que atraviesa un momento dificil',
        'Tratar a todos con calidez',
        'Perdonar a quien me ha ofendido',
        'Expresar afecto a mis seres queridos',
      ],
      antivalues: [
        'Ser indiferente ante el dolor ajeno',
        'Burlarme de las debilidades de otros',
        'Actuar pensando solo en mi beneficio',
        'Discriminar a personas por su condicion',
        'Humillar a alguien en publico',
        'Aprovecharme del afecto que otros me dan',
        'Ignorar a quien busca mi ayuda',
        'Usar a las personas como medio para mis fines',
      ],
    },
    N: {
      values: [
        'Respetar toda forma de vida',
        'Resolver los conflictos mediante el dialogo',
        'Defender a quien no puede defenderse',
        'Cuidar el entorno natural y los animales',
        'Ser tolerante con quien piensa distinto',
        'Promover la reconciliacion entre las personas',
        'Rechazar toda forma de discriminacion',
        'Tratar con dignidad hasta a quien me ofende',
      ],
      antivalues: [
        'Agredir fisicamente a otra persona',
        'Intimidar mediante amenazas',
        'Causar daño a un animal por diversion',
        'Provocar peleas innecesarias',
        'Imponerme usando la fuerza',
        'Vengarme de quien me hizo daño',
        'Destruir bienes ajenos por coraje',
        'Usar la violencia como recurso para ganar',
      ],
    },
  };

  // Generacion de 40 pares de valores + 40 pares de antivalores.
  // 10 combinaciones unicas de dimensiones (V-R, V-P, V-A, V-N, R-P, R-A, R-N, P-A, P-N, A-N)
  // × 4 instancias cada una = 40 pares por parte.
  const dimPairs: [string, string][] = [
    ['V','R'], ['V','P'], ['V','A'], ['V','N'],
    ['R','P'], ['R','A'], ['R','N'],
    ['P','A'], ['P','N'],
    ['A','N'],
  ];
  type ValantiPair = { n: number; a: string; b: string; sa: string; sb: string; section: 'VALUES' | 'ANTIVALUES' };
  const allPairs: ValantiPair[] = [];

  // Parte I: valores (preguntas 1-40)
  for (let round = 0; round < 4; round++) {
    for (let pi = 0; pi < dimPairs.length; pi++) {
      const [da, db] = dimPairs[pi];
      // Usamos distintos indices por ronda para no repetir textos
      const idxA = round * 2 + (pi % 2);       // cubre 0..7
      const idxB = round * 2 + ((pi + 1) % 2); // cubre 0..7
      const n = round * 10 + pi + 1;
      allPairs.push({
        n,
        a: valantiItems[da].values[idxA],
        b: valantiItems[db].values[idxB],
        sa: da,
        sb: db,
        section: 'VALUES',
      });
    }
  }
  // Parte II: antivalores (preguntas 41-80)
  for (let round = 0; round < 4; round++) {
    for (let pi = 0; pi < dimPairs.length; pi++) {
      const [da, db] = dimPairs[pi];
      const idxA = round * 2 + (pi % 2);
      const idxB = round * 2 + ((pi + 1) % 2);
      const n = 40 + round * 10 + pi + 1;
      allPairs.push({
        n,
        a: valantiItems[da].antivalues[idxA],
        b: valantiItems[db].antivalues[idxB],
        sa: da,
        sb: db,
        section: 'ANTIVALUES',
      });
    }
  }

  for (const q of allPairs) {
    await prisma.question.create({
      data: {
        testId: valanti.id,
        number: q.n,
        optionA: q.a,
        optionB: q.b,
        scoring: { A: q.sa, B: q.sb, section: q.section },
      },
    });
  }
  console.log(`Valanti: ${allPairs.length} preguntas creadas (40 valores + 40 antivalores)`);

  // ==========================================
  // 4. TEST DISC
  // ==========================================
  const disc = await prisma.test.create({
    data: {
      name: 'DISC',
      description: 'Test de Comportamiento DISC - mide Dominancia, Influencia, Estabilidad y Cumplimiento',
      type: 'DISC',
      questionFormat: 'FORCED_CHOICE_GROUP',
      timeLimitMin: 20,
      totalQuestions: 28,
      instructions: 'A continuacion se presentan 28 grupos de 4 adjetivos. Para cada grupo, seleccione el adjetivo que MAS lo describe y el que MENOS lo describe.',
      createdById: admin.id,
      scales: {
        create: [
          { code: 'D', name: 'Dominancia', description: 'Resolucion de problemas, orientacion a resultados', maxScore: 28, order: 1 },
          { code: 'I', name: 'Influencia', description: 'Influencia sobre otros, comunicacion', maxScore: 28, order: 2 },
          { code: 'S', name: 'Estabilidad', description: 'Paciencia, persistencia, estabilidad', maxScore: 28, order: 3 },
          { code: 'C', name: 'Cumplimiento', description: 'Calidad, precision, cumplimiento de normas', maxScore: 28, order: 4 },
        ],
      },
    },
  });

  // DISC: cada grupo tiene 4 adjetivos, uno por escala (D, I, S, C) en orden canonico.
  // Para evitar sesgo posicional (que el candidato pueda "ganar" D eligiendo siempre
  // el 1er adjetivo), aplicamos una permutacion balanceada por grupo: cada escala
  // aparece en cada posicion exactamente 7 veces a lo largo de los 28 grupos.
  const discGroupsCanonical = [
    { n: 1,  opts: ['Dominante', 'Influyente', 'Estable', 'Cauteloso'] },
    { n: 2,  opts: ['Aventurero', 'Animado', 'Moderado', 'Preciso'] },
    { n: 3,  opts: ['Enérgico', 'Entusiasta', 'Paciente', 'Perfeccionista'] },
    { n: 4,  opts: ['Audaz', 'Comunicativo', 'Sereno', 'Analitico'] },
    { n: 5,  opts: ['Competitivo', 'Alegre', 'Leal', 'Logico'] },
    { n: 6,  opts: ['Decidido', 'Convincente', 'Amable', 'Cuidadoso'] },
    { n: 7,  opts: ['Directo', 'Sociable', 'Relajado', 'Diplomatico'] },
    { n: 8,  opts: ['Exigente', 'Optimista', 'Predecible', 'Sistematico'] },
    { n: 9,  opts: ['Emprendedor', 'Expresivo', 'Considerado', 'Reservado'] },
    { n: 10, opts: ['Persistente', 'Persuasivo', 'Confiable', 'Disciplinado'] },
    { n: 11, opts: ['Determinado', 'Encantador', 'Bondadoso', 'Meticuloso'] },
    { n: 12, opts: ['Resuelto', 'Carismatico', 'Comprensivo', 'Objetivo'] },
    { n: 13, opts: ['Independiente', 'Confiado', 'Tolerante', 'Exacto'] },
    { n: 14, opts: ['Firme', 'Popular', 'Generoso', 'Ordenado'] },
    { n: 15, opts: ['Atrevido', 'Inspirador', 'Constante', 'Correcto'] },
    { n: 16, opts: ['Valeroso', 'Vivaz', 'Calmado', 'Detallista'] },
    { n: 17, opts: ['Pionero', 'Espontaneo', 'Cooperador', 'Formal'] },
    { n: 18, opts: ['Osado', 'Impulsivo', 'Equilibrado', 'Riguroso'] },
    { n: 19, opts: ['Autoritario', 'Jovial', 'Pacifico', 'Prudente'] },
    { n: 20, opts: ['Asertivo', 'Locuaz', 'Modesto', 'Discreto'] },
    { n: 21, opts: ['Agresivo', 'Efusivo', 'Apacible', 'Minucioso'] },
    { n: 22, opts: ['Imponente', 'Seductor', 'Indulgente', 'Metodico'] },
    { n: 23, opts: ['Tenaz', 'Amistoso', 'Tranquilo', 'Convencional'] },
    { n: 24, opts: ['Mandón', 'Divertido', 'Dócil', 'Normativo'] },
    { n: 25, opts: ['Ambicioso', 'Magnético', 'Pasivo', 'Reflexivo'] },
    { n: 26, opts: ['Retador', 'Emotivo', 'Estable', 'Critico'] },
    { n: 27, opts: ['Ganador', 'Motivador', 'Servicial', 'Conservador'] },
    { n: 28, opts: ['Fuerte', 'Extrovertido', 'Templado', 'Calculador'] },
  ];
  const canonicalScales = ['D', 'I', 'S', 'C'];
  // 28 permutaciones balanceadas: cada indice aparece en cada posicion 7 veces
  const discPermutations = [
    [0,1,2,3], [1,2,3,0], [2,3,0,1], [3,0,1,2],
    [0,2,1,3], [1,3,0,2], [2,0,3,1], [3,1,2,0],
    [0,3,1,2], [1,0,2,3], [2,1,3,0], [3,2,0,1],
    [0,1,3,2], [1,2,0,3], [2,3,1,0], [3,0,2,1],
    [0,2,3,1], [1,3,2,0], [2,0,1,3], [3,1,0,2],
    [0,3,2,1], [1,0,3,2], [2,1,0,3], [3,2,1,0],
    [0,1,2,3], [1,2,3,0], [2,3,0,1], [3,0,1,2],
  ];

  for (let i = 0; i < discGroupsCanonical.length; i++) {
    const g = discGroupsCanonical[i];
    const perm = discPermutations[i];
    // Reordenar adjetivos Y escalas consistentemente segun la permutacion
    const shuffledOpts = perm.map((origIdx) => g.opts[origIdx]);
    const shuffledScales = perm.map((origIdx) => canonicalScales[origIdx]);

    const scoring: any = { most: {}, least: {} };
    shuffledOpts.forEach((_, idx) => {
      scoring.most[String(idx)] = shuffledScales[idx];
      scoring.least[String(idx)] = shuffledScales[idx];
    });
    await prisma.question.create({
      data: {
        testId: disc.id,
        number: g.n,
        options: shuffledOpts.map((label, idx) => ({ index: idx, label })),
        scoring,
      },
    });
  }
  const discGroups = discGroupsCanonical; // alias para el log posterior
  console.log(`DISC: ${discGroups.length} preguntas creadas`);

  // ==========================================
  // 5. TEST 16PF
  // ==========================================
  const pf16 = await prisma.test.create({
    data: {
      name: '16PF (Forma A)',
      description: 'Cuestionario de 16 Factores de Personalidad de Cattell',
      type: 'PF16',
      questionFormat: 'MULTIPLE_CHOICE_ABC',
      timeLimitMin: 45,
      totalQuestions: 191,
      instructions: 'A continuacion se presentan 191 preguntas. Para cada una, elija la opcion A, B o C que mejor lo describa. Conteste con sinceridad, no hay respuestas correctas o incorrectas.',
      createdById: admin.id,
      scales: {
        create: [
          // 16 factores primarios
          { code: 'A', name: 'Afabilidad', description: 'Reservado vs Calido', maxScore: 22, order: 1 },
          { code: 'B', name: 'Razonamiento', description: 'Concreto vs Abstracto', maxScore: 24, order: 2 },
          { code: 'C', name: 'Estabilidad', description: 'Reactivo vs Emocionalmente estable', maxScore: 24, order: 3 },
          { code: 'E', name: 'Dominancia', description: 'Deferente vs Dominante', maxScore: 24, order: 4 },
          { code: 'F', name: 'Animacion', description: 'Serio vs Entusiasta', maxScore: 24, order: 5 },
          { code: 'G', name: 'Atencion a normas', description: 'Inconformista vs Cumplidor', maxScore: 24, order: 6 },
          { code: 'H', name: 'Atrevimiento', description: 'Timido vs Atrevido', maxScore: 24, order: 7 },
          { code: 'I', name: 'Sensibilidad', description: 'Utilitario vs Sensible', maxScore: 24, order: 8 },
          { code: 'L', name: 'Vigilancia', description: 'Confiado vs Vigilante', maxScore: 24, order: 9 },
          { code: 'M', name: 'Abstraccion', description: 'Practico vs Imaginativo', maxScore: 24, order: 10 },
          { code: 'N', name: 'Privacidad', description: 'Abierto vs Privado', maxScore: 24, order: 11 },
          { code: 'O', name: 'Aprension', description: 'Seguro vs Aprensivo', maxScore: 24, order: 12 },
          { code: 'Q1', name: 'Apertura al cambio', description: 'Tradicional vs Abierto al cambio', maxScore: 24, order: 13 },
          { code: 'Q2', name: 'Autosuficiencia', description: 'Seguidor vs Autosuficiente', maxScore: 24, order: 14 },
          { code: 'Q3', name: 'Perfeccionismo', description: 'Flexible vs Perfeccionista', maxScore: 24, order: 15 },
          { code: 'Q4', name: 'Tension', description: 'Relajado vs Tenso', maxScore: 24, order: 16 },
        ],
      },
    },
  });

  // Generar 185 preguntas del 16PF (distribuidas entre los 16 factores)
  const factors16 = ['A','B','C','E','F','G','H','I','L','M','N','O','Q1','Q2','Q3','Q4'];
  const pf16Questions = [
    // Factor A - Afabilidad
    { n: 1, text: 'Me resulta facil hacer amigos nuevos', f: 'A', sa: 2, sb: 1, sc: 0 },
    { n: 2, text: 'Prefiero trabajar solo que en equipo', f: 'A', sa: 0, sb: 1, sc: 2 },
    { n: 3, text: 'Disfruto de las fiestas y reuniones sociales', f: 'A', sa: 2, sb: 1, sc: 0 },
    { n: 4, text: 'Me siento comodo hablando con desconocidos', f: 'A', sa: 2, sb: 1, sc: 0 },
    { n: 5, text: 'Prefiero pasar tiempo a solas', f: 'A', sa: 0, sb: 1, sc: 2 },
    { n: 6, text: 'Me preocupo por el bienestar de los demas', f: 'A', sa: 2, sb: 1, sc: 0 },
    { n: 7, text: 'Soy una persona calida y afectuosa', f: 'A', sa: 2, sb: 1, sc: 0 },
    { n: 8, text: 'Me cuesta expresar mis emociones', f: 'A', sa: 0, sb: 1, sc: 2 },
    { n: 9, text: 'Disfruto ayudando a otros', f: 'A', sa: 2, sb: 1, sc: 0 },
    { n: 10, text: 'Me considero una persona reservada', f: 'A', sa: 0, sb: 1, sc: 2 },
    { n: 11, text: 'Me gusta participar en actividades grupales', f: 'A', sa: 2, sb: 1, sc: 0 },
    // Factor B - Razonamiento
    { n: 12, text: 'Si 3 manzanas cuestan $1.50, cuantas puedo comprar con $5?', f: 'B', sa: 2, sb: 1, sc: 0 },
    { n: 13, text: 'La siguiente analogia es correcta: "gato" es a "felino" como "perro" es a "canino"', f: 'B', sa: 2, sb: 1, sc: 0 },
    { n: 14, text: 'Puedo resolver problemas logicos con facilidad', f: 'B', sa: 2, sb: 1, sc: 0 },
    { n: 15, text: 'Entiendo facilmente conceptos abstractos', f: 'B', sa: 2, sb: 1, sc: 0 },
    { n: 16, text: 'Me gustan los rompecabezas y acertijos', f: 'B', sa: 2, sb: 1, sc: 0 },
    { n: 17, text: 'Comprendo instrucciones complejas rapidamente', f: 'B', sa: 2, sb: 1, sc: 0 },
    { n: 18, text: 'Me resulta facil encontrar patrones', f: 'B', sa: 2, sb: 1, sc: 0 },
    { n: 19, text: 'Disfruto debatir ideas intelectuales', f: 'B', sa: 2, sb: 1, sc: 0 },
    { n: 20, text: 'Prefiero tareas concretas a abstractas', f: 'B', sa: 0, sb: 1, sc: 2 },
    { n: 21, text: 'Analizo los problemas antes de actuar', f: 'B', sa: 2, sb: 1, sc: 0 },
    { n: 22, text: 'Me cuesta entender teorias complicadas', f: 'B', sa: 0, sb: 1, sc: 2 },
    { n: 23, text: 'Me gusta aprender cosas nuevas', f: 'B', sa: 2, sb: 1, sc: 0 },
    // Factor C - Estabilidad emocional
    { n: 24, text: 'Mantengo la calma bajo presion', f: 'C', sa: 2, sb: 1, sc: 0 },
    { n: 25, text: 'Me frustro facilmente', f: 'C', sa: 0, sb: 1, sc: 2 },
    { n: 26, text: 'Controlo bien mis emociones', f: 'C', sa: 2, sb: 1, sc: 0 },
    { n: 27, text: 'Me siento ansioso frecuentemente', f: 'C', sa: 0, sb: 1, sc: 2 },
    { n: 28, text: 'Me recupero rapido de los contratiempos', f: 'C', sa: 2, sb: 1, sc: 0 },
    { n: 29, text: 'Soy una persona emocionalmente estable', f: 'C', sa: 2, sb: 1, sc: 0 },
    { n: 30, text: 'Las criticas me afectan mucho', f: 'C', sa: 0, sb: 1, sc: 2 },
    { n: 31, text: 'Puedo manejar multiples problemas a la vez', f: 'C', sa: 2, sb: 1, sc: 0 },
    { n: 32, text: 'Me altero con los cambios inesperados', f: 'C', sa: 0, sb: 1, sc: 2 },
    { n: 33, text: 'Tengo confianza en mi capacidad', f: 'C', sa: 2, sb: 1, sc: 0 },
    { n: 34, text: 'Me preocupo excesivamente por las cosas', f: 'C', sa: 0, sb: 1, sc: 2 },
    { n: 35, text: 'Manejo bien el estres laboral', f: 'C', sa: 2, sb: 1, sc: 0 },
  ];

  // Generar el resto de preguntas para completar 185
  let questionNum = 36;
  const remainingFactors = ['E','F','G','H','I','L','M','N','O','Q1','Q2','Q3','Q4'];
  const factorLabels: Record<string, string[]> = {
    'E': ['Me gusta dirigir a otros', 'Prefiero que otros tomen las decisiones', 'Doy instrucciones con naturalidad', 'Cedo facilmente ante la presion del grupo', 'Impongo mi punto de vista', 'Me resulta facil delegar tareas', 'Soy una persona sumisa', 'Tomo la iniciativa en el grupo', 'Prefiero seguir ordenes', 'Me gusta tener el control', 'Soy una persona dominante', 'Dejo que otros decidan por mi'],
    'F': ['Soy una persona alegre y animada', 'Prefiero ambientes tranquilos', 'Hago bromas frecuentemente', 'Soy una persona seria y formal', 'Me gusta divertirme', 'Evito las situaciones impredecibles', 'Soy espontaneo', 'Me considero una persona prudente', 'Disfruto de la emocion y la aventura', 'Prefiero la rutina', 'Soy entusiasta', 'Me describen como una persona sobria'],
    'G': ['Cumplo siempre con mis obligaciones', 'A veces ignoro las reglas', 'Soy muy responsable', 'Prefiero la libertad a las normas', 'Sigo las reglas al pie de la letra', 'Me importa hacer lo correcto', 'Soy flexible con las normas', 'Tengo un fuerte sentido del deber', 'Cuestiono las reglas establecidas', 'Soy disciplinado', 'Me adapto a mis propias reglas', 'Respeto la autoridad'],
    'H': ['Me atrevo a hablar en publico', 'Me pongo nervioso ante desconocidos', 'Soy valiente y atrevido', 'Me da vergüenza hablar en grupo', 'Busco nuevas experiencias', 'Soy cauteloso ante lo desconocido', 'Me presento ante extraños sin problema', 'Evito situaciones que me den miedo', 'No me intimido facilmente', 'Soy timido en reuniones sociales', 'Acepto retos sin pensarlo mucho', 'Prefiero lo seguro y conocido'],
    'I': ['Soy una persona sensible', 'Las decisiones deben ser logicas', 'Me conmueven las historias tristes', 'Prefiero pensar con la cabeza fria', 'Valoro la belleza y el arte', 'Soy una persona practica', 'Las emociones guian mis decisiones', 'Soy objetivo y racional', 'Me afecta el sufrimiento ajeno', 'Priorizo la eficiencia', 'Soy empático', 'Me baso en hechos, no en sentimientos'],
    'L': ['Confio en las personas facilmente', 'Sospecho de las intenciones de otros', 'Creo que la gente es honesta', 'Me cuesta confiar en los demas', 'Soy abierto y confiado', 'Estoy alerta ante posibles engaños', 'Creo en la buena voluntad de la gente', 'Verifico lo que me dicen', 'Soy ingenuo segun otros', 'Soy desconfiado por naturaleza', 'Doy el beneficio de la duda', 'Cuestiono las motivaciones ajenas'],
    'M': ['Tengo una imaginacion activa', 'Soy una persona practica y realista', 'Me pierdo en mis pensamientos', 'Me concentro en lo que esta frente a mi', 'Sueño despierto frecuentemente', 'Soy muy pragmatico', 'Tengo ideas creativas e inusuales', 'Prefiero la realidad a la fantasia', 'Me distraigo con facilidad', 'Soy enfocado y concreto', 'Vivo en mi mundo interior', 'Me oriento por los hechos'],
    'N': ['Soy una persona abierta y directa', 'Guardo mis pensamientos para mi', 'Comparto mis sentimientos libremente', 'Soy discreto sobre mi vida personal', 'Hablo de mi vida sin problema', 'No revelo mis planes facilmente', 'Soy transparente en mis intenciones', 'Mantengo mis asuntos en privado', 'Expreso lo que pienso sin filtro', 'Soy diplomatico y reservado', 'Muestro mis emociones abiertamente', 'Guardo mis opiniones'],
    'O': ['Me siento seguro de mi mismo', 'Me preocupo por cometer errores', 'Tengo alta autoestima', 'Siento culpa frecuentemente', 'Me siento capaz y competente', 'Dudo de mis decisiones', 'No me preocupo por lo que piensan', 'Me siento inseguro a menudo', 'Enfrento los problemas con confianza', 'Temo al fracaso', 'Me acepto como soy', 'Me autocritico en exceso'],
    'Q1': ['Me gustan las ideas nuevas y diferentes', 'Prefiero lo tradicional y probado', 'Busco formas innovadoras de hacer las cosas', 'Respeto las tradiciones', 'Me aburre hacer siempre lo mismo', 'Lo convencional me da seguridad', 'Disfruto adaptarme a situaciones nuevas e imprevistas', 'Valoro la experiencia y la tradicion', 'Experimento con nuevas ideas', 'Soy conservador en mis opiniones', 'Me entusiasman los cambios', 'Prefiero metodos conocidos'],
    'Q2': ['Tomo mis propias decisiones', 'Consulto con otros antes de decidir', 'Prefiero trabajar independientemente', 'Me gusta el trabajo en equipo', 'No necesito la aprobacion de otros', 'Valoro la opinion del grupo', 'Soy autosuficiente', 'Dependo del apoyo de los demas', 'Resuelvo problemas solo', 'Prefiero tomar decisiones importantes despues de conversarlas con otros', 'Me basto a mi mismo', 'Necesito companía para trabajar'],
    'Q3': ['Soy organizado y metódico', 'Soy desordenado a veces', 'Planifico todo con anticipación', 'Improviso segun la situacion', 'Me importa la precision', 'Soy flexible con los detalles', 'Controlo mis impulsos', 'Actuo espontaneamente', 'Sigo un plan estricto', 'Me dejo llevar por el momento', 'Soy disciplinado conmigo mismo', 'Relajo mis estándares a veces'],
    'Q4': ['Me siento relajado la mayor parte del tiempo', 'Tengo tension interna frecuente', 'Duermo bien por las noches', 'Me cuesta relajarme', 'Soy una persona tranquila', 'Siento inquietud interior', 'No me impaciento facilmente', 'Me frustro cuando las cosas van lento', 'Estoy en paz conmigo mismo', 'Tengo energia nerviosa', 'Soy paciente', 'Me siento presionado constantemente'],
  };

  for (const factor of remainingFactors) {
    const questions = factorLabels[factor];
    for (let i = 0; i < questions.length; i++) {
      const isReversed = i % 2 === 1;
      await prisma.question.create({
        data: {
          testId: pf16.id,
          number: questionNum,
          text: questions[i],
          optionA: 'Verdadero',
          optionB: 'No estoy seguro',
          optionC: 'Falso',
          scoring: {
            A: { factor, score: isReversed ? 0 : 2 },
            B: { factor, score: 1 },
            C: { factor, score: isReversed ? 2 : 0 },
          },
        },
      });
      questionNum++;
    }
  }

  // Insertar las primeras 35 preguntas del 16PF (factores A, B, C)
  for (const q of pf16Questions) {
    await prisma.question.create({
      data: {
        testId: pf16.id,
        number: q.n,
        text: q.text,
        optionA: 'Verdadero',
        optionB: 'No estoy seguro',
        optionC: 'Falso',
        scoring: {
          A: { factor: q.f, score: q.sa },
          B: { factor: q.f, score: q.sb },
          C: { factor: q.f, score: q.sc },
        },
      },
    });
  }
  console.log(`16PF: ${questionNum - 1 + pf16Questions.length} preguntas creadas`);

  console.log('\nSeed completado exitosamente!');
  console.log('================================');
  console.log(`Admin: admin@mindtalent.com / Admin123!`);
  console.log(`Candidato: candidato@test.com / Candidato123!`);
  console.log(`Tests: Kostick (90), Valanti (16), DISC (28), 16PF (${questionNum - 1 + pf16Questions.length})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
