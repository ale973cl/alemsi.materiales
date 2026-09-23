"use client";
import { useMemo, useState } from "react";
import { closeCampaign } from "@/app/actions";
import { createRegionalCampaign } from "@/app/campaign-create-actions";
import {
  forceCloseCampaign,
  justifyCampaignInstallation,
} from "@/app/campaign-actions";
import { deleteCampaignSafe } from "@/app/delete-campaign-action";
import type { ClientInstallationGroup } from "@/components/modules/ClientInstallationsModule";
import SurveyLinkControl from "@/components/modules/SurveyLinkControl";
type CampaignInstallation = {
  id?: string;
  installation_id?: string;
  status: string;
  justification?: string | null;
  installations?: {
    id?: string;
    name?: string | null;
    region?: string | null;
    city?: string | null;
    commune?: string | null;
    contracts?: {
      name?: string | null;
      clients?: { legal_name?: string | null } | null;
    } | null;
  } | null;
};
type CampaignRow = {
  id: string;
  label: string;
  status: string;
  created_at: string;
  contracts?: {
    name?: string | null;
    clients?: { legal_name?: string | null } | null;
  } | null;
  campaign_installations?: CampaignInstallation[];
};
type FlatInstallation = {
  region: string;
  city: string;
  commune: string;
  clientId: string;
  client: string;
  contractId: string;
  contract: string;
  installation: any;
};
type ViewFilter = "all" | "pending" | "progress" | "done";
const campaignInfo = (label: string) => {
  try {
    const value = JSON.parse(label);
    return typeof value?.name === "string"
      ? value
      : { name: label, periodicity: "No indicada", clientCount: null };
  } catch {
    return { name: label, periodicity: "No indicada", clientCount: null };
  }
};
const clean = (value?: string | null) => String(value || "").trim();
const normalizeText = (value?: string | null) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[’'`´\"“”._/\\-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const labelScore = (value: string) =>
  (/[áéíóúüñ]/i.test(value) ? 4 : 0) +
  (value !== value.toUpperCase() ? 2 : 0) +
  (value.length ? 1 : 0);
const canonicalOptions = (values: string[]) =>
  [
    ...values
      .reduce((map, value) => {
        const key = normalizeText(value);
        if (!key) return map;
        const current = map.get(key);
        if (!current || labelScore(value) > labelScore(current))
          map.set(key, value);
        return map;
      }, new Map<string, string>())
      .values(),
  ].sort((a, b) => a.localeCompare(b, "es"));
const regionName = (value?: string | null) => clean(value) || "Sin región";
const statusKey = (value?: string | null) => {
  const s = clean(value).toLocaleLowerCase("es-CL");
  if (s.includes("complet") || s.includes("tomad")) return "done";
  if (s.includes("justific")) return "justified";
  if (s.includes("proceso") || s.includes("inici")) return "progress";
  return "pending";
};
const statusLabel = (value?: string | null) =>
  statusKey(value) === "done"
    ? "Toma completada"
    : statusKey(value) === "progress"
      ? "Toma en proceso"
      : statusKey(value) === "justified"
        ? "Justificada"
        : "Pendiente de toma";
export default function CampaignsModule({
  campaigns,
  clients,
  onOpenSurveys,
}: {
  campaigns: CampaignRow[];
  clients: ClientInstallationGroup[];
  onOpenSurveys?: (campaignId: string, installationId?: string) => void;
}) {
  const [showNew, setShowNew] = useState(false),
    [selectedInstallationIds, setSelectedInstallationIds] = useState<string[]>(
      [],
    ),
    [adminCampaign, setAdminCampaign] = useState<string | null>(null),
    [openCampaign, setOpenCampaign] = useState<string | null>(null),
    [viewFilter, setViewFilter] = useState<ViewFilter>("all"),
    [campaignMessage, setCampaignMessage] = useState(""),
    [deletingCampaign, setDeletingCampaign] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState(""),
    [cityFilter, setCityFilter] = useState(""),
    [clientFilter, setClientFilter] = useState(""),
    [contractFilter, setContractFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState("available"),
    [search, setSearch] = useState("");
  const occupied = useMemo(() => {
    const m = new Map<string, { campaign: string; status: string }>();
    for (const c of campaigns.filter((x) => x.status === "Abierta")) {
      for (const item of c.campaign_installations || []) {
        const id = item.installation_id || item.installations?.id;
        if (id)
          m.set(id, {
            campaign: campaignInfo(c.label).name,
            status: item.status,
          });
      }
    }
    return m;
  }, [campaigns]);
  const flat = useMemo<FlatInstallation[]>(
    () =>
      clients.flatMap((client) =>
        (client.contracts || []).flatMap((contract) =>
          (contract.installations || []).map((installation) => ({
            region: regionName(installation.region),
            city:
              clean(installation.city) ||
              clean(installation.commune) ||
              "Sin ciudad",
            commune:
              clean(installation.commune) ||
              clean(installation.city) ||
              "Sin comuna",
            clientId: client.id,
            client: client.legal_name,
            contractId: contract.id,
            contract: contract.name,
            installation,
          })),
        ),
      ),
    [clients],
  );
  const regions = useMemo(
    () => canonicalOptions(flat.map((x) => x.region)),
    [flat],
  );
  const cities = useMemo(
    () =>
      canonicalOptions(
        flat
          .filter(
            (x) =>
              !regionFilter ||
              normalizeText(x.region) === normalizeText(regionFilter),
          )
          .map((x) => x.city),
      ),
    [flat, regionFilter],
  );
  const clientOptions = useMemo(
    () =>
      [
        ...new Map(
          flat
            .filter(
              (x) =>
                (!regionFilter ||
                  normalizeText(x.region) === normalizeText(regionFilter)) &&
                (!cityFilter ||
                  normalizeText(x.city) === normalizeText(cityFilter)),
            )
            .map((x) => [x.clientId, x.client]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "es")),
    [flat, regionFilter, cityFilter],
  );
  const contractOptions = useMemo(
    () =>
      [
        ...new Map(
          flat
            .filter(
              (x) =>
                (!regionFilter ||
                  normalizeText(x.region) === normalizeText(regionFilter)) &&
                (!cityFilter ||
                  normalizeText(x.city) === normalizeText(cityFilter)) &&
                (!clientFilter || x.clientId === clientFilter),
            )
            .map((x) => [x.contractId, x.contract]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "es")),
    [flat, regionFilter, cityFilter, clientFilter],
  );
  const visible = useMemo(
    () =>
      flat.filter((x) => {
        const busy = occupied.get(x.installation.id),
          key = busy ? statusKey(busy.status) : "available",
          text = normalizeText(
            [
              x.installation.name,
              x.region,
              x.city,
              x.commune,
              x.client,
              x.contract,
            ].join(" "),
          );
        if (
          regionFilter &&
          normalizeText(x.region) !== normalizeText(regionFilter)
        )
          return false;
        if (cityFilter && normalizeText(x.city) !== normalizeText(cityFilter))
          return false;
        if (clientFilter && x.clientId !== clientFilter) return false;
        if (contractFilter && x.contractId !== contractFilter) return false;
        if (search && !text.includes(normalizeText(search))) return false;
        if (statusFilter === "available" && busy) return false;
        if (statusFilter === "occupied" && !busy) return false;
        if (statusFilter === "progress" && (!busy || key !== "progress"))
          return false;
        if (statusFilter === "done" && (!busy || key !== "done")) return false;
        return true;
      }),
    [
      flat,
      occupied,
      regionFilter,
      cityFilter,
      clientFilter,
      contractFilter,
      statusFilter,
      search,
    ],
  );
  const visibleGroups = useMemo(() => {
    const map = new Map<
      string,
      Map<
        string,
        {
          id: string;
          legal_name: string;
          contracts: Map<
            string,
            { id: string; name: string; installations: any[] }
          >;
        }
      >
    >();
    for (const row of visible) {
      if (!map.has(row.region)) map.set(row.region, new Map());
      const cm = map.get(row.region)!;
      if (!cm.has(row.clientId))
        cm.set(row.clientId, {
          id: row.clientId,
          legal_name: row.client,
          contracts: new Map(),
        });
      const c = cm.get(row.clientId)!;
      if (!c.contracts.has(row.contractId))
        c.contracts.set(row.contractId, {
          id: row.contractId,
          name: row.contract,
          installations: [],
        });
      c.contracts.get(row.contractId)!.installations.push(row.installation);
    }
    return [...map.entries()].map(([region, cm]) => ({
      region,
      clients: [...cm.values()].map((c) => ({
        ...c,
        contracts: [...c.contracts.values()],
      })),
    }));
  }, [visible]);
  const selectedUniverse = useMemo(
    () =>
      flat.filter((x) => selectedInstallationIds.includes(x.installation.id)),
    [flat, selectedInstallationIds],
  );
  const selectedClientCount = new Set(selectedUniverse.map((x) => x.client))
      .size,
    selectedRegionCount = new Set(selectedUniverse.map((x) => x.region)).size;
  const visibleAvailableIds = visible
    .filter((x) => !occupied.has(x.installation.id))
    .map((x) => x.installation.id);
  const selectVisibleAvailable = () =>
    setSelectedInstallationIds((current) => [
      ...new Set([...current, ...visibleAvailableIds]),
    ]);
  const clearVisibleSelection = () =>
    setSelectedInstallationIds((current) =>
      current.filter((id) => !visibleAvailableIds.includes(id)),
    );
  const toggle = (id: string) => {
    if (occupied.has(id)) return;
    setSelectedInstallationIds((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : [...c, id],
    );
  };
  const toggleGroup = (ids: string[]) =>
    setSelectedInstallationIds((current) => {
      const available = ids.filter((id) => !occupied.has(id)),
        all =
          available.length > 0 && available.every((id) => current.includes(id));
      return all
        ? current.filter((id) => !available.includes(id))
        : [...new Set([...current, ...available])];
    });
  const resetFilters = () => {
    setRegionFilter("");
    setCityFilter("");
    setClientFilter("");
    setContractFilter("");
    setStatusFilter("available");
    setSearch("");
  };
  const openFiltered = (id: string, filter: ViewFilter) => {
    setOpenCampaign(id);
    setViewFilter(filter);
  };
  async function removeCampaign(id: string, name: string) {
    if (
      !window.confirm(
        `¿Eliminar definitivamente la campaña ${name}? Esta acción elimina sus levantamientos de prueba y no se puede deshacer.`,
      )
    )
      return;
    setDeletingCampaign(id);
    setCampaignMessage("Eliminando campaña...");
    const fd = new FormData();
    fd.set("campaign_id", id);
    fd.set("confirmation", "ELIMINAR");
    try {
      const r = await deleteCampaignSafe(fd);
      if (!r?.ok) {
        setCampaignMessage(r?.error || "No fue posible eliminar la campaña");
        return;
      }
      setCampaignMessage(r.message || "Campaña eliminada correctamente");
      window.location.reload();
    } catch (e: any) {
      setCampaignMessage(e?.message || "No fue posible eliminar la campaña");
    } finally {
      setDeletingCampaign(null);
    }
  }
  return (
    <section className="panel campaignModule">
      <style
        dangerouslySetInnerHTML={{
          __html: `.campaignLegend{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.campaignLegend span,.statePill{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800}.campaignLegend i{width:9px;height:9px;border-radius:50%;display:block}.st-available{background:#eef3f5;color:#516a78}.st-progress{background:#e5f1fb;color:#185c8d}.st-done{background:#e4f5f1;color:#07594f}.st-occupied{background:#fff3d9;color:#7a5410}.st-justified{background:#f0edf8;color:#5c4b83}.campaignFilters{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:10px;margin:14px 0}.campaignFilters label{display:grid;gap:5px;font-size:12px;font-weight:800;color:#173650}.campaignFilters select,.campaignFilters input{min-height:42px;border:1px solid #c8dce8;border-radius:12px;padding:0 12px;background:#fff;color:#173650}.campaignFilterActions{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.campaignFilterActions button{border-radius:999px}.campaignSelectionSummary{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:8px 0 14px;color:#173650}.campaignSelectionSummary b{font-size:14px}.campaignSelectionSummary span{font-size:12px}.campaignInstallationPicker{display:grid;gap:7px;margin:8px 0 12px;padding-left:26px}.campaignInstallationPicker label{display:flex;gap:9px;align-items:center;padding:8px 10px;border:1px solid #dbe7ec;border-radius:12px;background:#fff}.campaignInstallationPicker label.occupied{background:#f7f9fa;color:#6d7d86}.campaignInstallationPicker label.occupied input{cursor:not-allowed}.campaignInstallationPicker small{display:block;color:#607887}.surveyInstallationCard.state-done{border-left:5px solid #2a9d78}.surveyInstallationCard.state-progress{border-left:5px solid #3b82b8}.surveyInstallationCard.state-pending{border-left:5px solid #aab8bf}.surveyInstallationCard.state-justified{border-left:5px solid #8b78b5}.campaignCardHead em.status-open{background:#e5f1fb;color:#185c8d}.campaignCardHead em.status-closed{background:#e4f5f1;color:#07594f}.campaignMetrics button{border:0;text-align:left;cursor:pointer;font:inherit}.campaignMetrics button:hover{outline:2px solid #6ccfc9}.campaignMetrics button.active{outline:2px solid #159a9c}.campaignMetrics button:disabled{cursor:default;opacity:.6}@media(max-width:1000px){.campaignFilters{grid-template-columns:repeat(2,minmax(150px,1fr))}}@media(max-width:650px){.campaignFilters{grid-template-columns:1fr}.campaignInstallationPicker{padding-left:8px}.campaignLegend{gap:5px}}`,
        }}
      />
      <div className="catalogIntro">
        <div>
          <h2>Universo cerrado de levantamientos</h2>
          <p>
            Filtra por región, ciudad, cliente, contrato o estado. La selección
            final siempre se guarda por instalación.
          </p>
        </div>
        <button type="button" onClick={() => setShowNew((v) => !v)}>
          + Nueva campaña
        </button>
      </div>
      <div className="campaignLegend">
        <span className="st-available">
          <i />
          Disponible
        </span>
        <span className="st-progress">
          <i />
          Toma en proceso
        </span>
        <span className="st-done">
          <i />
          Toma completada
        </span>
        <span className="st-occupied">
          <i />
          Ya en campaña
        </span>
      </div>
      {campaignMessage && <p className="note">{campaignMessage}</p>}
      {showNew && (
        <form
          action={createRegionalCampaign}
          className="adminForm campaignForm"
        >
          <h3>Crear campaña por instalaciones</h3>
          <div className="campaignFields">
            <label>
              Nombre de campaña
              <input
                name="name"
                required
                placeholder="Ej.: Levantamiento Temuco"
              />
            </label>
            <label>
              Periodicidad
              <select name="periodicity" required defaultValue="Mensual">
                <option>Mensual</option>
                <option>Bimensual</option>
                <option>Trimestral</option>
                <option>Cuatrimestral</option>
                <option>Semestral</option>
                <option>Personalizada</option>
              </select>
            </label>
          </div>
          {selectedInstallationIds.map((id) => (
            <input key={id} type="hidden" name="installation_ids" value={id} />
          ))}
          <div className="campaignFilters">
            <label>
              Región
              <select
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setCityFilter("");
                  setClientFilter("");
                  setContractFilter("");
                }}
              >
                <option value="">Todas</option>
                {regions.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Ciudad
              <select
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setClientFilter("");
                  setContractFilter("");
                }}
              >
                <option value="">Todas</option>
                {cities.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Cliente
              <select
                value={clientFilter}
                onChange={(e) => {
                  setClientFilter(e.target.value);
                  setContractFilter("");
                }}
              >
                <option value="">Todos</option>
                {clientOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contrato / servicio
              <select
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {contractOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="available">Disponibles</option>
                <option value="occupied">En campaña activa</option>
                <option value="progress">Toma en proceso</option>
                <option value="done">Toma completada</option>
              </select>
            </label>
          </div>
          <div
            className="campaignFilters"
            style={{ gridTemplateColumns: "1fr" }}
          >
            <label>
              Buscar instalación
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, comuna, ciudad, cliente o contrato"
              />
            </label>
          </div>
          <div className="campaignFilterActions">
            <button
              type="button"
              className="btn primary"
              disabled={!visibleAvailableIds.length}
              onClick={selectVisibleAvailable}
            >
              Seleccionar disponibles ({visibleAvailableIds.length})
            </button>
            <button
              type="button"
              className="btn"
              disabled={
                !visibleAvailableIds.some((id) =>
                  selectedInstallationIds.includes(id),
                )
              }
              onClick={clearVisibleSelection}
            >
              Desmarcar visibles
            </button>
            <button type="button" className="btn" onClick={resetFilters}>
              Limpiar filtros
            </button>
          </div>
          <div className="campaignSelectionSummary">
            <b>{visible.length} instalaciones encontradas</b>
            <span>
              {visibleAvailableIds.length} disponibles ·{" "}
              {visible.length - visibleAvailableIds.length} bloqueadas ·{" "}
              {selectedInstallationIds.length} seleccionadas total
            </span>
          </div>
          <div className="campaignClientPicker">
            {visibleGroups.length ? (
              visibleGroups.map((g) => (
                <fieldset key={g.region} style={{ marginBottom: 14 }}>
                  <legend>{g.region}</legend>
                  {g.clients.map((c) => {
                    const ids = c.contracts.flatMap((k) =>
                        k.installations.map((i) => i.id),
                      ),
                      available = ids.filter((id) => !occupied.has(id)),
                      checked =
                        available.length > 0 &&
                        available.every((id) =>
                          selectedInstallationIds.includes(id),
                        );
                    return (
                      <div key={`${g.region}-${c.id}`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!available.length}
                            onChange={() => toggleGroup(ids)}
                          />
                          <span>
                            <b>{c.legal_name}</b>
                            <small>
                              {available.length} disponibles ·{" "}
                              {ids.length - available.length} bloqueadas ·{" "}
                              {ids.length} visibles
                            </small>
                          </span>
                        </label>
                        {c.contracts.map((k) => (
                          <div
                            key={k.id}
                            className="campaignInstallationPicker"
                          >
                            <b>{k.name}</b>
                            {k.installations.map((i) => {
                              const busy = occupied.get(i.id);
                              return (
                                <label
                                  key={i.id}
                                  className={busy ? "occupied" : ""}
                                  title={
                                    busy
                                      ? `${busy.campaign} · ${statusLabel(busy.status)}`
                                      : "Disponible para nueva campaña"
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedInstallationIds.includes(
                                      i.id,
                                    )}
                                    disabled={!!busy}
                                    onChange={() => toggle(i.id)}
                                  />
                                  <span>
                                    <b>{i.name}</b>
                                    <small>
                                      {[i.commune, i.city]
                                        .filter(Boolean)
                                        .join(" · ") || g.region}
                                    </small>
                                  </span>
                                  <span
                                    className={`statePill ${busy ? (statusKey(busy.status) === "done" ? "st-done" : statusKey(busy.status) === "progress" ? "st-progress" : "st-occupied") : "st-available"}`}
                                  >
                                    {busy
                                      ? `${statusLabel(busy.status)} · ${busy.campaign}`
                                      : "Disponible"}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </fieldset>
              ))
            ) : (
              <div className="empty">
                <b>Sin instalaciones para estos filtros</b>
                <span>Cambia uno o más filtros para ampliar el universo.</span>
              </div>
            )}
          </div>
          <div className="campaignUniversePreview">
            <div className="campaignUniverseHead">
              <b>Instalaciones seleccionadas</b>
              <span>
                {selectedUniverse.length} instalaciones · {selectedClientCount}{" "}
                clientes · {selectedRegionCount} regiones
              </span>
            </div>
            {selectedUniverse.length ? (
              <div className="campaignUniverseList">
                {selectedUniverse.map(
                  ({ region, client, contract, installation }) => (
                    <article key={installation.id}>
                      <span>
                        <b>{installation.name}</b>
                        <small>
                          {client} · {contract}
                        </small>
                      </span>
                      <small>
                        {[installation.commune, installation.city, region]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </article>
                  ),
                )}
              </div>
            ) : (
              <p>
                Usa los filtros y selecciona las instalaciones que participarán
                en este ciclo.
              </p>
            )}
          </div>
          <button disabled={!selectedInstallationIds.length}>
            Crear campaña
          </button>
        </form>
      )}
      <div className="campaignList">
        {campaigns.length ? (
          campaigns.map((c) => {
            const info = campaignInfo(c.label),
              u = c.campaign_installations || [],
              total = u.length,
              completed = u.filter(
                (x) => statusKey(x.status) === "done",
              ).length,
              justified = u.filter(
                (x) =>
                  statusKey(x.status) === "justified" ||
                  (!String(x.status).includes("Completada") &&
                    !!x.justification?.trim()),
              ).length,
              pending = u.filter(
                (x) =>
                  statusKey(x.status) === "pending" && !x.justification?.trim(),
              ).length,
              inProgress = Math.max(total - completed - justified - pending, 0),
              adminOpen = adminCampaign === c.id,
              campaignOpen = openCampaign === c.id,
              filtered = campaignOpen
                ? u.filter(
                    (x) =>
                      viewFilter === "all" ||
                      (viewFilter === "pending"
                        ? statusKey(x.status) === "pending" &&
                          !x.justification?.trim()
                        : statusKey(x.status) === viewFilter),
                  )
                : u,
              byRegion = [
                ...new Set(
                  filtered.map((x) => regionName(x.installations?.region)),
                ),
              ]
                .sort((a, b) => a.localeCompare(b, "es"))
                .map((region) => ({
                  region,
                  items: filtered.filter(
                    (x) => regionName(x.installations?.region) === region,
                  ),
                }));
            return (
              <article key={c.id} className="campaignCard">
                <div className="campaignCardHead">
                  <span>
                    <b>{info.name}</b>
                    <small>
                      {info.periodicity} · {info.clientCount ?? 1} clientes ·{" "}
                      {total} instalaciones
                    </small>
                  </span>
                  <em
                    className={
                      c.status === "Abierta" ? "status-open" : "status-closed"
                    }
                  >
                    {c.status}
                  </em>
                  <div className="campaignMetrics">
                    <button
                      type="button"
                      className={
                        campaignOpen && viewFilter === "all" ? "active" : ""
                      }
                      onClick={() => openFiltered(c.id, "all")}
                    >
                      <b>{total}</b>
                      <small>Esperadas</small>
                    </button>
                    <button
                      type="button"
                      className={`st-progress ${campaignOpen && viewFilter === "progress" ? "active" : ""}`}
                      disabled={!inProgress}
                      onClick={() => openFiltered(c.id, "progress")}
                    >
                      <b>{inProgress}</b>
                      <small>En proceso</small>
                    </button>
                    <button
                      type="button"
                      className={`st-done ${campaignOpen && viewFilter === "done" ? "active" : ""}`}
                      disabled={!completed}
                      onClick={() => openFiltered(c.id, "done")}
                    >
                      <b>{completed}</b>
                      <small>Tomadas</small>
                    </button>
                    <button
                      type="button"
                      className={`${pending ? "pending" : "complete"} ${campaignOpen && viewFilter === "pending" ? "active" : ""}`}
                      disabled={!pending}
                      onClick={() => openFiltered(c.id, "pending")}
                    >
                      <b>{pending}</b>
                      <small>Pendientes</small>
                    </button>
                  </div>
                  <div className="campaignHeaderActions">
                    <button
                      type="button"
                      className="campaignSurveyLink"
                      onClick={() => {
                        if (campaignOpen) setOpenCampaign(null);
                        else openFiltered(c.id, "all");
                      }}
                    >
                      {campaignOpen ? "Ocultar instalaciones" : "Ver instalaciones"}
                    </button>
                    {c.status === "Abierta" && (
                      <button
                        type="button"
                        className="campaignSurveyLink"
                        onClick={() =>
                          setAdminCampaign(adminOpen ? null : c.id)
                        }
                      >
                        {adminOpen
                          ? "Ocultar controles"
                          : "Administrar campaña"}
                      </button>
                    )}
                  </div>
                </div>
                {campaignOpen && (
                  <div className="surveyUniverse">
                    <div className="campaignUniverseHead">
                      <b>
                        {viewFilter === "pending"
                          ? "Instalaciones pendientes"
                          : viewFilter === "done"
                            ? "Instalaciones tomadas"
                            : viewFilter === "progress"
                              ? "Instalaciones en proceso"
                              : "Instalaciones de la campaña"}
                      </b>
                      <span>
                        {filtered.length} de {total} instalaciones
                      </span>
                    </div>
                    {byRegion.map((g) => (
                      <div key={g.region} style={{ marginBottom: 16 }}>
                        <h3 style={{ margin: "8px 0" }}>{g.region}</h3>
                        <div
                          className="surveyDenseTable"
                          role="table"
                          aria-label={`Instalaciones ${g.region}`}
                        >
                          <div className="surveyDenseHead" role="row">
                            <span>Cliente</span>
                            <span>Contrato</span>
                            <span>Instalación</span>
                            <span>Estado</span>
                            <span>Acción</span>
                            <span>Accesos</span>
                          </div>
                          {g.items.map((item) => {
                            const id =
                                item.installation_id ||
                                item.installations?.id ||
                                item.id ||
                                "",
                              key = statusKey(item.status);
                            return (
                              <div
                                className={`surveyDenseRow state-${key}`}
                                role="row"
                                key={id}
                                title={`${statusLabel(item.status)} · ${info.name}`}
                              >
                                <span role="cell" data-label="Cliente">
                                  {item.installations?.contracts?.clients
                                    ?.legal_name || "Cliente pendiente"}
                                </span>
                                <span role="cell" data-label="Contrato">
                                  {item.installations?.contracts?.name ||
                                    "Contrato pendiente"}
                                </span>
                                <strong role="cell" data-label="Instalación">
                                  {item.installations?.name ||
                                    "Instalación pendiente"}
                                </strong>
                                <span role="cell" data-label="Estado">
                                  <b
                                    className={`statePill st-${key === "pending" ? "available" : key}`}
                                  >
                                    {statusLabel(item.status)}
                                  </b>
                                </span>
                                <span role="cell" data-label="Acción">
                                  <button
                                    type="button"
                                    className="surveyPrimaryAction"
                                    onClick={() => onOpenSurveys?.(c.id, id)}
                                  >
                                    {key === "done"
                                      ? "Ver / editar conteo"
                                      : "Hacer levantamiento"}
                                  </button>
                                </span>
                                <span role="cell" data-label="Accesos">
                                  {c.status === "Abierta" && key !== "done" ? (
                                    <SurveyLinkControl
                                      campaignId={c.id}
                                      installationId={id}
                                      installationName={
                                        item.installations?.name ||
                                        "Instalación"
                                      }
                                    />
                                  ) : (
                                    <small>—</small>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="campaignSurveyLink"
                      onClick={() => openFiltered(c.id, "all")}
                    >
                      Ver todas las instalaciones
                    </button>
                  </div>
                )}
                {c.status === "Abierta" && pending === 0 && (
                  <form
                    action={closeCampaign}
                    className="campaignClose"
                    onSubmit={(event) => {
                      if (
                        !window.confirm(
                          `¿Cerrar definitivamente la campaña ${info.name}? Conservará todos sus levantamientos y quedará disponible solo para consulta histórica.`,
                        )
                      )
                        event.preventDefault();
                    }}
                  >
                    <input type="hidden" name="campaign_id" value={c.id} />
                    <button>Cerrar campaña</button>
                    <small>
                      Universo completo o formalmente justificado. El cierre no elimina información.
                    </small>
                  </form>
                )}
                {adminOpen && (
                  <div className="adminForm campaignForm">
                    <h3>Control administrativo</h3>
                    <p>
                      Las instalaciones sin materiales pueden justificarse para
                      que no bloqueen el cierre.
                    </p>
                    {u
                      .filter(
                        (x) =>
                          statusKey(x.status) !== "done" &&
                          statusKey(x.status) !== "justified",
                      )
                      .map((item) => {
                        const id =
                          item.installation_id ||
                          item.installations?.id ||
                          item.id ||
                          "";
                        return (
                          <form
                            action={justifyCampaignInstallation}
                            key={id}
                            className="campaignClose"
                          >
                            <input
                              type="hidden"
                              name="campaign_id"
                              value={c.id}
                            />
                            <input
                              type="hidden"
                              name="installation_id"
                              value={id}
                            />
                            <span>
                              <b>{item.installations?.name || "Instalación"}</b>
                              <small>
                                {item.installations?.contracts?.clients
                                  ?.legal_name || ""}{" "}
                                · {regionName(item.installations?.region)}
                              </small>
                            </span>
                            <input
                              name="reason"
                              required
                              minLength={4}
                              placeholder="Motivo de justificación"
                            />
                            <button>Justificar</button>
                          </form>
                        );
                      })}
                    <form action={forceCloseCampaign} className="campaignClose">
                      <input type="hidden" name="campaign_id" value={c.id} />
                      <input
                        name="reason"
                        required
                        minLength={5}
                        placeholder="Motivo obligatorio del cierre forzado"
                      />
                      <button>Forzar cierre</button>
                    </form>
                    <div className="campaignClose">
                      <button
                        type="button"
                        disabled={deletingCampaign === c.id}
                        onClick={() => removeCampaign(c.id, info.name)}
                      >
                        {deletingCampaign === c.id
                          ? "Eliminando..."
                          : "Eliminar campaña"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="empty">
            <b>Sin campañas</b>
            <span>Crea la primera campaña seleccionando instalaciones.</span>
          </div>
        )}
      </div>
    </section>
  );
}
