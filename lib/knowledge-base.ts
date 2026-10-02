export type VisualKind="infographic"|"molecule"|"flowchart"|"math-diagram"|"generic";

export type KnowledgeSection={
  heading:string;
  body?:string;
  bullets?:string[];
  accent?:string;
};

export type VisualRequest={
  kind:VisualKind;
  topic:string;
  normalizedTopic:string;
  subject?:string;
  language:"es";
  requestedSections?:number;
  formula?:string;
};

export type KnowledgeContent={
  title:string;
  subtitle?:string;
  sections:KnowledgeSection[];
  facts?:string[];
  formula?:string;
  molecule?:MoleculeKnowledge;
};

export type MoleculeAtom={symbol:string;label:string;color:string};
export type MoleculeKnowledge={
  name:string;
  formula:string;
  geometry:string;
  bondType:string;
  polarity:string;
  angle?:string;
  description:string;
  atoms:MoleculeAtom[];
};

function normalize(value:string){
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function sectionCount(prompt:string){
  const n=prompt.match(/\b(\d{1,2})\s+(?:secciones|bloques|partes|tarjetas)\b/i);
  if(n)return Math.max(2,Math.min(8,Number(n[1])));
  const words:{[key:string]:number}={dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8};
  const w=prompt.match(/\b(dos|tres|cuatro|cinco|seis|siete|ocho)\s+(?:secciones|bloques|partes|tarjetas)\b/i);
  return w?words[normalize(w[1]!)]:undefined;
}

function cleanTopic(value:string){
  return value
    .replace(/[.?!]+$/g,"")
    .replace(/\s+con\s+(?:\d+|dos|tres|cuatro|cinco|seis|siete|ocho)\s+(?:secciones|bloques|partes|tarjetas).*$/i,"")
    .replace(/\s+(?:educativa|educativo|clara|claro|editable|detallada|detallado)$/i,"")
    .trim();
}

function topicFromPrompt(prompt:string){
  const candidates=[
    /(?:infograf[ií]a|imagen|lámina|lamina|diagrama)\s+(?:educativ[oa]\s+)?sobre\s+(.+)/i,
    /(?:mol[eé]cula|estructura molecular)\s+(?:de\s+)?(.+)/i,
    /(?:sobre|acerca de|de)\s+(.+)/i
  ];
  for(const pattern of candidates){
    const m=prompt.match(pattern);
    if(m?.[1])return cleanTopic(m[1]);
  }
  return cleanTopic(prompt.replace(/^\s*(crea|crear|haz|hace|genera|generar|dibuja|diseña)\s+(un|una)?\s*/i,""));
}

const moleculeCatalog:MoleculeKnowledge[]=[
  {
    name:"Agua",formula:"H2O",geometry:"angular",bondType:"covalente polar",polarity:"polar",angle:"≈ 104,5°",
    description:"Dos átomos de hidrógeno enlazados a un átomo de oxígeno. Su geometría angular produce una distribución desigual de carga.",
    atoms:[
      {symbol:"O",label:"Oxígeno",color:"#fee2e2"},
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"},
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"}
    ]
  },
  {
    name:"Dióxido de carbono",formula:"CO2",geometry:"lineal",bondType:"covalente",polarity:"apolar",angle:"180°",
    description:"Un átomo de carbono central unido a dos oxígenos mediante enlaces dobles. La geometría lineal hace que los dipolos se compensen.",
    atoms:[
      {symbol:"O",label:"Oxígeno",color:"#fee2e2"},
      {symbol:"C",label:"Carbono",color:"#e2e8f0"},
      {symbol:"O",label:"Oxígeno",color:"#fee2e2"}
    ]
  },
  {
    name:"Oxígeno molecular",formula:"O2",geometry:"lineal",bondType:"covalente doble",polarity:"apolar",
    description:"Molécula diatómica formada por dos átomos de oxígeno unidos por un enlace covalente doble.",
    atoms:[
      {symbol:"O",label:"Oxígeno",color:"#fee2e2"},
      {symbol:"O",label:"Oxígeno",color:"#fee2e2"}
    ]
  },
  {
    name:"Nitrógeno molecular",formula:"N2",geometry:"lineal",bondType:"covalente triple",polarity:"apolar",
    description:"Molécula diatómica muy estable formada por dos átomos de nitrógeno unidos por un enlace triple.",
    atoms:[
      {symbol:"N",label:"Nitrógeno",color:"#ede9fe"},
      {symbol:"N",label:"Nitrógeno",color:"#ede9fe"}
    ]
  },
  {
    name:"Metano",formula:"CH4",geometry:"tetraédrica",bondType:"covalente",polarity:"apolar",angle:"≈ 109,5°",
    description:"Un átomo de carbono central enlazado a cuatro hidrógenos. Es una molécula tetraédrica.",
    atoms:[
      {symbol:"C",label:"Carbono",color:"#e2e8f0"},
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"},
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"},
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"},
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"}
    ]
  },
  {
    name:"Amoníaco",formula:"NH3",geometry:"piramidal trigonal",bondType:"covalente polar",polarity:"polar",angle:"≈ 107°",
    description:"Un nitrógeno central unido a tres hidrógenos y con un par de electrones no enlazantes.",
    atoms:[
      {symbol:"N",label:"Nitrógeno",color:"#ede9fe"},
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"},
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"},
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"}
    ]
  },
  {
    name:"Cloruro de hidrógeno",formula:"HCl",geometry:"lineal",bondType:"covalente polar",polarity:"polar",
    description:"Molécula diatómica formada por hidrógeno y cloro. En agua forma ácido clorhídrico.",
    atoms:[
      {symbol:"H",label:"Hidrógeno",color:"#dbeafe"},
      {symbol:"Cl",label:"Cloro",color:"#d1fae5"}
    ]
  },
  {
    name:"Cloruro de sodio",formula:"NaCl",geometry:"red iónica",bondType:"iónico",polarity:"iónico",
    description:"Compuesto iónico formado por iones sodio y cloruro organizados en una red cristalina; no existe como molécula aislada en el sólido.",
    atoms:[
      {symbol:"Na⁺",label:"Sodio",color:"#fef3c7"},
      {symbol:"Cl⁻",label:"Cloro",color:"#d1fae5"}
    ]
  }
];

const knowledgeCatalog:Array<{keys:string[];subject:string;content:KnowledgeContent}>=[
  {
    keys:["sistema solar","sistema planetario"],
    subject:"astronomía",
    content:{
      title:"Sistema Solar",
      subtitle:"El Sol y los cuerpos que orbitan a su alrededor",
      sections:[
        {heading:"El Sol",body:"Es la estrella central del sistema solar y concentra casi toda su masa. Su gravedad mantiene a los planetas en órbita."},
        {heading:"Planetas rocosos",body:"Mercurio, Venus, Tierra y Marte son los cuatro planetas interiores. Tienen superficies sólidas y se ubican más cerca del Sol."},
        {heading:"Planetas gigantes",body:"Júpiter y Saturno son gigantes gaseosos; Urano y Neptuno, gigantes helados. Son más grandes y están más lejos del Sol."},
        {heading:"Órbitas",body:"Los planetas se desplazan alrededor del Sol en órbitas elípticas y cada uno posee un período orbital diferente."},
        {heading:"Otros cuerpos",body:"También existen planetas enanos, asteroides, cometas, meteoroides y numerosos satélites naturales."},
        {heading:"Orden desde el Sol",body:"Mercurio → Venus → Tierra → Marte → Júpiter → Saturno → Urano → Neptuno."}
      ],
      facts:["La Tierra es el tercer planeta desde el Sol.","Júpiter es el planeta de mayor tamaño del sistema solar."]
    }
  },
  {
    keys:["celula animal","célula animal"],
    subject:"biología",
    content:{
      title:"Célula animal",
      subtitle:"Estructura básica de una célula eucariota",
      sections:[
        {heading:"Membrana plasmática",body:"Delimita la célula y regula el intercambio de sustancias con el medio."},
        {heading:"Núcleo",body:"Contiene la mayor parte del ADN y coordina numerosos procesos celulares."},
        {heading:"Mitocondrias",body:"Participan en la respiración celular y en la obtención de energía utilizable."},
        {heading:"Citoplasma",body:"Medio interno donde se encuentran los orgánulos y ocurren muchas reacciones químicas."},
        {heading:"Ribosomas",body:"Sintetizan proteínas a partir de la información genética."}
      ]
    }
  },
  {
    keys:["celula vegetal","célula vegetal"],
    subject:"biología",
    content:{
      title:"Célula vegetal",
      subtitle:"Estructuras que distinguen a las células vegetales",
      sections:[
        {heading:"Pared celular",body:"Capa rígida externa que aporta soporte y protección."},
        {heading:"Cloroplastos",body:"Orgánulos que contienen clorofila y realizan la fotosíntesis."},
        {heading:"Vacuola central",body:"Gran compartimento que almacena agua y contribuye a mantener la turgencia."},
        {heading:"Núcleo",body:"Contiene el ADN y regula la actividad celular."},
        {heading:"Mitocondrias",body:"Participan en la respiración celular y producción de ATP."}
      ]
    }
  },
  {
    keys:["fotosintesis","fotosíntesis"],
    subject:"biología",
    content:{
      title:"Fotosíntesis",
      subtitle:"Transformación de energía luminosa en energía química",
      sections:[
        {heading:"Entradas",body:"Las plantas utilizan dióxido de carbono, agua y energía luminosa."},
        {heading:"Cloroplastos",body:"La fotosíntesis ocurre principalmente en los cloroplastos de las células vegetales."},
        {heading:"Productos",body:"Se produce glucosa como reserva de energía química y se libera oxígeno."},
        {heading:"Importancia",body:"Sostiene gran parte de las cadenas alimentarias y contribuye al oxígeno atmosférico."}
      ],
      formula:"6CO2 + 6H2O -> C6H12O6 + 6O2"
    }
  },
  {
    keys:["ciclo del agua"],
    subject:"ciencias",
    content:{
      title:"Ciclo del agua",
      subtitle:"Movimiento continuo del agua entre superficie y atmósfera",
      sections:[
        {heading:"Evaporación",body:"El calor solar transforma parte del agua líquida en vapor."},
        {heading:"Condensación",body:"El vapor se enfría y forma pequeñas gotas que originan nubes."},
        {heading:"Precipitación",body:"El agua vuelve a la superficie como lluvia, nieve o granizo."},
        {heading:"Escorrentía e infiltración",body:"Parte del agua circula por la superficie y otra se infiltra en el suelo."},
        {heading:"Acumulación",body:"Ríos, lagos, océanos y aguas subterráneas almacenan agua antes de reiniciar el ciclo."}
      ]
    }
  },
  {
    keys:["conservacion de la materia","conservación de la materia"],
    subject:"química",
    content:{
      title:"Conservación de la materia",
      sections:[
        {heading:"Principio",body:"En una reacción química, la materia no se crea ni se destruye: los átomos se reorganizan."},
        {heading:"Reactivos y productos",body:"Debe conservarse la cantidad de átomos de cada elemento antes y después de la reacción."},
        {heading:"Cómo comprobarlo",body:"Cuenta los átomos a ambos lados y ajusta coeficientes para balancear la ecuación."}
      ],
      formula:"2H2 + O2 -> 2H2O"
    }
  },
  {
    keys:["tabla periodica","tabla periódica"],
    subject:"química",
    content:{
      title:"Tabla periódica",
      subtitle:"Organización de los elementos químicos",
      sections:[
        {heading:"Períodos",body:"Son las filas horizontales y se relacionan con los niveles principales de energía."},
        {heading:"Grupos",body:"Son las columnas verticales; los elementos de un mismo grupo comparten propiedades químicas semejantes."},
        {heading:"Metales",body:"Ocupan gran parte de la tabla y suelen conducir bien el calor y la electricidad."},
        {heading:"No metales",body:"Presentan propiedades variadas y se concentran principalmente en la zona derecha."},
        {heading:"Número atómico",body:"Indica la cantidad de protones del núcleo y determina la identidad del elemento."}
      ]
    }
  }
];

function findMolecule(prompt:string,topic:string){
  const hay=normalize(prompt+" "+topic).replace(/₂/g,"2").replace(/₃/g,"3").replace(/₄/g,"4");
  const aliases:{[key:string]:string}={
    agua:"H2O","dioxido de carbono":"CO2","oxigeno molecular":"O2","oxigeno":"O2","nitrogeno molecular":"N2",
    nitrogeno:"N2","metano":"CH4","amoniaco":"NH3","cloruro de hidrogeno":"HCl","acido clorhidrico":"HCl","cloruro de sodio":"NaCl","sal comun":"NaCl"
  };
  for(const mol of moleculeCatalog){
    if(hay.includes(mol.formula.toLowerCase()))return mol;
  }
  for(const [alias,formula] of Object.entries(aliases)){
    if(hay.includes(alias))return moleculeCatalog.find(m=>m.formula===formula);
  }
  return undefined;
}

export function parseVisualRequest(prompt:string):VisualRequest{
  const raw=String(prompt||"").trim();
  const topic=topicFromPrompt(raw)||"tema educativo";
  const normalizedTopic=normalize(topic);
  const molecule=findMolecule(raw,topic);
  let kind:VisualKind="generic";
  if(molecule||/mol[eé]cula|estructura molecular/i.test(raw))kind="molecule";
  else if(/diagrama\s+de\s+flujo|flujo\s+del\s+proceso|proceso\s*:/i.test(raw))kind="flowchart";
  else if(/homotecia|plano cartesiano|funci[oó]n|geometr[ií]a|ecuaci[oó]n matem[aá]tica/i.test(raw))kind="math-diagram";
  else if(/infograf[ií]a|l[aá]mina|imagen educativa|resumen visual/i.test(raw))kind="infographic";
  return {
    kind,topic,normalizedTopic,
    subject:molecule?"química":knowledgeCatalog.find(entry=>entry.keys.some(key=>normalizedTopic.includes(normalize(key))))?.subject,
    language:"es",
    requestedSections:sectionCount(raw),
    formula:molecule?.formula
  };
}

function genericContent(topic:string,count=4):KnowledgeContent{
  const safe=topic||"Tema";
  return {
    title:safe.charAt(0).toUpperCase()+safe.slice(1),
    subtitle:"Resumen visual editable",
    sections:[
      {heading:"Concepto central",body:`Presenta la definición esencial de ${safe} y su idea principal.`},
      {heading:"Elementos principales",body:`Organiza los componentes, partes o conceptos fundamentales relacionados con ${safe}.`},
      {heading:"Relaciones",body:`Muestra cómo se conectan entre sí los elementos más importantes de ${safe}.`},
      {heading:"Aplicación",body:`Incluye un ejemplo, uso o situación que ayude a comprender ${safe}.`},
      {heading:"Dato clave",body:`Destaca una idea que conviene recordar al estudiar ${safe}.`},
      {heading:"Comprobación",body:`Revisa que nombres, cifras y relaciones sean coherentes con ${safe}.`}
    ].slice(0,Math.max(3,Math.min(6,count)))
  };
}

export function resolveKnowledgeContent(request:VisualRequest,prompt:string):KnowledgeContent{
  const molecule=findMolecule(prompt,request.topic);
  if(molecule){
    return {
      title:`${molecule.name} (${molecule.formula})`,
      subtitle:`Geometría ${molecule.geometry} · ${molecule.bondType}`,
      sections:[
        {heading:"Composición",body:molecule.atoms.map(a=>a.label).join(", ")+` · Fórmula: ${molecule.formula}`},
        {heading:"Geometría",body:molecule.angle?`${molecule.geometry}; ángulo aproximado ${molecule.angle}.`:`Geometría ${molecule.geometry}.`},
        {heading:"Enlace",body:`Tipo de enlace: ${molecule.bondType}.`},
        {heading:"Polaridad",body:`Comportamiento: ${molecule.polarity}.`},
        {heading:"Descripción",body:molecule.description}
      ],
      formula:molecule.formula,
      molecule
    };
  }

  const entry=knowledgeCatalog.find(item=>item.keys.some(key=>request.normalizedTopic.includes(normalize(key))||normalize(key).includes(request.normalizedTopic)));
  if(entry){
    const desired=request.requestedSections;
    return {
      ...entry.content,
      sections:desired?entry.content.sections.slice(0,desired):entry.content.sections
    };
  }
  return genericContent(request.topic,request.requestedSections||4);
}

export function availableKnowledgeTopics(){
  return {
    topics:knowledgeCatalog.map(entry=>entry.content.title),
    molecules:moleculeCatalog.map(m=>`${m.name} (${m.formula})`)
  };
}
