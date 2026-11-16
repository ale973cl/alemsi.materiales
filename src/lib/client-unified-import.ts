/**
 * Planificación y ejecución de la importación única de cliente, contratos,
 * instalaciones y materiales contractuales.
 *
 * Este módulo no conoce Supabase: recibe la estructura existente y devuelve un
 * plan revisable. La ejecución real se hace con un ejecutor inyectado para
 * poder probar la reversión completa sin tocar la base de datos.
 */

export type UnifiedCsvRow = {
  row?: number;
  client_name?: string;
  client_rut?: string;
  client_email?: string;
  client_phone?: string;
  contract_name?: string;
  contract_code?: string;
  contract_budget?: string;
  contract_periodicity?: string;
  installation_name?: string;
  region?: string;
  commune?: string;
  city?: string;
  address?: string;
  delivery_contact?: string;
  delivery_email?: string;
  material_code?: string;
  material_name?: string;
  material_presentation?: string;
  quantity?: string;
  unit?: string;
  quantity_scope?: string;
};

export type ExistingInstallation = {
  id: string;
  name: string;
  region?: string | null;
  city?: string | null;
  commune?: string | null;
  address?: string | null;
  delivery_contact_name?: string | null;
  delivery_email?: string | null;
};

export type ExistingContract = {
  id: string;
  name: string;
  code?: string | null;
  net_budget?: number | string | null;
  installations?: ExistingInstallation[];
};

export type ExistingClient = {
  id: string;
  legal_name: string;
  rut?: string | null;
  central_email?: string | null;
  central_phone?: string | null;
  address?: string | null;
  contracts?: ExistingContract[];
};

export type ExistingMaterial = {
  id: string;
  name: string;
  presentation?: string | null;
  unit?: string | null;
  supplier_code?: string | null;
};

export type ExistingAssignment = {
  id: string;
  contract_id: string;
  material_id: string;
  installation_id?: string | null;
  authorized: boolean;
  authorized_qty?: number | string | null;
  notes?: string | null;
};

export type ExistingImportData = {
  clients: ExistingClient[];
  materials: ExistingMaterial[];
  assignments: ExistingAssignment[];
};

export type UnifiedClientOp = {
  key: string;
  rut: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isNew: boolean;
  id?: string;
  invalid?: boolean;
};

export type UnifiedContractOp = {
  key: string;
  clientKey: string;
  name: string;
  code: string | null;
  budget: number | null;
  periodicity: string | null;
  isNew: boolean;
  id?: string;
  invalid?: boolean;
};

export type UnifiedInstallationOp = {
  key: string;
  contractKey: string;
  name: string;
  region: string | null;
  city: string | null;
  commune: string | null;
  address: string | null;
  delivery_contact: string | null;
  delivery_email: string | null;
  patch: Record<string, string>;
  isNew: boolean;
  id?: string;
  invalid?: boolean;
};

export type UnifiedAssignmentOp = {
  key: string;
  contractKey: string;
  materialId: string;
  materialName: string;
  installationKey: string | null;
  scope: "contrato" | "instalacion";
  quantity: number | null;
  notes: string;
  isNew: boolean;
  id?: string;
  invalid?: boolean;
};

export type UnifiedDetail = {
  row: number;
  level: "Cliente" | "Contrato" | "Instalación" | "Material";
  item: string;
  status: "NUEVO" | "EXISTE" | "CONFLICTO" | "DUPLICADO";
  reason?: string;
};

export type UnifiedPlan = {
  summary: {
    rows: number;
    clientsNew: number;
    clientsExisting: number;
    contractsNew: number;
    contractsExisting: number;
    installationsNew: number;
    installationsExisting: number;
    assignmentsNew: number;
    assignmentsExisting: number;
    conflicts: number;
    duplicates: number;
    newTotal: number;
  };
  details: UnifiedDetail[];
  clients: UnifiedClientOp[];
  contracts: UnifiedContractOp[];
  installations: UnifiedInstallationOp[];
  assignments: UnifiedAssignmentOp[];
};

const text = (v: unknown) => String(v ?? "").trim();
const fold = (v: unknown) =>
  text(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/\s+/g, " ");
const loose = (v: unknown) =>
  fold(v)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const rutNorm = (v: unknown) => text(v).toUpperCase().replace(/[^0-9K]/g, "");
