declare module "@innova-space/visual-design/runtime" {
  export function recordSkillOutcome(input:{
    skill:string;
    accepted?:boolean;
    quality?:number;
    edits?:number;
    exported?:boolean;
  }):{
    id:string;
    samples:number;
    accepted:number;
    rejected:number;
    exports:number;
    meanQuality:number;
    meanEdits:number;
    score:number;
    lastUsed:number;
  };
  export function exportAdaptiveSnapshot():any;
  export function importAdaptiveSnapshot(snapshot:any):void;
  export function rankSkills(ids:string[]):any[];
  export function chooseAdaptiveSkill(ids:string[]):string|null;
  export function adaptiveRoutingBias(ids:string[],maxBoost?:number):Record<string,number>;
}
