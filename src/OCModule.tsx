"use client";
import type {MaterialState} from "@/lib/materiales-domain";
import {clp} from "@/lib/materiales-store";
export default function OCModule({state}:{state:MaterialState}){return <><h1>Órdenes de compra</h1><div className="tableWrap"><table><thead><tr><th>OC</th><th>Proveedor</th><th>Neto</th><th>Estado</th></tr></thead><tbody>{state.purchaseOrders.length?state.purchaseOrders.map(o=><tr key={o.id}><td>{o.id.slice(0,16)}</td><td>{o.supplier}</td><td>{clp(o.totalNet)}</td><td>{o.status}</td></tr>):<tr><td colSpan={4}>Sin OC.</td></tr>}</tbody></table></div></>}
