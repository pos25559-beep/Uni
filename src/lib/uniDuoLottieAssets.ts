/**
 * Animações Lottie (JSON v5.7.4, 100% offline/vetoriais) de Unis em dupla a interagir
 * para estados de carregamento nas páginas de Cadeiras, Notas e Materiais.
 * Paleta oficial Unipedia ("Estúdio Caderno Vivo").
 */

export type LoadingUnisVariant = 'courses' | 'grades' | 'materials';

type Rgba = [number, number, number, number];
type Vec2 = [number, number];
type Vec3 = [number, number, number];

const INK: Rgba = [0.078, 0.075, 0.071, 1]; // #141312
const CREAM: Rgba = [0.98, 0.973, 0.949, 1]; // #FAF8F2
const FOREST: Rgba = [0.082, 0.498, 0.345, 1]; // #157F58
const CORAL: Rgba = [0.878, 0.31, 0.2, 1]; // #E04F33
const SAGE_UNI: Rgba = [0.788, 0.863, 0.624, 1]; // #C9DC9F
const SKY_UNI: Rgba = [0.769, 0.878, 0.992, 1]; // #C4E0FD
const PEACH_UNI: Rgba = [0.98, 0.839, 0.729, 1]; // #FAD6BA
const BUTTER_UNI: Rgba = [0.988, 0.914, 0.624, 1]; // #FCE99F
const CHEEK: Rgba = [0.878, 0.31, 0.2, 1];

// Silhueta em nuvem do Uni centrada em [0, 0] (~44x44px)
const CLOUD_PATH = {
  v: [
    [0, -21],
    [13, -15],
    [21, -4],
    [20, 10],
    [10, 20],
    [-10, 20],
    [-20, 10],
    [-21, -4],
    [-13, -15],
  ] as Vec2[],
  i: [
    [-5, 0],
    [-3, -5],
    [0, -5],
    [4, -3],
    [5, 0],
    [4, 3],
    [-2, 5],
    [-5, 2],
    [-4, 0],
  ] as Vec2[],
  o: [
    [5, 0],
    [5, 3],
    [2, 5],
    [-4, 3],
    [-5, 0],
    [-4, -3],
    [0, -5],
    [3, -5],
    [4, 0],
  ] as Vec2[],
  c: true,
};

function makeTransform(
  p: { a: 0 | 1; k: unknown },
  s: { a: 0 | 1; k: unknown } = { a: 0, k: [100, 100, 100] },
  r: { a: 0 | 1; k: unknown } = { a: 0, k: 0 },
  o: { a: 0 | 1; k: unknown } = { a: 0, k: 100 },
) {
  return {
    o,
    r,
    p,
    a: { a: 0, k: [0, 0, 0] as Vec3 },
    s,
  };
}

function groupTr() {
  return {
    ty: 'tr',
    p: { a: 0, k: [0, 0] as Vec2 },
    a: { a: 0, k: [0, 0] as Vec2 },
    s: { a: 0, k: [100, 100] as Vec2 },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  };
}

interface UniLayerOpts {
  ind: number;
  name: string;
  bodyColor: Rgba;
  bookmarkColor: Rgba;
  posKeyframes: Array<{ t: number; s: Vec3 }>;
  rotKeyframes: Array<{ t: number; s: number[] }>;
  blinkWindow?: [number, number, number];
  scalePercent?: number;
}

