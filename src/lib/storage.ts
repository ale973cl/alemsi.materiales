import type { AppState } from "@/types";
/** @deprecated Compatibilidad. El estado operacional vive en Supabase. */
export function loadState(fallback:AppState):AppState{return fallback}
/** @deprecated No persiste datos; use mutaciones protegidas por RLS. */
export function saveState(_state:AppState){return}
/** @deprecated No existe estado local que limpiar. */
export function clearState(){return}
