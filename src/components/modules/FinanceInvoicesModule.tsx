"use client";
import FinanceDashboard from "@/components/modules/FinanceDashboard";
import FinancePurchaseRegister from "@/components/modules/FinancePurchaseRegister";
export default function FinanceInvoicesModule({role}:{role:string}){return <><FinanceDashboard/><FinancePurchaseRegister role={role}/></>}
