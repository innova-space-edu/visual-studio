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
  export function optimizerReadiness(input:{samples?:number;consistency?:number;qualityGain?:number;acceptance?:number;minSamples?:number;minEvidence?:number}):{samples:number;evidence:number;ready:boolean};
  export function regressionDecision(input:{failedCases?:number;qualityDelta?:number;semanticDelta?:number;overflowDelta?:number}):{approved:boolean;reasons:string[]};
  export function experimentReward(input:{accepted?:boolean;exported?:boolean;quality?:number;edits?:number}):number;
  export function candidateLifecycle(candidate:any,status:string):any;
}