const control = /[\u0000-\u001F\u007F]/;

export function isValidRut(value: unknown) {
  const rut = rutNorm(value);
  if (rut.length < 2) return false;
  const body = rut.slice(0, -1);
  const dv = rut.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? "0" : mod === 10 ? "K" : String(mod);
  return dv === expected;
}

function parseQty(raw: unknown): { value: number | null; error?: string } {
  const source = text(raw);
  if (!source) return { value: null };
  const cleaned = source.replace(/\$/g, "").replace(/\s/g, "");
  let n: number;
  if (cleaned.includes(",")) n = Number(cleaned.replace(/\./g, "").replace(",", "."));
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) n = Number(cleaned.replace(/\./g, ""));
  else n = Number(cleaned);
  if (!Number.isFinite(n)) return { value: null, error: "La cantidad no es numérica" };
  if (n < 0) return { value: null, error: "La cantidad no puede ser negativa" };
  return { value: n };
}

function parseBudget(raw: unknown): { value: number | null; error?: string } {
  const source = text(raw);
  if (!source) return { value: null };
  const cleaned = source.replace(/\$/g, "").replace(/\s/g, "");
  const n = cleaned.includes(",")
    ? Number(cleaned.replace(/\./g, "").replace(",", "."))
    : Number(cleaned);
  if (!Number.isFinite(n)) return { value: null, error: "El presupuesto no es numérico" };
  if (n < 0) return { value: null, error: "El presupuesto no puede ser negativo" };
  return { value: n };
}

const same = (a: unknown, b: unknown) => fold(a) === fold(b);
const differs = (a: unknown, b: unknown) => Boolean(text(a)) && Boolean(text(b)) && !same(a, b);

const FIELD_LABELS: Record<string, string> = {
  region: "región",
  city: "ciudad",
  commune: "comuna",
  address: "dirección",
  delivery_contact_name: "contacto de entrega",
  delivery_email: "correo de entrega",
};