function buildUniLayer({
  ind,
  name,
  bodyColor,
  bookmarkColor,
  posKeyframes,
  rotKeyframes,
  blinkWindow = [70, 74, 78],
  scalePercent = 100,
}: UniLayerOpts) {
  const [b0, b1, b2] = blinkWindow;
  const eyeScale = {
    a: 1 as const,
    k: [
      { t: 0, s: [100, 100] as Vec2 },
      { t: b0, s: [100, 100] as Vec2 },
      { t: b1, s: [100, 15] as Vec2 },
      { t: b2, s: [100, 100] as Vec2 },
      { t: 90, s: [100, 100] as Vec2 },
    ],
  };

  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks: makeTransform(
      { a: 1, k: posKeyframes },
      { a: 0, k: [scalePercent, scalePercent, 100] as Vec3 },
      { a: 1, k: rotKeyframes },
    ),
    shapes: [
      // Marcador de livro no topo
      {
        ty: 'gr',
        nm: 'bookmark',
        it: [
          {
            ty: 'sh',
            ks: {
              a: 0,
              k: {
                v: [
                  [-3.5, -19],
                  [-3.5, -26],
                  [0, -23],
                  [3.5, -26],
                  [3.5, -19],
                ],
                i: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
                o: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
                c: true,
              },
            },
          },
          { ty: 'fl', c: { a: 0, k: bookmarkColor }, o: { a: 0, k: 100 } },
          { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.8 }, lc: 2, lj: 2 },
          groupTr(),
        ],
      },
      // Corpo do Uni em nuvem
      {
        ty: 'gr',
        nm: 'body',
        it: [
          { ty: 'sh', ks: { a: 0, k: CLOUD_PATH } },
          { ty: 'fl', c: { a: 0, k: bodyColor }, o: { a: 0, k: 100 } },
          { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 }, lc: 2, lj: 2 },
          groupTr(),
        ],
      },
      // Bochechas rosadas
      {
        ty: 'gr',
        nm: 'cheeks',
        it: [
          { ty: 'el', d: 1, s: { a: 0, k: [4.5, 3] }, p: { a: 0, k: [-9.5, 4] } },
          { ty: 'el', d: 1, s: { a: 0, k: [4.5, 3] }, p: { a: 0, k: [9.5, 4] } },
          { ty: 'fl', c: { a: 0, k: CHEEK }, o: { a: 0, k: 40 } },
          groupTr(),
        ],
      },
      // Olho esquerdo com piscar natural
      {
        ty: 'gr',
        nm: 'eye_left',
        it: [
          { ty: 'el', d: 1, s: { a: 0, k: [4, 4.4] }, p: { a: 0, k: [0, 0] } },
          { ty: 'fl', c: { a: 0, k: INK }, o: { a: 0, k: 100 } },
          {
            ty: 'tr',
            p: { a: 0, k: [-6.5, -1.5] as Vec2 },
            a: { a: 0, k: [0, 0] as Vec2 },
            s: eyeScale,
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
          },
        ],
      },
      // Olho direito com piscar natural
      {
        ty: 'gr',
        nm: 'eye_right',
        it: [
          { ty: 'el', d: 1, s: { a: 0, k: [4, 4.4] }, p: { a: 0, k: [0, 0] } },
          { ty: 'fl', c: { a: 0, k: INK }, o: { a: 0, k: 100 } },
          {
            ty: 'tr',
            p: { a: 0, k: [6.5, -1.5] as Vec2 },
            a: { a: 0, k: [0, 0] as Vec2 },
            s: eyeScale,
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
          },
        ],
      },
      // Sorriso expressivo
      {
        ty: 'gr',
        nm: 'smile',
        it: [
          {
            ty: 'sh',
            ks: {
              a: 0,
              k: {
                v: [[-4.2, 4.2], [0, 7.2], [4.2, 4.2]],
                i: [[0, 0], [-1.8, 0], [0, 0]],
                o: [[0, 0], [1.8, 0], [0, 0]],
                c: false,
              },
            },
          },
          { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 }, lc: 2, lj: 2 },
          groupTr(),
        ],
      },
    ],
    ip: 0,
    op: 90,
    st: 0,
  };
}

