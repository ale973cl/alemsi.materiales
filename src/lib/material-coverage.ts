/**
 * Motor conservador de cobertura documental para materiales ALEMSI.
 * No crea productos, no guarda asignaciones ni considera una sugerencia como homologación.
 */
export type MaterialMaestro = {
  id: string;
  name: string;
  supplier_code?: string | null;
  presentation?: string | null;
  functions?: string[];
  surfaces?: string[];
};
export type MaterialRequerido = {
  requested: string;
  function?: string;
  surface?: string;
  source?: string;
};
export type CoberturaMaterial = {
  requested: string;
  source?: string;
  status: "COINCIDENCIA" | "REVISION" | "NO_ATENDIDO";
  materialId: string | null;
  materialName: string | null;
  reason: string;
};
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const contains = (items: string[] | undefined, value: string) => !!items?.some(x => norm(x) === norm(value));
/** No presupone que una marca sea un tipo de producto. */
export function evaluarCobertura(requeridos: MaterialRequerido[], maestro: MaterialMaestro[]): CoberturaMaterial[] {
  return requeridos.map(req => {
    const exact = maestro.filter(m => norm(m.name) === norm(req.requested) || (!!m.supplier_code && norm(m.supplier_code) === norm(req.requested)));
    const validExact = exact.filter(m => (!req.function || contains(m.functions, req.function)) && (!req.surface || contains(m.surfaces, req.surface)));
    if (validExact.length === 1) return {
      requested: req.requested, source: req.source, status: "COINCIDENCIA" as const,
      materialId: validExact[0].id, materialName: validExact[0].name,
      reason: "Coincidencia única de nombre o código y compatibilidad funcional documentada cuando fue exigida; requiere confirmación contractual antes de guardar."
    };
    if (exact.length) return {
      requested: req.requested, source: req.source, status: "REVISION" as const,
      materialId: null, materialName: null,
      reason: "Nombre/código encontrado, pero hay ambigüedad o falta respaldo de función/superficie."
    };
    const requiredFunction = req.function;
    const requiredSurface = req.surface;
    const functional = requiredFunction ? maestro.filter(m => contains(m.functions, requiredFunction) && (!requiredSurface || contains(m.surfaces, requiredSurface))) : [];
    return {
      requested: req.requested, source: req.source,
      status: functional.length ? "REVISION" as const : "NO_ATENDIDO" as const,
      materialId: null, materialName: null,
      reason: functional.length
        ? "Alternativas funcionales para revisión: " + functional.map(m => m.name).join(", ") + ". No se preseleccionan."
        : "No existe coincidencia documentada en el maestro; selección vacía."
    };
  });
}
