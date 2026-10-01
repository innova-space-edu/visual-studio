declare module "@innova-space/visual-design/engine" {
  export function compileBriefToScene(brief:any): any;
  export function compilePlanToScene(plan:any): any;
  export const ENGINE_CAPABILITIES: any;
}
declare module "@innova-space/visual-assets" {
  export function listPacks(): any[];
  export function getAsset(id:string): any;
  export function searchAssets(query:string, options?:any): any[];
  export function resolveAsset(id:string, params?:any): any;
}