// 1. CADEIRAS: Dois Unis a organizar e deslizar uma pasta de cadeira com separador e brilho
const COURSES_DUO_LOTTIE = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 90,
  w: 176,
  h: 88,
  nm: 'loading_unis_courses',
  ddd: 0,
  assets: [],
  layers: [
    // Estrela de organização no centro quando os Unis alinham a pasta
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'spark',
      sr: 1,
      ks: makeTransform(
        {
          a: 1,
          k: [
            { t: 0, s: [88, 22, 0] as Vec3 },
            { t: 45, s: [88, 16, 0] as Vec3 },
            { t: 90, s: [88, 22, 0] as Vec3 },
          ],
        },
        {
          a: 1,
          k: [
            { t: 0, s: [40, 40, 100] as Vec3 },
            { t: 25, s: [40, 40, 100] as Vec3 },
            { t: 45, s: [110, 110, 100] as Vec3 },
            { t: 65, s: [40, 40, 100] as Vec3 },
            { t: 90, s: [40, 40, 100] as Vec3 },
          ],
        },
        {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 45, s: [20] },
            { t: 90, s: [0] },
          ],
        },
        {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 30, s: [0] },
            { t: 45, s: [100] },
            { t: 65, s: [0] },
            { t: 90, s: [0] },
          ],
        },
      ),
      shapes: [
        {
          ty: 'gr',
          nm: 'star_grp',
          it: [
            {
              ty: 'sr',
              sy: 1,
              d: 1,
              pt: { a: 0, k: 4 },
              p: { a: 0, k: [0, 0] },
              r: { a: 0, k: 0 },
              ir: { a: 0, k: 3.5 },
              is: { a: 0, k: 0 },
              or: { a: 0, k: 9 },
              os: { a: 0, k: 0 },
            },
            { ty: 'fl', c: { a: 0, k: BUTTER_UNI }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.6 }, lc: 2, lj: 2 },
            groupTr(),
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
    },
    // Pasta de cadeira que desliza entre os dois Unis
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'course_folder',
      sr: 1,
      ks: makeTransform(
        {
          a: 1,
          k: [
            { t: 0, s: [66, 56, 0] as Vec3 },
            { t: 22, s: [88, 43, 0] as Vec3 },
            { t: 45, s: [110, 56, 0] as Vec3 },
            { t: 68, s: [88, 45, 0] as Vec3 },
            { t: 90, s: [66, 56, 0] as Vec3 },
          ],
        },
        {
          a: 1,
          k: [
            { t: 0, s: [95, 95, 100] as Vec3 },
            { t: 22, s: [108, 108, 100] as Vec3 },
            { t: 45, s: [95, 95, 100] as Vec3 },
            { t: 68, s: [106, 106, 100] as Vec3 },
            { t: 90, s: [95, 95, 100] as Vec3 },
          ],
        },
        {
          a: 1,
          k: [
            { t: 0, s: [-8] },
            { t: 22, s: [0] },
            { t: 45, s: [8] },
            { t: 68, s: [0] },
            { t: 90, s: [-8] },
          ],
        },
      ),
      shapes: [
        {
          ty: 'gr',
          nm: 'folder_tab',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [12, 6] }, p: { a: 0, k: [-6, -9] }, r: { a: 0, k: 2 } },
            { ty: 'fl', c: { a: 0, k: FOREST }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.6 } },
            groupTr(),
          ],
        },
        {
          ty: 'gr',
          nm: 'folder_body',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [26, 18] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 4 } },
            { ty: 'fl', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.8 } },
            groupTr(),
          ],
        },
        {
          ty: 'gr',
          nm: 'folder_lines',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [14, 2.2] }, p: { a: 0, k: [-2, -2.5] }, r: { a: 0, k: 1 } },
            { ty: 'rc', d: 1, s: { a: 0, k: [10, 2.2] }, p: { a: 0, k: [-4, 2.5] }, r: { a: 0, k: 1 } },
            { ty: 'fl', c: { a: 0, k: CORAL }, o: { a: 0, k: 100 } },
            groupTr(),
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
    },
    buildUniLayer({
      ind: 3,
      name: 'uni_left_courses',
      bodyColor: SAGE_UNI,
      bookmarkColor: CORAL,
      posKeyframes: [
        { t: 0, s: [40, 52, 0] },
        { t: 22, s: [46, 48, 0] },
        { t: 45, s: [38, 52, 0] },
        { t: 68, s: [45, 49, 0] },
        { t: 90, s: [40, 52, 0] },
      ],
      rotKeyframes: [
        { t: 0, s: [-4] },
        { t: 22, s: [6] },
        { t: 45, s: [-2] },
        { t: 68, s: [4] },
        { t: 90, s: [-4] },
      ],
      blinkWindow: [58, 62, 66],
    }),
    buildUniLayer({
      ind: 4,
      name: 'uni_right_courses',
      bodyColor: SKY_UNI,
      bookmarkColor: BUTTER_UNI,
      scalePercent: 92,
      posKeyframes: [
        { t: 0, s: [136, 53, 0] },
        { t: 22, s: [132, 52, 0] },
        { t: 45, s: [128, 47, 0] },
        { t: 68, s: [134, 52, 0] },
        { t: 90, s: [136, 53, 0] },
      ],
      rotKeyframes: [
        { t: 0, s: [3] },
        { t: 22, s: [-2] },
        { t: 45, s: [-7] },
        { t: 68, s: [2] },
        { t: 90, s: [3] },
      ],
      blinkWindow: [24, 28, 32],
    }),
  ],
};

