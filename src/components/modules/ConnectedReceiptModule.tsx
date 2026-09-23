"use client";
import { CAPABILITIES, roleCan } from "@/lib/authorization";
import AlemsiActionButton, {
  AlemsiLoadingState,
} from "@/components/ui/AlemsiActionButton";
import { useEffect, useMemo, useState } from "react";
import { registerPurchaseOrderReceipt } from "@/app/receipt-actions";
import { registerPurchaseWithoutOc } from "@/app/finance-purchase-actions";
type Line = {
  id: string;
  material_id: string | null;
  description?: string | null;
  unit?: string | null;
  supplier_code?: string | null;
  ordered_qty: number;
  unit_net_price: number;
  already_received: number;
  pending_qty: number;
  materials?: {
    name?: string | null;
    presentation?: string | null;
    unit?: string | null;
    supplier_code?: string | null;
  } | null;
};
type Order = {
  id: string;
  order_number?: string | null;
  status: string;
  total_net: number;
  order_type?: string | null;
  supplier_id?: string | null;
  suppliers?: { legal_name?: string | null } | null;
  purchase_order_lines: Line[];
};
type Supplier = { id: string; legal_name: string; rut?: string | null };
type Material = {
  id: string;
  name: string;
  family?: string | null;
  presentation?: string | null;
  unit?: string | null;
  current_net_price?: number | null;
};
type DraftLine = {
  material_id: string;
  received_qty: number;
  actual_unit_net: number;
};
type Receipt = {
  id: string;
  purchase_order_id?: string | null;
  status: string;
  received_at?: string | null;
  shipping_condition?: string | null;
  freight_net?: number | null;
  document_type?: string | null;
  document_folio?: string | null;
  document_date?: string | null;
  reconciliation_status?: string | null;
};
const money = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n || 0);
const norm = (v?: string | null) => (v || "").toLocaleLowerCase("es-CL").trim();
export default function ConnectedReceiptModule({ role }: { role: string }) {
  const [orders, setOrders] = useState<Order[]>([]),
    [receipts, setReceipts] = useState<Receipt[]>([]),
    [suppliers, setSuppliers] = useState<Supplier[]>([]),
    [materials, setMaterials] = useState<Material[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [orderSearch, setOrderSearch] = useState(""),
    [historySearch, setHistorySearch] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({}),
    [prices, setPrices] = useState<Record<string, number>>({});
  const [documentType, setDocumentType] = useState("Factura"),
    [documentFolio, setDocumentFolio] = useState(""),
    [documentDate, setDocumentDate] = useState(""),
    [documentNet, setDocumentNet] = useState(0),
    [documentVat, setDocumentVat] = useState(0),
    [documentTotal, setDocumentTotal] = useState(0);
  const [shipping, setShipping] = useState("Incluido"),
    [freight, setFreight] = useState(0),
    [observation, setObservation] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const [entryMode, setEntryMode] = useState<"with-oc" | "without-oc">(
      "with-oc",
    ),
    [supplierId, setSupplierId] = useState(""),
    [noOcReason, setNoOcReason] = useState(""),
    [draftLines, setDraftLines] = useState<DraftLine[]>([
      { material_id: "", received_qty: 1, actual_unit_net: 0 },
    ]),
    [associatedOrderId, setAssociatedOrderId] = useState("");
  const canReceive = roleCan(role, CAPABILITIES.RECEIPT_REGISTER);
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/receipts/context", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "No se pudo cargar Recepción");
      setOrders(body.orders || []);
      setReceipts(body.receipts || []);
      setSuppliers(body.suppliers || []);
      setMaterials(body.materials || []);
    } catch (error: any) {
      setMessage(error?.message || "No se pudo cargar Recepción");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const receivable = useMemo(
    () =>
      orders.filter((order) =>
        (order.purchase_order_lines || []).some(
          (line) => line.material_id && Number(line.pending_qty) > 0,
        ),
      ),
    [orders],
  );
  const matches = useMemo(() => {
    const q = norm(orderSearch);
    if (!q) return receivable.slice(0, 20);
    return receivable
      .filter((o) =>
        norm(
          `${o.order_number} ${o.suppliers?.legal_name} ${o.status}`,
        ).includes(q),
      )
      .slice(0, 30);
  }, [receivable, orderSearch]);
  const selected = receivable.find((order) => order.id === selectedId) || null;
  const associationCandidates = useMemo(() => {
    const ids = new Set(
      draftLines
        .filter((line) => line.material_id)
        .map((line) => line.material_id),
    );
    if (!supplierId || !ids.size) return [];
    return receivable
      .filter((order) => order.supplier_id === supplierId)
      .map((order) => ({
        order,
        matching: order.purchase_order_lines.filter(
          (line) =>
            line.material_id &&
            ids.has(line.material_id) &&
            Number(line.pending_qty) > 0,
        ),
      }))
      .filter((candidate) => candidate.matching.length > 0);
  }, [draftLines, receivable, supplierId]);
  const materialLines = (selected?.purchase_order_lines || []).filter(
    (line) => line.material_id && Number(line.pending_qty) > 0,
  );
  const history = useMemo(() => {
    const q = norm(historySearch);
    return receipts
      .filter((r) => {
        const o = orders.find((x) => x.id === r.purchase_order_id);
        return (
          !q ||
          norm(
            `${r.document_type} ${r.document_folio} ${o?.order_number} ${o?.suppliers?.legal_name}`,
          ).includes(q)
        );
      })
      .slice(0, 20);
  }, [receipts, orders, historySearch]);
  useEffect(() => {
    if (!selected) {
      setQty({});
      setPrices({});
      return;
    }
    const q: Record<string, number> = {},
      p: Record<string, number> = {};
    for (const line of materialLines) {
      q[line.id] = Number(line.pending_qty || 0);
      p[line.id] = Number(line.unit_net_price || 0);
    }
    setQty(q);
    setPrices(p);
    setDocumentType("Factura");
    setDocumentFolio("");
    setDocumentDate(new Date().toISOString().slice(0, 10));
    setDocumentNet(Number(selected.total_net || 0));
    setDocumentVat(Math.round(Number(selected.total_net || 0) * 0.19));
    setDocumentTotal(Math.round(Number(selected.total_net || 0) * 1.19));
    setShipping("Incluido");
    setFreight(0);
    setObservation("");
    setMessage("");
  }, [selectedId]);
  const submit = async () => {
    if (!selected) return;
    const lines = materialLines
      .map((line) => ({
        purchase_order_line_id: line.id,
        material_id: line.material_id,
        received_qty: Number(qty[line.id] || 0),
        actual_unit_net: Number(prices[line.id] || 0),
      }))
      .filter((line) => line.received_qty > 0);
    if (!documentFolio.trim()) {
      setMessage("Ingresa el folio del documento");
      return;
    }
    if (!documentDate) {
      setMessage("Ingresa la fecha del documento");
      return;
    }
    if (!lines.length) {
      setMessage("Ingresa al menos una cantidad recibida");
      return;
    }
    if (shipping === "Por pagar" && freight <= 0) {
      setMessage("Ingresa el valor neto del flete por pagar");
      return;
    }
    const formData = new FormData();
    formData.set("purchase_order_id", selected.id);
    formData.set("lines", JSON.stringify(lines));
    formData.set("document_type", documentType);
    formData.set("document_folio", documentFolio);
    formData.set("document_date", documentDate);
    formData.set("document_net", String(documentNet));
    formData.set("document_vat", String(documentVat));
    formData.set("document_total", String(documentTotal));
    formData.set("shipping_condition", shipping);
    formData.set("freight_net", String(shipping === "Por pagar" ? freight : 0));
    formData.set("observation", observation);
    setSaving(true);
    setMessage("");
    try {
      await registerPurchaseOrderReceipt(formData);
      setMessage(
        "Documento y recepción registrados. Quedan pendientes de cotejo antes de cargar inventario.",
      );
      setSelectedId("");
      setOrderSearch("");
      await load();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo registrar la recepción");
    } finally {
      setSaving(false);
    }
  };
  const updateDraftLine = (
    index: number,
    key: keyof DraftLine,
    value: string | number,
  ) =>
    setDraftLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line,
      ),
    );
  const submitWithoutOc = async () => {
    const valid = draftLines.filter(
      (line) => line.material_id && line.received_qty > 0,
    );
    if (
      !supplierId ||
      !documentFolio.trim() ||
      !documentDate ||
      !valid.length
    ) {
      setMessage(
        "Proveedor, folio, fecha y al menos un material recibido son obligatorios.",
      );
      return;
    }
    const formData = new FormData();
    formData.set("document_type", documentType);
    formData.set("document_folio", documentFolio);
    formData.set("document_date", documentDate);
    formData.set("document_net", String(documentNet));
    formData.set("document_vat", String(documentVat));
    formData.set("document_total", String(documentTotal));
    formData.set("observation", observation);
    setSaving(true);
    setMessage("");
    try {
      if (associatedOrderId) {
        const candidate = associationCandidates.find(
          (item) => item.order.id === associatedOrderId,
        );
        if (!candidate)
          throw new Error("La OC seleccionada ya no coincide con la recepción");
        const associatedLines = valid.map((line) => {
          const orderLine = candidate.matching.find(
            (item) => item.material_id === line.material_id,
          );
          if (!orderLine)
            throw new Error(
              "Todos los materiales deben coincidir exactamente con líneas pendientes de la OC",
            );
          if (line.received_qty > Number(orderLine.pending_qty || 0))
            throw new Error(
              "Una cantidad recibida supera el pendiente de la OC seleccionada",
            );
          return {
            purchase_order_line_id: orderLine.id,
            material_id: line.material_id,
            received_qty: line.received_qty,
            actual_unit_net: line.actual_unit_net,
          };
        });
        formData.set("purchase_order_id", associatedOrderId);
        formData.set("shipping_condition", "Incluido");
        formData.set("freight_net", "0");
        formData.set("lines", JSON.stringify(associatedLines));
        await registerPurchaseOrderReceipt(formData);
        setMessage(
          "Recepción asociada a la OC confirmada. Queda pendiente de cotejo antes de inventario.",
        );
      } else {
        if (!noOcReason.trim())
          throw new Error("Indica por qué la recepción no tiene OC asociada");
        formData.set("supplier_id", supplierId);
        formData.set("no_oc_reason", noOcReason);
        formData.set("lines", JSON.stringify(valid));
        await registerPurchaseWithoutOc(formData);
        setMessage(
          "Recepción sin OC registrada. Queda pendiente de cotejo antes de inventario.",
        );
      }
      setDraftLines([{ material_id: "", received_qty: 1, actual_unit_net: 0 }]);
      setSupplierId("");
      setAssociatedOrderId("");
      setNoOcReason("");
      setDocumentFolio("");
      await load();
    } catch (error: any) {
      setMessage(error?.message || "No se pudo registrar la recepción");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="panel receiptModule">
      <div className="receiptHead">
        <div>
          <h2>Recepción de materiales</h2>
          <p>
            Busca la OC que acompaña la mercadería, registra lo recibido y
            vincula el documento en el mismo proceso.
          </p>
        </div>
        <span className="catalogCount">{receivable.length} OC con saldo</span>
      </div>
      {!canReceive && (
        <p className="note">
          <b>Modo consulta.</b> Tu perfil puede revisar recepciones, pero no
          registrar ingreso físico.
        </p>
      )}
      {loading ? (
        <AlemsiLoadingState text="Cargando recepción…" />
      ) : (
        <>
          {canReceive && (
            <div className="receiptEntryModes">
              <button
                type="button"
                className={entryMode === "with-oc" ? "selected" : ""}
                onClick={() => setEntryMode("with-oc")}
              >
                Recepción con OC
              </button>
              <button
                type="button"
                className={entryMode === "without-oc" ? "selected" : ""}
                onClick={() => {
                  setEntryMode("without-oc");
                  if (!documentDate)
                    setDocumentDate(new Date().toISOString().slice(0, 10));
                }}
              >
                Recepción / factura sin OC
              </button>
            </div>
          )}
          {canReceive && entryMode === "without-oc" && (
            <div className="receiptEditor noOcEditor">
              <p className="note">
                Registra primero lo recibido físicamente. Si hay una OC con el
                mismo proveedor y materiales exactos, el sistema la muestra para
                que decidas si corresponde asociarla.
              </p>
              <div className="receiptDocument">
                <label>
                  Proveedor
                  <select
                    value={supplierId}
                    onChange={(event) => {
                      setSupplierId(event.target.value);
                      setAssociatedOrderId("");
                    }}
                  >
                    <option value="">Seleccionar</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.legal_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo de documento
                  <select
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value)}
                  >
                    <option>Factura</option>
                    <option>Boleta</option>
                    <option>Guía de despacho</option>
                    <option>Otro</option>
                  </select>
                </label>
                <label>
                  Folio
                  <input
                    value={documentFolio}
                    onChange={(event) => setDocumentFolio(event.target.value)}
                  />
                </label>
                <label>
                  Fecha
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(event) => setDocumentDate(event.target.value)}
                  />
                </label>
                <label>
                  Neto
                  <input
                    type="number"
                    min="0"
                    value={documentNet}
                    onChange={(event) =>
                      setDocumentNet(Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  IVA
                  <input
                    type="number"
                    min="0"
                    value={documentVat}
                    onChange={(event) =>
                      setDocumentVat(Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  Total
                  <input
                    type="number"
                    min="0"
                    value={documentTotal}
                    onChange={(event) =>
                      setDocumentTotal(Number(event.target.value))
                    }
                  />
                </label>
              </div>
              <div className="receiptTable">
                <div className="receiptNoOcRow receiptHeader">
                  <span>Material</span>
                  <span>Cantidad recibida</span>
                  <span>Valor neto unit.</span>
                  <span>Acción</span>
                </div>
                {draftLines.map((line, index) => (
                  <div className="receiptNoOcRow" key={`draft-${index}`}>
                    <span>
                      <select
                        value={line.material_id}
                        onChange={(event) => {
                          const material = materials.find(
                            (item) => item.id === event.target.value,
                          );
                          updateDraftLine(
                            index,
                            "material_id",
                            event.target.value,
                          );
                          if (material)
                            updateDraftLine(
                              index,
                              "actual_unit_net",
                              Number(material.current_net_price || 0),
                            );
                          setAssociatedOrderId("");
                        }}
                      >
                        <option value="">Seleccionar material</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.received_qty}
                        onChange={(event) =>
                          updateDraftLine(
                            index,
                            "received_qty",
                            Number(event.target.value),
                          )
                        }
                      />
                    </span>
                    <span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.actual_unit_net}
                        onChange={(event) =>
                          updateDraftLine(
                            index,
                            "actual_unit_net",
                            Number(event.target.value),
                          )
                        }
                      />
                    </span>
                    <span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftLines((current) =>
                            current.length === 1
                              ? current
                              : current.filter(
                                  (_, lineIndex) => lineIndex !== index,
                                ),
                          )
                        }
                      >
                        Quitar
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="linkBtn"
                onClick={() =>
                  setDraftLines((current) => [
                    ...current,
                    { material_id: "", received_qty: 1, actual_unit_net: 0 },
                  ])
                }
              >
                + Agregar material
              </button>
              {associationCandidates.length > 0 && (
                <div className="associationBox">
                  <h4>OC posiblemente relacionada</h4>
                  <p>
                    Coincidencia por proveedor y material exacto. La asociación
                    nunca es automática.
                  </p>
                  {associationCandidates.map(({ order, matching }) => (
                    <label
                      key={order.id}
                      className={
                        associatedOrderId === order.id ? "selected" : ""
                      }
                    >
                      <input
                        type="radio"
                        name="associated_order"
                        checked={associatedOrderId === order.id}
                        onChange={() => setAssociatedOrderId(order.id)}
                      />
                      <span>
                        <b>{order.order_number || "OC sin folio"}</b>
                        <small>
                          {matching
                            .map(
                              (line) =>
                                `${line.materials?.name || line.description}: ordenado ${line.ordered_qty}, recibido ${line.already_received}, pendiente ${line.pending_qty}`,
                            )
                            .join(" · ")}
                        </small>
                      </span>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="linkBtn"
                    onClick={() => setAssociatedOrderId("")}
                  >
                    Continuar sin asociar OC
                  </button>
                </div>
              )}
              {!associatedOrderId && (
                <label className="receiptObservation">
                  Motivo sin OC
                  <textarea
                    rows={2}
                    value={noOcReason}
                    onChange={(event) => setNoOcReason(event.target.value)}
                    placeholder="Compra local, documento recibido sin orden previa, regularización u otro motivo trazable"
                  />
                </label>
              )}
              <label className="receiptObservation">
                Observación de recepción
                <textarea
                  rows={2}
                  value={observation}
                  onChange={(event) => setObservation(event.target.value)}
                />
              </label>
              {message && (
                <p className="note">
                  <b>{message}</b>
                </p>
              )}
              <AlemsiActionButton
                type="button"
                loading={saving}
                loadingText="Registrando…"
                onClick={submitWithoutOc}
              >
                {associatedOrderId
                  ? "Confirmar asociación y registrar recepción"
                  : "Registrar recepción sin OC"}
              </AlemsiActionButton>
            </div>
          )}
          {entryMode === "with-oc" && (
            <>
              <div className="receiptSelector">
                <label>
                  Buscar orden de compra
                  <input
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Escribe N° de OC, proveedor o estado"
                    disabled={!canReceive}
                  />
                </label>
                {canReceive && orderSearch.trim() && (
                  <div className="receiptMatches">
                    {matches.length ? (
                      matches.map((order) => (
                        <button
                          type="button"
                          key={order.id}
                          className={selectedId === order.id ? "selected" : ""}
                          onClick={() => {
                            setSelectedId(order.id);
                            setOrderSearch(order.order_number || "");
                          }}
                        >
                          <b>{order.order_number || "OC sin folio"}</b>
                          <span>
                            {order.suppliers?.legal_name || "Proveedor"}
                          </span>
                          <small>
                            {order.status} ·{" "}
                            {money(Number(order.total_net || 0))}
                          </small>
                        </button>
                      ))
                    ) : (
                      <span className="receiptNoMatch">
                        No se encontraron OC con materiales pendientes.
                      </span>
                    )}
                  </div>
                )}{" "}
                {!orderSearch.trim() && canReceive && (
                  <small className="receiptHelp">
                    Escribe la OC impresa en la factura o mercadería. También
                    puedes buscar por proveedor.
                  </small>
                )}
              </div>
              {selected && (
                <div className="receiptEditor">
                  <div className="receiptSummary">
                    <span>
                      <small>OC</small>
                      <b>{selected.order_number || "Sin folio"}</b>
                    </span>
                    <span>
                      <small>Proveedor</small>
                      <b>{selected.suppliers?.legal_name || "Proveedor"}</b>
                    </span>
                    <span>
                      <small>Estado</small>
                      <b>{selected.status}</b>
                    </span>
                    <span>
                      <small>Neto OC</small>
                      <b>{money(Number(selected.total_net || 0))}</b>
                    </span>
                  </div>
                  <div className="receiptDocument">
                    <label>
                      Tipo de documento
                      <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                      >
                        <option>Factura</option>
                        <option>Boleta</option>
                        <option>Guía de despacho</option>
                        <option>Otro</option>
                      </select>
                    </label>
                    <label>
                      Folio documento
                      <input
                        value={documentFolio}
                        onChange={(e) => setDocumentFolio(e.target.value)}
                        placeholder="Folio obligatorio"
                      />
                    </label>
                    <label>
                      Fecha documento
                      <input
                        type="date"
                        value={documentDate}
                        onChange={(e) => setDocumentDate(e.target.value)}
                      />
                    </label>
                    <label>
                      Neto documento
                      <input
                        type="number"
                        min="0"
                        value={documentNet}
                        onChange={(e) => setDocumentNet(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      IVA
                      <input
                        type="number"
                        min="0"
                        value={documentVat}
                        onChange={(e) => setDocumentVat(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      Total documento
                      <input
                        type="number"
                        min="0"
                        value={documentTotal}
                        onChange={(e) =>
                          setDocumentTotal(Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  <div className="receiptTable">
                    <div className="receiptRow receiptHeader">
                      <span>Material</span>
                      <span>Pedido</span>
                      <span>Recibido</span>
                      <span>Pendiente</span>
                      <span>Ingreso ahora</span>
                      <span>Valor neto unit.</span>
                    </div>
                    {materialLines.map((line) => {
                      const name =
                        line.materials?.name || line.description || "Material";
                      return (
                        <div className="receiptRow" key={line.id}>
                          <span>
                            <b>{name}</b>
                            <small>
                              {line.materials?.presentation ||
                                line.materials?.unit ||
                                line.unit ||
                                ""}
                            </small>
                          </span>
                          <span>{Number(line.ordered_qty || 0)}</span>
                          <span>{Number(line.already_received || 0)}</span>
                          <span>
                            <b>{Number(line.pending_qty || 0)}</b>
                          </span>
                          <span>
                            <input
                              type="number"
                              min="0"
                              max={Number(line.pending_qty || 0)}
                              step="any"
                              value={qty[line.id] ?? 0}
                              onChange={(e) =>
                                setQty((current) => ({
                                  ...current,
                                  [line.id]: Number(e.target.value),
                                }))
                              }
                            />
                          </span>
                          <span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={prices[line.id] ?? 0}
                              onChange={(e) =>
                                setPrices((current) => ({
                                  ...current,
                                  [line.id]: Number(e.target.value),
                                }))
                              }
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="receiptShipping">
                    <label>
                      Condición de envío
                      <select
                        value={shipping}
                        onChange={(e) => {
                          setShipping(e.target.value);
                          if (e.target.value !== "Por pagar") setFreight(0);
                        }}
                      >
                        <option>Incluido</option>
                        <option>Por pagar</option>
                        <option>Retiro</option>
                      </select>
                    </label>
                    <label>
                      Flete neto
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={freight}
                        disabled={shipping !== "Por pagar"}
                        onChange={(e) => setFreight(Number(e.target.value))}
                      />
                    </label>
                    <label className="receiptObservation">
                      Observación
                      <textarea
                        rows={3}
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        placeholder="Diferencias, estado de bultos, referencia de transporte, etc."
                      />
                    </label>
                  </div>
                  {message && (
                    <p className="note">
                      <b>{message}</b>
                    </p>
                  )}
                  <AlemsiActionButton
                    type="button"
                    loading={saving}
                    loadingText="Registrando…"
                    onClick={submit}
                  >
                    Registrar recepción y enviar a cotejo
                  </AlemsiActionButton>
                </div>
              )}
            </>
          )}
          <div className="receiptHistory">
            <div className="receiptHistoryHead">
              <h3>Recepciones y documentos</h3>
              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar OC, factura o proveedor"
              />
            </div>
            {history.length ? (
              history.map((receipt) => {
                const order = orders.find(
                  (o) => o.id === receipt.purchase_order_id,
                );
                return (
                  <div className="receiptHistoryRow" key={receipt.id}>
                    <span>
                      <b>
                        {receipt.document_type || "Documento"}{" "}
                        {receipt.document_folio || "sin folio"}
                      </b>
                      <small>
                        {order?.order_number || "Sin OC"} ·{" "}
                        {order?.suppliers?.legal_name || "Proveedor"}
                      </small>
                    </span>
                    <span>
                      {receipt.reconciliation_status || receipt.status}
                    </span>
                    <span>{receipt.shipping_condition || "Incluido"}</span>
                    <strong>
                      {Number(receipt.freight_net || 0) > 0
                        ? `${money(Number(receipt.freight_net))} flete neto`
                        : "Sin flete imputado"}
                    </strong>
                  </div>
                );
              })
            ) : (
              <div className="empty">
                <b>
                  {historySearch
                    ? "Sin coincidencias"
                    : "Aún no hay recepciones registradas"}
                </b>
              </div>
            )}
          </div>
        </>
      )}
      <style jsx>{`
        .receiptEntryModes {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 18px 0 10px;
        }
        .receiptEntryModes button.selected {
          color: #0b526f;
          background: #eaf7f4;
          border-color: #5daea2;
          font-weight: 800;
        }
        .noOcEditor {
          margin: 10px 0 20px;
          padding: 14px;
          border: 1px solid #c8dce8;
          border-radius: 12px;
          background: #fbfdfd;
        }
        .receiptNoOcRow {
          display: grid;
          grid-template-columns: minmax(260px, 2fr) repeat(
              3,
              minmax(110px, 1fr)
            );
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border-bottom: 1px solid #e7ecef;
          min-width: 760px;
        }
        .receiptNoOcRow select,
        .receiptNoOcRow input {
          width: 100%;
          box-sizing: border-box;
        }
        .associationBox {
          display: grid;
          gap: 8px;
          margin: 14px 0;
          padding: 12px;
          border: 1px solid #79bdb1;
          border-radius: 12px;
          background: #eef8f6;
        }
        .associationBox h4,
        .associationBox p {
          margin: 0;
        }
        .associationBox label {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 9px;
          border: 1px solid #c8dce8;
          border-radius: 9px;
          background: white;
        }
        .associationBox label.selected {
          border-color: #159a9c;
        }
        .associationBox label span {
          display: grid;
          gap: 3px;
        }
        .receiptHead {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
        }
        .receiptHead h2 {
          margin: 0 0 6px;
        }
        .receiptHead p {
          margin: 0;
        }
        .receiptSelector {
          margin: 18px 0;
          position: relative;
        }
        .receiptSelector label,
        .receiptShipping label,
        .receiptDocument label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-weight: 700;
        }
        .receiptSelector input,
        .receiptShipping select,
        .receiptShipping input,
        .receiptShipping textarea,
        .receiptDocument select,
        .receiptDocument input,
        .receiptRow input {
          width: 100%;
          box-sizing: border-box;
        }
        .receiptHelp {
          display: block;
          margin-top: 7px;
          color: #627d98;
        }
        .receiptMatches {
          display: grid;
          gap: 6px;
          margin-top: 7px;
          padding: 7px;
          border: 1px solid #dfe6ea;
          border-radius: 10px;
          background: #fff;
          max-height: 280px;
          overflow: auto;
        }
        .receiptMatches button {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          gap: 10px;
          text-align: left;
          align-items: center;
          background: #fff;
          color: #102a43;
          border: 1px solid #e7ecef;
        }
        .receiptMatches button.selected,
        .receiptMatches button:hover {
          background: #eef8f7;
          border-color: #159a9c;
        }
        .receiptMatches small {
          text-align: right;
          color: #627d98;
        }
        .receiptNoMatch {
          padding: 12px;
          color: #627d98;
        }
        .receiptSummary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        .receiptSummary span {
          border: 1px solid #dfe6ea;
          border-radius: 10px;
          padding: 10px;
          display: flex;
          flex-direction: column;
        }
        .receiptDocument {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .receiptTable {
          overflow: auto;
          border: 1px solid #dfe6ea;
          border-radius: 12px;
        }
        .receiptRow {
          display: grid;
          grid-template-columns: minmax(240px, 2fr) repeat(5, minmax(95px, 1fr));
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border-bottom: 1px solid #e7ecef;
          min-width: 900px;
        }
        .receiptRow > span:first-child {
          display: flex;
          flex-direction: column;
        }
        .receiptHeader {
          font-weight: 800;
          background: #f4f7f8;
        }
        .receiptShipping {
          display: grid;
          grid-template-columns: 1fr 1fr 2fr;
          gap: 12px;
          margin: 18px 0;
        }
        .receiptHistory {
          margin-top: 26px;
        }
        .receiptHistoryHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }
        .receiptHistoryHead h3 {
          margin: 0;
        }
        .receiptHistoryHead input {
          min-width: 320px;
        }
        .receiptHistoryRow {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.4fr;
          gap: 12px;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #e7ecef;
        }
        .receiptHistoryRow span:first-child {
          display: flex;
          flex-direction: column;
        }
        .receiptHistoryRow strong {
          text-align: right;
        }
        @media (max-width: 900px) {
          .receiptSummary,
          .receiptDocument {
            grid-template-columns: 1fr 1fr;
          }
          .receiptShipping {
            grid-template-columns: 1fr;
          }
          .receiptHistoryRow {
            grid-template-columns: 1fr 1fr;
          }
          .receiptHistoryRow strong {
            text-align: left;
          }
          .receiptMatches button {
            grid-template-columns: 1fr;
          }
          .receiptMatches small {
            text-align: left;
          }
        }
        @media (max-width: 600px) {
          .receiptHead {
            display: block;
          }
          .receiptSummary,
          .receiptDocument {
            grid-template-columns: 1fr;
          }
          .receiptHistoryHead {
            display: block;
          }
          .receiptHistoryHead input {
            width: 100%;
            min-width: 0;
            margin-top: 8px;
          }
        }
      `}</style>
    </section>
  );
}