export function buildUnifiedPlan(rows: UnifiedCsvRow[], existing: ExistingImportData): UnifiedPlan {
  if (!Array.isArray(rows) || !rows.length) throw new Error("El CSV no contiene filas");
  if (rows.length > 2000) throw new Error("El CSV supera el máximo de 2.000 filas");

  const details: UnifiedDetail[] = [];
  const detailSeen = new Set<string>();
  const clientIndex = new Map<string, UnifiedClientOp>();
  const contractIndex = new Map<string, UnifiedContractOp>();
  const installationIndex = new Map<string, UnifiedInstallationOp>();
  const assignmentIndex = new Map<string, UnifiedAssignmentOp>();
  const existingAssignmentIds = new Set<string>();
  let existingAssignments = 0;

  const clientsByRut = new Map<string, ExistingClient>();
  for (const client of existing.clients || []) {
    const key = rutNorm(client.rut);
    if (key && !clientsByRut.has(key)) clientsByRut.set(key, client);
  }
  const materials = existing.materials || [];
  const assignments = existing.assignments || [];

  const detail = (row: number, level: UnifiedDetail["level"], item: string, status: UnifiedDetail["status"], reason?: string) => {
    const key = [level, item, status, reason || ""].join("|");
    if (detailSeen.has(key)) return;
    detailSeen.add(key);
    details.push({ row, level, item, status, ...(reason ? { reason } : {}) });
  };

  for (const [index, raw] of rows.entries()) {
    const rowNumber = Number(raw.row) || index + 2;
    const blocked = new Set<"client" | "contract" | "installation" | "material">();

    const clientName = text(raw.client_name);
    const clientRut = rutNorm(raw.client_rut);

    if (!clientName || !clientRut) {
      detail(rowNumber, "Cliente", clientName || "Sin nombre", "CONFLICTO", "El nombre y el RUT del cliente son obligatorios");
      blocked.add("client");
    }
    if (control.test(clientName) || clientName.length > 200) {
      detail(rowNumber, "Cliente", clientName || "Sin nombre", "CONFLICTO", "Nombre de cliente inválido o demasiado largo");
      blocked.add("client");
    }

    let existingClient = clientsByRut.get(clientRut);
    if (!blocked.has("client") && !existingClient && !isValidRut(raw.client_rut)) {
      detail(rowNumber, "Cliente", clientName, "CONFLICTO", "RUT inválido; corrige el dígito verificador antes de importar");
      blocked.add("client");
    }

    const clientKey = "rut:" + clientRut;
    if (!blocked.has("client")) {
      let clientOp = clientIndex.get(clientKey);
      if (!clientOp) {
        clientOp = {
          key: clientKey,
          rut: clientRut,
          name: clientName,
          email: text(raw.client_email) || null,
          phone: text(raw.client_phone) || null,
          address: null,
          isNew: !existingClient,
          id: existingClient?.id,
        };
        clientIndex.set(clientKey, clientOp);
        detail(rowNumber, "Cliente", clientName, clientOp.isNew ? "NUEVO" : "EXISTE", clientOp.isNew ? `RUT ${text(raw.client_rut)}` : "Se conserva el cliente existente identificado por RUT");
      } else if (!same(clientOp.name, clientName)) {
        clientOp.invalid = true;
        detail(rowNumber, "Cliente", clientName, "CONFLICTO", `El mismo RUT aparece con dos nombres: "${clientOp.name}" y "${clientName}"`);
        blocked.add("client");
      }
      if (existingClient && !same(existingClient.legal_name, clientName)) {
        detail(rowNumber, "Cliente", existingClient.legal_name, "EXISTE", `RUT ya registrado; se conserva el nombre existente y no se sobrescribe con "${clientName}"`);
      }
      if (clientOp.invalid) blocked.add("client");
    }

    if (blocked.has("client")) continue;

    const contractName = text(raw.contract_name);
    if (!contractName) {
      detail(rowNumber, "Contrato", "Sin contrato", "CONFLICTO", "El nombre del contrato es obligatorio");
      blocked.add("contract");
    }
    const contractCode = text(raw.contract_code) || null;
    if (contractCode && (control.test(contractCode) || contractCode.length > 80)) {
      detail(rowNumber, "Contrato", contractName || contractCode, "CONFLICTO", "Código de contrato inválido o demasiado largo");
      blocked.add("contract");
    }
    const budgetResult = parseBudget(raw.contract_budget);
    if (budgetResult.error) {
      detail(rowNumber, "Contrato", contractName, "CONFLICTO", budgetResult.error);
      blocked.add("contract");
    }

    let contractOp: UnifiedContractOp | undefined;
    if (!blocked.has("contract")) {
      const contracts = existingClient?.contracts || [];
      const codeMatch = contractCode ? contracts.find((c) => c.code && same(c.code, contractCode)) : undefined;
      const nameMatches = contracts.filter((c) => same(c.name, contractName));
      let matched: ExistingContract | undefined = codeMatch;
      let preserveName = false;
      let codeNotStored = false;
      if (!matched) {
        if (nameMatches.length === 1) {
          const candidate = nameMatches[0];
          if (contractCode && text(candidate.code) && !same(candidate.code, contractCode)) {
            matched = undefined; // Homónimo con otro código: es un contrato distinto.
          } else {
            matched = candidate;
            codeNotStored = Boolean(contractCode && !text(candidate.code));
          }
        } else if (nameMatches.length > 1) {
          detail(rowNumber, "Contrato", contractName, "CONFLICTO", "Existen varios contratos con el mismo nombre en el cliente; informa contrato_codigo");
          blocked.add("contract");
        }
      }
      if (codeMatch && !same(codeMatch.name, contractName)) preserveName = true;

      if (!blocked.has("contract")) {
        const key = matched
          ? "id:" + matched.id
          : "new:" + clientKey + ":" + (contractCode ? "code:" + fold(contractCode) : "name:" + loose(contractName));
        contractOp = contractIndex.get(key);
        if (!contractOp) {
          contractOp = {
            key,
            clientKey,
            name: contractName,
            code: contractCode,
            budget: budgetResult.value,
            periodicity: text(raw.contract_periodicity) || null,
            isNew: !matched,
            id: matched?.id,
          };
          contractIndex.set(key, contractOp);
          if (matched) {
            const notes = [
              preserveName ? `Se conserva el nombre existente "${matched.name}"` : "",
              codeNotStored ? "El contrato existente no tiene código guardado; no se sobrescribe" : "",
            ].filter(Boolean).join(". ");
            detail(rowNumber, "Contrato", matched.name, "EXISTE", notes || "Se conserva el contrato existente");
          } else {
            detail(rowNumber, "Contrato", contractName, "NUEVO", contractCode ? `Código ${contractCode}` : undefined);
          }
        } else {
          if (!same(contractOp.name, contractName)) {
            contractOp.invalid = true;
            detail(rowNumber, "Contrato", contractName, "CONFLICTO", `El mismo código de contrato aparece con dos nombres: "${contractOp.name}" y "${contractName}"`);
            blocked.add("contract");
          }
          if (contractOp.isNew && budgetResult.value != null && contractOp.budget != null && contractOp.budget !== budgetResult.value) {
            contractOp.invalid = true;
            detail(rowNumber, "Contrato", contractName, "CONFLICTO", "El mismo contrato nuevo aparece con dos presupuestos distintos");
            blocked.add("contract");
          }
        }
      }
    }

    if (blocked.has("contract") || !contractOp) continue;
    if (contractOp.invalid) continue;

    const installationName = text(raw.installation_name);
    let installationOp: UnifiedInstallationOp | undefined;
    if (installationName) {
      if (control.test(installationName) || installationName.length > 200) {
        detail(rowNumber, "Instalación", installationName, "CONFLICTO", "Nombre de instalación inválido o demasiado largo");
        blocked.add("installation");
      }
      const key = contractOp.key + "|inst:" + loose(installationName);
      installationOp = installationIndex.get(key);
      if (!blocked.has("installation")) {
        if (!installationOp) {
          const existingContract = existingClient?.contracts?.find((c) => c.id === contractOp!.id);
          const inContract = existingContract?.installations || [];
          const matches = inContract.filter((i) => same(i.name, installationName));
          if (matches.length > 1) {
            detail(rowNumber, "Instalación", installationName, "CONFLICTO", "La instalación aparece duplicada en el contrato; revisa el maestro antes de importar");
            blocked.add("installation");
          } else {
            const current = matches[0];
            const incoming: Record<string, string> = {
              region: text(raw.region),
              city: text(raw.city),
              commune: text(raw.commune),
              address: text(raw.address),
              delivery_contact_name: text(raw.delivery_contact),
              delivery_email: text(raw.delivery_email),
            };
            if (current) {
              for (const [field, label] of Object.entries(FIELD_LABELS)) {
                if (differs(incoming[field], (current as any)[field])) {
                  detail(rowNumber, "Instalación", current.name, "CONFLICTO", `La ${label} del CSV no coincide con la existente; no se sobrescribe (CSV: ${incoming[field]})`);
                }
              }
              installationOp = {
                key,
                contractKey: contractOp.key,
                name: current.name,
                region: incoming.region || null,
                city: incoming.city || null,
                commune: incoming.commune || null,
                address: incoming.address || null,
                delivery_contact: incoming.delivery_contact_name || null,
                delivery_email: incoming.delivery_email || null,
                patch: {},
                isNew: false,
                id: current.id,
              };
              installationIndex.set(key, installationOp);
              detail(rowNumber, "Instalación", current.name, "EXISTE", "Se conserva la instalación existente sin sobrescribir sus datos");
            } else {
              installationOp = {
                key,
                contractKey: contractOp.key,
                name: installationName,
                region: incoming.region || null,
                city: incoming.city || null,
                commune: incoming.commune || null,
                address: incoming.address || null,
                delivery_contact: incoming.delivery_contact_name || null,
                delivery_email: incoming.delivery_email || null,
                patch: {},
                isNew: true,
              };
              installationIndex.set(key, installationOp);
              detail(rowNumber, "Instalación", installationName, "NUEVO", incoming.commune || incoming.city || incoming.region || undefined);
            }
          }
        } else {
          const compare: Array<[string, string | null]> = [
            ["region", installationOp.region],
            ["city", installationOp.city],
            ["commune", installationOp.commune],
            ["address", installationOp.address],
            ["delivery_contact_name", installationOp.delivery_contact],
            ["delivery_email", installationOp.delivery_email],
          ];
          const incoming: Record<string, string> = {
            region: text(raw.region),
            city: text(raw.city),
            commune: text(raw.commune),
            address: text(raw.address),
            delivery_contact_name: text(raw.delivery_contact),
            delivery_email: text(raw.delivery_email),
          };
          for (const [field] of compare) {
            if (differs(incoming[field], (installationOp as any)[field])) {
              installationOp.invalid = true;
              detail(rowNumber, "Instalación", installationName, "CONFLICTO", `La misma instalación aparece con ${FIELD_LABELS[field]} distinta dentro del CSV`);
            }
          }
        }
      }
      if (installationOp?.invalid) blocked.add("installation");
    }

    if (blocked.has("installation")) continue;

    const materialName = text(raw.material_name);
    const materialCode = text(raw.material_code);
    const materialPresentation = text(raw.material_presentation);
    if (!materialName && !materialCode) continue;

    let material: ExistingMaterial | undefined;
    const codeMatches = materialCode ? materials.filter((m) => m.supplier_code && same(m.supplier_code, materialCode)) : [];
    let nameMatches = materialName ? materials.filter((m) => same(m.name, materialName)) : [];
    if (nameMatches.length > 1 && materialPresentation) {
      const narrowed = nameMatches.filter((m) => same(m.presentation, materialPresentation));
      if (narrowed.length) nameMatches = narrowed;
    }
    if (codeMatches.length > 1) {
      detail(rowNumber, "Material", materialName || materialCode, "CONFLICTO", "El código de material coincide con más de un registro del maestro");
      blocked.add("material");
    } else if (codeMatches.length === 1) {
      material = codeMatches[0];
      if (nameMatches.length && !nameMatches.some((m) => m.id === material!.id)) {
        detail(rowNumber, "Material", materialName || materialCode, "CONFLICTO", `El código apunta a "${material.name}" pero el nombre del CSV apunta a "${nameMatches[0].name}"`);
        blocked.add("material");
      } else if (materialName && !same(material.name, materialName)) {
        detail(rowNumber, "Material", material.name, "CONFLICTO", `El código existe, pero el nombre del CSV ("${materialName}") difiere del maestro`);
        blocked.add("material");
      }
    } else if (nameMatches.length === 1) {
      material = nameMatches[0];
      if (materialCode) {
        detail(rowNumber, "Material", material.name, "CONFLICTO", `El código "${materialCode}" no existe en el maestro; el nombre coincide con un material. Corrige el código o retíralo`);
        blocked.add("material");
      }
    } else if (nameMatches.length > 1) {
      detail(rowNumber, "Material", materialName || materialCode, "CONFLICTO", "El nombre del material coincide con varios registros; agrega material_presentacion o el código del maestro");
      blocked.add("material");
    } else {
      detail(rowNumber, "Material", materialName || materialCode || "Sin material", "CONFLICTO", "El material no existe en el maestro. Créalo o corrige código/nombre; la importación no inventa materiales");
      blocked.add("material");
    }

    if (blocked.has("material") || !material) continue;

    const scopeRaw = fold(raw.quantity_scope);
    let scope: "contrato" | "instalacion";
    if (scopeRaw === "contrato") scope = "contrato";
    else if (scopeRaw === "instalacion" || scopeRaw === "") scope = installationOp ? "instalacion" : "contrato";
    else {
      detail(rowNumber, "Material", material.name, "CONFLICTO", `alcance_cantidad debe ser "contrato" o "instalacion" (recibido: "${text(raw.quantity_scope)}")`);
      blocked.add("material");
      continue;
    }
    if (scope === "instalacion" && !installationOp) {
      detail(rowNumber, "Material", material.name, "CONFLICTO", "Una cantidad por instalación requiere instalacion_nombre");
      blocked.add("material");
      continue;
    }

    const qtyResult = parseQty(raw.quantity);
    if (qtyResult.error) {
      detail(rowNumber, "Material", material.name, "CONFLICTO", qtyResult.error);
      blocked.add("material");
      continue;
    }
    const quantity = qtyResult.value;
    const materialLabel = material.name + " · " + (scope === "instalacion" ? installationOp!.name : "contrato");

    const key = contractOp.key + "|mat:" + material.id + "|" + (scope === "instalacion" ? installationOp!.key : "contrato");
    const existingAssignment = contractOp.id
      ? assignments.find(
          (a) =>
            a.contract_id === contractOp!.id &&
            a.material_id === material!.id &&
            (scope === "instalacion" ? a.installation_id === installationOp!.id : !a.installation_id)
        )
      : undefined;

    if (existingAssignment) {
      let reason = "La asignación ya existe y se conserva";
      let conflict = false;
      if (!existingAssignment.authorized) {
        reason = "Existe una exclusión configurada para este material; no se reautoriza automáticamente";
        conflict = true;
      } else if (scope === "contrato") {
        reason = quantity != null
          ? `La autorización contractual ya existe; la cantidad documentada (${quantity}) no se distribuye ni se sobrescribe`
          : "La autorización contractual ya existe y se conserva";
      } else if (quantity != null) {
        const configured = Number(existingAssignment.authorized_qty || 0);
        if (configured !== quantity) {
          reason = `Cantidad máxima ya configurada (${configured}); no se modifica automáticamente a ${quantity}`;
          conflict = true;
        }
      }
      if (!conflict && !existingAssignmentIds.has(existingAssignment.id)) {
        existingAssignmentIds.add(existingAssignment.id);
        existingAssignments++;
      }
      detail(rowNumber, "Material", materialLabel, conflict ? "CONFLICTO" : "EXISTE", reason);
      continue;
    }

    const unit = text(raw.unit) || material.unit || "";
    const notes =
      scope === "contrato"
        ? quantity != null
          ? `Cantidad contractual documentada: ${quantity}${unit ? " " + unit : ""}; no distribuida por instalación. Importación CSV.`
          : "Material autorizado a nivel contractual. Importación CSV."
        : quantity != null
          ? `Máximo por instalación documentado en CSV${unit ? " (" + unit + ")" : ""}.`
          : "Material autorizado sin cantidad máxima documentada. Importación CSV.";

    const previous = assignmentIndex.get(key);
    if (previous) {
      if (previous.scope !== scope || previous.quantity !== quantity) {
        previous.invalid = true;
        detail(rowNumber, "Material", materialLabel, "CONFLICTO", "El mismo material aparece repetido con cantidades o alcances distintos");
      } else {
        detail(rowNumber, "Material", materialLabel, "DUPLICADO", "Fila repetida dentro del CSV; se procesará una sola vez");
      }
      continue;
    }

    const assignmentOp: UnifiedAssignmentOp = {
      key,
      contractKey: contractOp.key,
      materialId: material.id,
      materialName: material.name,
      installationKey: scope === "instalacion" ? installationOp!.key : null,
      scope,
      quantity,
      notes,
      isNew: true,
    };
    assignmentIndex.set(key, assignmentOp);
    detail(
      rowNumber,
      "Material",
      materialLabel,
      "NUEVO",
      scope === "contrato" ? "Autorización contractual; cantidad no distribuida" : quantity != null ? `Máximo por instalación: ${quantity}${unit ? " " + unit : ""}` : "Autorizado sin cantidad máxima"
    );
  }

  const clients = [...clientIndex.values()];
  const contracts = [...contractIndex.values()];
  const installations = [...installationIndex.values()];
  const assignmentsToCreate = [...assignmentIndex.values()];

  const validClients = clients.filter((c) => !c.invalid);
  const validClientKeys = new Set(validClients.map((c) => c.key));
  const validContracts = contracts.filter((c) => !c.invalid && validClientKeys.has(c.clientKey));
  const validContractKeys = new Set(validContracts.map((c) => c.key));
  const validInstallations = installations.filter((i) => !i.invalid && validContractKeys.has(i.contractKey));
  const validInstallationKeys = new Set(validInstallations.map((i) => i.key));
  const validAssignments = assignmentsToCreate.filter(
    (a) => !a.invalid && validContractKeys.has(a.contractKey) && (!a.installationKey || validInstallationKeys.has(a.installationKey))
  );

  const conflicts = details.filter((d) => d.status === "CONFLICTO").length;
  const duplicates = details.filter((d) => d.status === "DUPLICADO").length;
  const clientsNew = validClients.filter((c) => c.isNew).length;
  const contractsNew = validContracts.filter((c) => c.isNew).length;
  const installationsNew = validInstallations.filter((i) => i.isNew).length;
  const assignmentsNew = validAssignments.length;

  return {
    summary: {
      rows: rows.length,
      clientsNew,
      clientsExisting: validClients.length - clientsNew,
      contractsNew,
      contractsExisting: validContracts.length - contractsNew,
      installationsNew,
      installationsExisting: validInstallations.length - installationsNew,
      assignmentsNew,
      assignmentsExisting: existingAssignments,
      conflicts,
      duplicates,
      newTotal: clientsNew + contractsNew + installationsNew + assignmentsNew,
    },
    details,
    clients: validClients,
    contracts: validContracts,
    installations: validInstallations,
    assignments: validAssignments,
  };
}