// 2. NOTAS: Dois Unis a analisar uma pauta com barras crescentes e selo verde de confirmação
const GRADES_DUO_LOTTIE = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 90,
  w: 176,
  h: 88,
  nm: 'loading_unis_grades',
  ddd: 0,
  assets: [],
  layers: [
    // Selo verde de confirmação no canto do cartão de notas
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'grade_check',
      sr: 1,
      ks: makeTransform(
        { a: 0, k: [104, 26, 0] as Vec3 },
        {
          a: 1,
          k: [
            { t: 0, s: [30, 30, 100] as Vec3 },
            { t: 36, s: [30, 30, 100] as Vec3 },
            { t: 50, s: [115, 115, 100] as Vec3 },
            { t: 62, s: [100, 100, 100] as Vec3 },
            { t: 80, s: [100, 100, 100] as Vec3 },
            { t: 90, s: [30, 30, 100] as Vec3 },
          ],
        },
        { a: 0, k: 0 },
        {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 36, s: [0] },
            { t: 48, s: [100] },
            { t: 80, s: [100] },
            { t: 90, s: [0] },
          ],
        },
      ),
      shapes: [
        {
          ty: 'gr',
          nm: 'badge_bg',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [18, 18] }, p: { a: 0, k: [0, 0] } },
            { ty: 'fl', c: { a: 0, k: FOREST }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.6 } },
            groupTr(),
          ],
        },
        {
          ty: 'gr',
          nm: 'badge_tick',
          it: [
            {
              ty: 'sh',
              ks: {
                a: 0,
                k: {
                  v: [[-3.8, 0.2], [-1, 3], [4, -3]],
                  i: [[0, 0], [0, 0], [0, 0]],
                  o: [[0, 0], [0, 0], [0, 0]],
                  c: false,
                },
              },
            },
            { ty: 'st', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 }, lc: 2, lj: 2 },
            groupTr(),
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
    },
    // Cartão de notas com duas barras animadas ao centro
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'grade_sheet',
      sr: 1,
      ks: makeTransform(
        {
          a: 1,
          k: [
            { t: 0, s: [88, 49, 0] as Vec3 },
            { t: 45, s: [88, 44, 0] as Vec3 },
            { t: 90, s: [88, 49, 0] as Vec3 },
          ],
        },
        { a: 0, k: [100, 100, 100] as Vec3 },
        {
          a: 1,
          k: [
            { t: 0, s: [-2] },
            { t: 45, s: [2] },
            { t: 90, s: [-2] },
          ],
        },
      ),
      shapes: [
        {
          ty: 'gr',
          nm: 'card_bg',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [32, 36] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 6 } },
            { ty: 'fl', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.8 } },
            groupTr(),
          ],
        },
        // Barra 1 crescente (Forest)
        {
          ty: 'gr',
          nm: 'bar_top',
          it: [
            {
              ty: 'rc',
              d: 1,
              s: {
                a: 1,
                k: [
                  { t: 0, s: [8, 4.5] as Vec2 },
                  { t: 35, s: [20, 4.5] as Vec2 },
                  { t: 75, s: [20, 4.5] as Vec2 },
                  { t: 90, s: [8, 4.5] as Vec2 },
                ],
              },
              p: { a: 0, k: [0, -6] },
              r: { a: 0, k: 2 },
            },
            { ty: 'fl', c: { a: 0, k: FOREST }, o: { a: 0, k: 100 } },
            groupTr(),
          ],
        },
        // Barra 2 crescente (Coral)
        {
          ty: 'gr',
          nm: 'bar_mid',
          it: [
            {
              ty: 'rc',
              d: 1,
              s: {
                a: 1,
                k: [
                  { t: 0, s: [6, 4.5] as Vec2 },
                  { t: 42, s: [16, 4.5] as Vec2 },
                  { t: 75, s: [16, 4.5] as Vec2 },
                  { t: 90, s: [6, 4.5] as Vec2 },
                ],
              },
              p: { a: 0, k: [-2, 2] },
              r: { a: 0, k: 2 },
            },
            { ty: 'fl', c: { a: 0, k: CORAL }, o: { a: 0, k: 100 } },
            groupTr(),
          ],
        },
        // Linha base (Manteiga)
        {
          ty: 'gr',
          nm: 'bar_bot',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [18, 3.5] }, p: { a: 0, k: [-1, 10] }, r: { a: 0, k: 1.5 } },
            { ty: 'fl', c: { a: 0, k: BUTTER_UNI }, o: { a: 0, k: 100 } },
            groupTr(),
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
    },
    buildUniLayer({
      ind: 3,
      name: 'uni_left_grades',
      bodyColor: SAGE_UNI,
      bookmarkColor: CORAL,
      posKeyframes: [
        { t: 0, s: [38, 52, 0] },
        { t: 30, s: [42, 50, 0] },
        { t: 52, s: [42, 42, 0] },
        { t: 70, s: [38, 52, 0] },
        { t: 90, s: [38, 52, 0] },
      ],
      rotKeyframes: [
        { t: 0, s: [2] },
        { t: 30, s: [6] },
        { t: 52, s: [-6] },
        { t: 70, s: [2] },
        { t: 90, s: [2] },
      ],
      blinkWindow: [18, 22, 26],
    }),
    buildUniLayer({
      ind: 4,
      name: 'uni_right_grades',
      bodyColor: PEACH_UNI,
      bookmarkColor: FOREST,
      scalePercent: 92,
      posKeyframes: [
        { t: 0, s: [138, 53, 0] },
        { t: 30, s: [134, 51, 0] },
        { t: 52, s: [134, 42, 0] },
        { t: 70, s: [138, 53, 0] },
        { t: 90, s: [138, 53, 0] },
      ],
      rotKeyframes: [
        { t: 0, s: [-2] },
        { t: 30, s: [-6] },
        { t: 52, s: [7] },
        { t: 70, s: [-2] },
        { t: 90, s: [-2] },
      ],
      blinkWindow: [64, 68, 72],
    }),
  ],
};

