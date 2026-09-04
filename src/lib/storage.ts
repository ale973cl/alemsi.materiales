import type { AppState } from "@/types";
const KEY="alemsi-materiales-v0-1";
export function loadState(fallback:AppState):AppState{ if(typeof window==="undefined") return fallback; try{const raw=localStorage.getItem(KEY); return raw?{...fallback,...JSON.parse(raw)}:fallback}catch{return fallback} }
export function saveState(state:AppState){ if(typeof window!=="undefined") localStorage.setItem(KEY,JSON.stringify(state)); }
export function clearState(){ if(typeof window!=="undefined") localStorage.removeItem(KEY); }