export type UnifiedImportExecutor = {
  createClient(op: UnifiedClientOp): Promise<string>;
  createContract(op: UnifiedContractOp, clientId: string): Promise<string>;
  createInstallation(op: UnifiedInstallationOp, contractId: string): Promise<string>;
  createAssignment(op: UnifiedAssignmentOp, contractId: string, installationId: string | null): Promise<string>;
  remove(table: "clients" | "contracts" | "installations" | "contract_materials", id: string): Promise<void>;
};

export type UnifiedCommitResult = {
  clients: number;
  contracts: number;
  installations: number;
  assignments: number;
};

/**
 * Ejecuta el plan en orden y revierte todo lo creado si una operación falla.
 * La reversión solo elimina identificadores creados en esta ejecución.
 */
export async function runUnifiedCommit(plan: UnifiedPlan, executor: UnifiedImportExecutor): Promise<UnifiedCommitResult> {
  const created: Array<{ table: "clients" | "contracts" | "installations" | "contract_materials"; id: string }> = [];
  const clientIds = new Map<string, string>();
  const contractIds = new Map<string, string>();
  const installationIds = new Map<string, string>();
  const result: UnifiedCommitResult = { clients: 0, contracts: 0, installations: 0, assignments: 0 };

  for (const client of plan.clients) if (!client.isNew && client.id) clientIds.set(client.key, client.id);
  for (const contract of plan.contracts) if (!contract.isNew && contract.id) contractIds.set(contract.key, contract.id);
  for (const installation of plan.installations) if (!installation.isNew && installation.id) installationIds.set(installation.key, installation.id);

  try {
    for (const client of plan.clients.filter((c) => c.isNew)) {
      const id = await executor.createClient(client);
      clientIds.set(client.key, id);
      created.push({ table: "clients", id });
      result.clients++;
    }

    for (const contract of plan.contracts.filter((c) => c.isNew)) {
      const clientId = clientIds.get(contract.clientKey);
      if (!clientId) throw new Error(`No se encontró el cliente para el contrato ${contract.name}`);
      const id = await executor.createContract(contract, clientId);
      contractIds.set(contract.key, id);
      created.push({ table: "contracts", id });
      result.contracts++;
    }

    for (const installation of plan.installations.filter((i) => i.isNew)) {
      const contractId = contractIds.get(installation.contractKey);
      if (!contractId) throw new Error(`No se encontró el contrato para la instalación ${installation.name}`);
      const id = await executor.createInstallation(installation, contractId);
      installationIds.set(installation.key, id);
      created.push({ table: "installations", id });
      result.installations++;
    }

    for (const assignment of plan.assignments) {
      const contractId = contractIds.get(assignment.contractKey);
      if (!contractId) throw new Error(`No se encontró el contrato para el material ${assignment.materialName}`);
      const installationId = assignment.installationKey ? installationIds.get(assignment.installationKey) : null;
      if (assignment.installationKey && !installationId) throw new Error(`No se encontró la instalación para el material ${assignment.materialName}`);
      const id = await executor.createAssignment(assignment, contractId, installationId || null);
      created.push({ table: "contract_materials", id });
      result.assignments++;
    }
  } catch (error: any) {
    const rollbackErrors: string[] = [];
    for (const item of [...created].reverse()) {
      try {
        await executor.remove(item.table, item.id);
      } catch (rollbackError: any) {
        rollbackErrors.push(`${item.table}/${item.id}: ${rollbackError?.message || "error desconocido"}`);
      }
    }
    const base = error?.message || "Error desconocido durante la importación";
    const message = rollbackErrors.length
      ? `La importación falló (${base}). No se pudo revertir todo: ${rollbackErrors.join(" · ")}`
      : `La importación falló y se revirtieron todos los registros creados: ${base}`;
    const failure = new Error(message) as Error & { rolledBack: boolean; rollbackErrors: string[] };
    failure.rolledBack = rollbackErrors.length === 0;
    failure.rollbackErrors = rollbackErrors;
    throw failure;
  }

  return result;
}