// 3. MATERIAIS: Um Uni passa folhas de estudo/PDF em arco e o outro empilha-as em segurança
const MATERIALS_DUO_LOTTIE = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 90,
  w: 176,
  h: 88,
  nm: 'loading_unis_materials',
  ddd: 0,
  assets: [],
  layers: [
    // Pequena pilha de folhas junto ao Uni direito
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'sheet_stack',
      sr: 1,
      ks: makeTransform({ a: 0, k: [112, 66, 0] as Vec3 }),
      shapes: [
        {
          ty: 'gr',
          nm: 'stack_bot',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [20, 6] }, p: { a: 0, k: [0, 3] }, r: { a: 0, k: 2 } },
            { ty: 'fl', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.5 } },
            groupTr(),
          ],
        },
        {
          ty: 'gr',
          nm: 'stack_top',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [20, 6] }, p: { a: 0, k: [-1, -2] }, r: { a: 0, k: 2 } },
            { ty: 'fl', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.5 } },
            groupTr(),
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
    },
    // Folha lançada em arco entre os dois Unis
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'flying_sheet',
      sr: 1,
      ks: makeTransform(
        {
          a: 1,
          k: [
            { t: 0, s: [56, 46, 0] as Vec3 },
            { t: 18, s: [72, 23, 0] as Vec3 },
            { t: 36, s: [88, 17, 0] as Vec3 },
            { t: 54, s: [106, 26, 0] as Vec3 },
            { t: 72, s: [113, 52, 0] as Vec3 },
            { t: 90, s: [56, 46, 0] as Vec3 },
          ],
        },
        {
          a: 1,
          k: [
            { t: 0, s: [85, 85, 100] as Vec3 },
            { t: 36, s: [106, 106, 100] as Vec3 },
            { t: 72, s: [88, 88, 100] as Vec3 },
            { t: 90, s: [85, 85, 100] as Vec3 },
          ],
        },
        {
          a: 1,
          k: [
            { t: 0, s: [-16] },
            { t: 36, s: [4] },
            { t: 72, s: [14] },
            { t: 90, s: [-16] },
          ],
        },
        {
          a: 1,
          k: [
            { t: 0, s: [0] },
            { t: 12, s: [100] },
            { t: 66, s: [100] },
            { t: 78, s: [0] },
            { t: 90, s: [0] },
          ],
        },
      ),
      shapes: [
        {
          ty: 'gr',
          nm: 'page_card',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [20, 24] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 4 } },
            { ty: 'fl', c: { a: 0, k: CREAM }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: INK }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.8 } },
            groupTr(),
          ],
        },
        {
          ty: 'gr',
          nm: 'page_lines',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [11, 2.2] }, p: { a: 0, k: [0, -4] }, r: { a: 0, k: 1 } },
            { ty: 'rc', d: 1, s: { a: 0, k: [9, 2.2] }, p: { a: 0, k: [-1, 1] }, r: { a: 0, k: 1 } },
            { ty: 'rc', d: 1, s: { a: 0, k: [7, 2.2] }, p: { a: 0, k: [-2, 6] }, r: { a: 0, k: 1 } },
            { ty: 'fl', c: { a: 0, k: FOREST }, o: { a: 0, k: 100 } },
            groupTr(),
          ],
        },
      ],
      ip: 0,
      op: 90,
      st: 0,
    },
    buildUniLayer({
      ind: 3,
      name: 'uni_left_materials',
      bodyColor: SAGE_UNI,
      bookmarkColor: CORAL,
      posKeyframes: [
        { t: 0, s: [40, 52, 0] },
        { t: 18, s: [46, 46, 0] },
        { t: 45, s: [38, 52, 0] },
        { t: 90, s: [40, 52, 0] },
      ],
      rotKeyframes: [
        { t: 0, s: [-6] },
        { t: 18, s: [8] },
        { t: 45, s: [-2] },
        { t: 90, s: [-6] },
      ],
      blinkWindow: [46, 50, 54],
    }),
    buildUniLayer({
      ind: 4,
      name: 'uni_right_materials',
      bodyColor: BUTTER_UNI,
      bookmarkColor: FOREST,
      scalePercent: 92,
      posKeyframes: [
        { t: 0, s: [138, 53, 0] },
        { t: 45, s: [134, 51, 0] },
        { t: 64, s: [129, 46, 0] },
        { t: 78, s: [136, 54, 0] },
        { t: 90, s: [138, 53, 0] },
      ],
      rotKeyframes: [
        { t: 0, s: [2] },
        { t: 45, s: [-3] },
        { t: 64, s: [-8] },
        { t: 78, s: [4] },
        { t: 90, s: [2] },
      ],
      blinkWindow: [16, 20, 24],
    }),
  ],
};

export const UNI_DUO_LOTTIE_ASSETS: Record<LoadingUnisVariant, object> = {
  courses: COURSES_DUO_LOTTIE,
  grades: GRADES_DUO_LOTTIE,
  materials: MATERIALS_DUO_LOTTIE,
};
