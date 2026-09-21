export const ADDITIONAL_SERVICE_CODES = ["rendiciones","flota","cotizaciones"] as const;
export type AdditionalServiceCode = typeof ADDITIONAL_SERVICE_CODES[number];
export type AdditionalServiceStatus = "INACTIVO" | "DEMO" | "ACTIVO";
export type AdditionalServiceAccessMode = "AUTHORIZED" | "ALL_AUTHENTICATED";

export type AdditionalService = {
  service_code: AdditionalServiceCode;
  display_name: string;
  status: AdditionalServiceStatus;
  access_mode: AdditionalServiceAccessMode;
  public_entry_enabled: boolean;
};

export function serviceIsVisible(service: AdditionalService | undefined | null): boolean {
  return Boolean(service && service.status !== "INACTIVO");
}

export function canShowRendicionesAdmin(role: string | null | undefined): boolean {
  return role === "Finanzas" || role === "Gerencia";
}
