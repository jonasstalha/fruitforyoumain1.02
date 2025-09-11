import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "@/components/protected-route";
import DashboardPage from "./pages/dashboard-page";
import NewEntryPage from "@/pages/new-entry-page";
import ScanPage from "@/pages/tracability/scan-page";
import LotDetailPage from "@/pages/lot-detail-page";
import MultiLotDetailPage from "@/pages/multi-lot-detail-page";
import FarmsPage from "@/pages/farms-page";
import UsersPage from "@/pages/users-page";
import WarehousesPage from "@/pages/warehouses-page";
import WarehouseDetailPage from "@/pages/warehouse-detail-page";
import LotsPage from "@/pages/lots-page";
import ReportsPage from "@/pages/tracability/ReportsPage";
import StatisticsPage from "@/pages/statistics-page";
import MainLayout from "@/components/layout/main-layout";
import { LoginPage } from "@/pages/login-page";
import { AuthProvider } from "@/components/auth-provider";
import { useLanguage } from "@/contexts/LanguageContext";
import RapportGenerating from "./pages/logistique/rapport-generating";
import facturestemplates from "./pages/logistique/factures-templates";
import inventory from "./pages/logistique/inventory";
import QualityControl from "./pages/quality/qualitycontrol";
import personnelmanagement from "./pages/personnele/personnelmanagement";
import calculedeconsomation from "./pages/production/calculedeconsomation";
import archifage from "./pages/src/archifage";
import reception from "./pages/recaption/reception";
import newEntry from "./pages/recaption/newentry";
import Horaires from "./pages/personnele/Horaires";
import WorkHoursHistory from "./pages/personnele/WorkHoursHistory";
import FicheDePaie from "./pages/personnele/FicheDePaie";
import historiquedeconsomation from "./pages/production/historiquedeconsomation";
import Archivagedesfacture from "@/pages/comptability/Archivagedesfacture"
import DocumentTemplates from "@/pages/comptability/DocumentTemplates";
import FichedExpidition from "@/pages/logistique/FichedExpidition";
import Rapportqualité from "@/pages/quality/Rapportqualité";
import ArchiveRapportqualité from "@/pages/quality/Archivagedescontroles";
import Archivagedescontroles from "@/pages/quality/Archivagedescontroles";
// import QualityControlTestPage from "@/pages/quality/QualityControlTestPage";
import FirebaseConnectionTest from "@/components/FirebaseConnectionTest";
import QualityControlDebug from "@/components/QualityControlDebug";
import QualityControlSaveTest from "@/components/QualityControlSaveTest";
import FirebaseExpeditionTest from "@/components/FirebaseExpeditionTest";
import FirebaseExpeditionTestSimple from "@/components/FirebaseExpeditionTestSimple";
import FirebaseDebugger from './components/FirebaseDebugger';
import ExpeditionHistoryTest from './components/ExpeditionHistoryTest';
import ReportsPagee from "@/pages/tracability/ReportsPage";
import FarmDetailPage from "@/pages/farm-detail-page";
import NewProductPage from "@/pages/new-product-page";
import historiquedemaintenance from "@/pages/mantenance/historiquedemaintenance";
import { auth } from '@/lib/firebase';
import GererCommandesClient from "@/pages/orders/gerer-commandes-client";
import OrderTrackingView from "@/pages/orders/order-tracking";
import CommandeClient from "@/pages/orders/commande-client";
import AutomatisationDeMaintenance from "@/pages/maintenance/automatisation-maintenance";
import PiecesDeRechangeMaintenance from "@/pages/maintenance/pieces-rechange-maintenance";
import CommunicationDashboard from "@/pages/communication/communication-dash";
import DocumentArchive from "@/pages/archive/DocumentArchive"
import LotBarcodePage from "@/pages/lots-barcode-page"
import { Dashboard } from "./pages/src/pages/Dashboard";
import Archifage from "./pages/src/archifage";
import { BoxDetail } from "./pages/src/pages/BoxDetail";
import SuiviProduction from "./pages/production/SuiviProduction"
import SuiviReception from "./pages/reception/SuiviReception"
// Public routes that don't require authentication
function PublicRoutes() {
  return (
    <Switch>
      {/* Public lot detail routes */}
      <Route path="/tracability/lot/:lotNumber" component={LotDetailPage} />
      <Route path="/lots/:lotNumber" component={LotDetailPage} />
      <Route path="/api/avocado-tracking/:lotNumber/pdf" component={LotDetailPage} />
      <Route path="/api/avocado-tracking/:lotNumber/generate-pdf" component={LotDetailPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/archifage" component={Archifage} />
      <Route path="/box/:boxId" component={BoxDetail} />
      <Route path="*">
        <ProtectedRoute>
          <AuthenticatedRoutes />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

// Routes that require authentication
function AuthenticatedRoutes() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/new-entry" component={NewEntryPage} />
        <Route path="/new-product" component={NewProductPage} />
        <Route path="/scan" component={ScanPage} />
        <Route path="/communication-dashboard" component={CommunicationDashboard} />
        <Route path="/gererlescommandesclinet" component={GererCommandesClient} />
        <Route path="/commandeclinet" component={OrderTrackingView} />
        <Route path="/commande-client" component={CommandeClient} />
        <Route path="/lots" component={LotsPage} />
        <Route path="/lots/:id/barcode" component={LotBarcodePage} />
        <Route path="/lot-detail/:lotNumber" component={LotDetailPage} />
        <Route path="/multi-lot-detail/:id" component={MultiLotDetailPage} />
        <Route path="/farms" component={FarmsPage} />
        <Route path="/farms/:id" component={FarmDetailPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/warehouses" component={WarehousesPage} />
        <Route path="/warehouses/:id" component={WarehouseDetailPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/rapport-generating" component={RapportGenerating} />
        <Route path="/factures-templates" component={facturestemplates} />
        <Route path="/traceability" component={StatisticsPage} />
        <Route path="/inventory" component={inventory} />
        <Route path="/qualitycontrol" component={QualityControl} />
        {/* <Route path="/quality-test" component={QualityControlTestPage} /> */}
        <Route path="/firebase-test" component={FirebaseConnectionTest} />
        <Route path="/firebase-expedition-test" component={FirebaseExpeditionTest} />
        <Route path="/firebase-expedition-simple" component={FirebaseExpeditionTestSimple} />
        <Route path="/firebase-debugger" component={FirebaseDebugger} />
        <Route path="/expedition-history-test" component={ExpeditionHistoryTest} />
        <Route path="/quality-debug" component={QualityControlDebug} />
        <Route path="/quality-save-test" component={QualityControlSaveTest} />
        <Route path="/personnelmanagement" component={personnelmanagement} />
        <Route path="/calculedeconsomation" component={calculedeconsomation} />
        <Route path="/logistique/history" component={DocumentArchive} />
        <Route path="/reception" component={reception} />
        <Route path="/new" component={newEntry} />
        <Route path="/schedules" component={Horaires} />
        <Route path="/work-hours-history" component={WorkHoursHistory} />
        <Route path="/fiche-de-paie" component={FicheDePaie} />
        <Route path="/historiquedeconsomation" component={historiquedeconsomation} />
        <Route path="/Templates" component={DocumentTemplates} />
        <Route path="/logistique/fichedexpidition" component={FichedExpidition} />
        <Route path="/Rapportqualité" component={Rapportqualité} />
        <Route path="/archive-rapportqualité" component={ArchiveRapportqualité} />
        <Route path="/Archivagedescontroles" component={Archivagedescontroles} />
        <Route path="/Archivagedesfacture" component={Archivagedesfacture} />
        <Route path="/DocumentArchive" component={DocumentArchive} />
        <Route path="/archifage" component={archifage} />
        {/* Client Orders */}
        <Route path="/suivi-production" component={SuiviProduction} />
  <Route path="/suivi-reception" component={SuiviReception} />
        {/* Client Orders */}
        {/* Maintenance Routes */}
        <Route path="/maintenance" component={Dashboard} />
        <Route path="/automatisationdemaintenance" component={AutomatisationDeMaintenance} />
        <Route path="/piecesderechangemaintenance" component={PiecesDeRechangeMaintenance} />
        <Route path="/dossieredemaintenance" component={historiquedemaintenance} />
        <Route path="/orders" component={GererCommandesClient} />
        <Route path="/archifage" component={Archifage} />
        <Route path="/box/:boxId" component={BoxDetail} />
        <Route path="*" component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

export default function App() {
  const { isRTL } = useLanguage();

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl' : 'ltr'}>
      <AuthProvider>
        <PublicRoutes />
        <Toaster />
        <SonnerToaster />
      </AuthProvider>
    </div>
  );
}
