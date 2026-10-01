export interface GoldenVisualCase{
  id:string;
  skill:string;
  prompt:string;
  visualType:string;
  data?:Record<string,unknown>;
}

export const GOLDEN_VISUAL_CASES:GoldenVisualCase[]=[
  {id:"math-homothety-neg2",skill:"math-diagram",visualType:"math-diagram",prompt:"Crea una homotecia k=-2 con triángulo, plano cartesiano y líneas de proyección."},
  {id:"math-homothety-half",skill:"math-diagram",visualType:"math-diagram",prompt:"Crea una homotecia k=0.5 con triángulo, plano cartesiano y líneas de proyección."},
  {id:"chem-water",skill:"chemistry-diagram",visualType:"chemistry-diagram",prompt:"Molécula de agua H2O y ecuación 2H2 + O2 -> 2H2O."},
  {id:"chem-water-alt",skill:"chemistry-diagram",visualType:"chemistry-diagram",prompt:"Crea la molécula de agua H₂O con enlaces, ángulo y ecuación química."},
  {id:"infographic-conservation",skill:"infographic",visualType:"infographic",prompt:"Infografía sobre conservación de la materia con tres secciones."},
  {id:"infographic-energy",skill:"infographic",visualType:"infographic",prompt:"Infografía educativa sobre energía con tres secciones."},
  {id:"flow-basic",skill:"flowchart-diagram",visualType:"flowchart-diagram",prompt:"Diagrama de flujo del proceso: Solicitud, Revisión, Validación, Exportación."},
  {id:"flow-learning",skill:"flowchart-diagram",visualType:"flowchart-diagram",prompt:"Diagrama de flujo: Generar, Evaluar, Editar, Aprender, Publicar."},
  {id:"physics-forces",skill:"physics-diagram",visualType:"physics-diagram",prompt:"Diagrama de fuerzas sobre un objeto.",data:{object:"Bloque",forces:[{label:"N",dx:0,dy:-170},{label:"P",dx:0,dy:170},{label:"F",dx:190,dy:0}]}},
  {id:"biology-cell",skill:"biology-diagram",visualType:"biology-diagram",prompt:"Diagrama educativo de una célula con núcleo y membrana.",data:{mode:"cell"}},
  {id:"data-bars",skill:"data-visualization",visualType:"data-visualization",prompt:"Gráfico de barras editable.",data:{values:[12,28,19,36,24],labels:["A","B","C","D","E"]}},
  {id:"worksheet",skill:"worksheet-design",visualType:"worksheet",prompt:"Guía de trabajo con cuatro actividades.",data:{items:["Identifica","Representa","Calcula","Verifica"]}}
];

export function goldenCasesForSkill(skill:string){
  const exact=GOLDEN_VISUAL_CASES.filter(test=>test.skill===skill);
  return exact.length?exact:GOLDEN_VISUAL_CASES.slice(0,6);
}

export function goldenPlan(test:GoldenVisualCase){
  return {
    visual_brief:{
      visual_type:test.visualType,
      purpose:test.prompt,
      selected_skills:[test.skill],
      text_blocks:[{text:test.prompt}],
      data:test.data||{},
      output:{width:1200,height:800}
    }
  };
}
