import type { Metadata } from "next";
import "./globals.css";
import "./responsive-fixes.css";
import "./typography-fixes.css";
import "./ui-standardization.css";
import "./material-profile-standardization.css";
import "./operational-compact.css";
import "./mobile-viewport-corrections.css";
import "./navigation-ux.css";
import "./procurement-ux.css";
import "./purchase-order-document.css";
import "./operations-dashboard.css";
import "./mobile-operations.css";
import "./material-budget.css";
import "./ac-economic.css";
import "./dispatch-mobile-search.css";

const appName = "ALEMSI Materiales";
const appDescription = "ERP de gestión de materiales y abastecimiento. Control operacional, compras, recepción, despacho y trazabilidad por contrato e instalación.";

export const metadata: Metadata = {
  title: appName,
  description: appDescription,
  openGraph: {
    title: appName,
    description: appDescription,
    type: "website",
    locale: "es_CL",
    siteName: appName,
  },
  twitter: {
    card: "summary",
    title: appName,
    description: appDescription,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
