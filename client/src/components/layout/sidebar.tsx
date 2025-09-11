import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  Home,
  PlusSquare,
  QrCode,
  FileText,
  ChartBar,
  Calculator,
  Layers,
  History,
  Tractor,
  Users,
  PackageCheck,
  Leaf,
  FileBarChart,
  BarChart3,
  Warehouse,
  ChevronDown,
  ChevronRight,
  Truck,
  Package,
  ClipboardList,
  UserCog,
  Calendar,
  LayoutTemplate,
  ArchiveRestore,
  ShieldCheck,
  ChevronLeft,
  Construction ,
  Plus,
  Lock,
  Clock,
  DollarSign,

} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Sidebar() {
  const [location] = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, hasAccess } = useAuth();
  const { t, isRTL } = useLanguage();

  const isActive = (path: string) => {
    return location === path;
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const renderSection = (title: string, items: any[], sectionKey: string) => {
    const hasAccessToSection = hasAccess(sectionKey);
    
    return (
      <div>
        <div
          className={cn(
            "mt-6 py-2 px-4 text-xs uppercase flex items-center cursor-pointer rounded-md transition-all duration-300 ease-in-out",
            hasAccessToSection 
              ? "text-neutral-500 hover:bg-neutral-700" 
              : "text-neutral-600 cursor-not-allowed opacity-50"
          )}
          onClick={hasAccessToSection ? () => toggleSection(sectionKey) : undefined}
        >
          {hasAccessToSection ? (
            expandedSections.includes(sectionKey) ? (
              <ChevronDown className="h-4 w-4 mr-2" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-2" />
            )
          ) : (
            <Lock className="h-4 w-4 mr-2" />
          )}
          {isSidebarOpen && <span>{title}</span>}
        </div>
        {hasAccessToSection && expandedSections.includes(sectionKey) && (
          <ul>
            {items.map((item, index) => (
              <li key={index} className="mb-1">
                {item.isExternal ? (
                  <a href={item.path} target="_blank" rel="noopener noreferrer">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "flex items-center p-3 rounded-md transition-colors cursor-pointer",
                            "hover:bg-neutral-700 text-neutral-300"
                          )}
                        >
                          {item.icon}
                          {isSidebarOpen && <span className="ml-2">{item.title}</span>}
                        </div>
                      </TooltipTrigger>
                      {!isSidebarOpen && (
                        <TooltipContent>{item.title}</TooltipContent>
                      )}
                    </Tooltip>
                  </a>
                ) : (
                  <Link href={item.path}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "flex items-center p-3 rounded-md transition-colors cursor-pointer",
                            isActive(item.path)
                              ? "bg-green-700 text-white shadow-md"
                              : "hover:bg-neutral-700 text-neutral-300"
                          )}
                        >
                          {item.icon}
                          {isSidebarOpen && <span className="ml-2">{item.title}</span>}
                        </div>
                      </TooltipTrigger>
                      {!isSidebarOpen && (
                        <TooltipContent>{item.title}</TooltipContent>
                      )}
                    </Tooltip>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // All menu items with icons
  const menuItems = [
    {
      title: t('nav.dashboard'),
      icon: <Home className="h-5 w-5 mr-2" />,
      path: "/",
    },
    {
      title: t('dashboard.notifications'),
      icon: <Home className="h-5 w-5 mr-2" />,
      path: "/communication-dashboard",
    },
    {
      title: t('common.add') + " " + t('common.entry'),
      icon: <PlusSquare className="h-5 w-5 mr-2" />,
      path: "/new-entry",
    },
    {
      title: t('common.clientOrder'),
      icon: <PlusSquare className="h-5 w-5 mr-2" />,
      path: "/commandeclinet",
    },
    {
      title: t('common.scanCode'),
      icon: <QrCode className="h-5 w-5 mr-2" />,
      path: "/scan",
    },
  ];

  // const traceabilityItems = [
  //   {
  //     title: "Rapports PDF",
  //     icon: <FileText className="h-5 w-5 mr-2" />,
  //     path: "/reports",
  //   },
  //   // {
  //   //   title: "Statistiques",
  //   //   icon: <BarChart3 className="h-5 w-5 mr-2" />,
  //   //   path: "/statistics",
  //   // },
  // ];

  const adminItems = [
    {
      title: t('personnel.employees'),
      icon: <Users className="h-5 w-5 mr-2" />,
      path: "/users",
    },
    {
      title: t('common.warehouses'),
      icon: <Warehouse className="h-5 w-5 mr-2" />,
      path: "/warehouses",
    },
    {
      title: t('common.manageLots'),
      icon: <PackageCheck className="h-5 w-5 mr-2" />,
      path: "/lots",
    },
    {
      title: t('common.manageFarms'),
      icon: <Tractor className="h-5 w-5 mr-2" />,
      path: "/farms",
    },

  ];

  const logisticsItems = [
    {
      title: t('logistics.reports'),
      icon: <Truck className="h-5 w-5 mr-2" />,
      path: "/rapport-generating",
    },
    {
      title: t('logistics.inventory'),
      icon: <ClipboardList className="h-5 w-5 mr-2" />,
      path: "/inventory",
    }, 
    {
      title: t('logistics.expeditionSheet'),
      icon: <ClipboardList className="h-5 w-5 mr-2" />,
      path: "/logistique/fichedexpidition",
    },
    {
      title: t('common.archive'),
      icon: <ClipboardList className="h-5 w-5 mr-2" />,
      path: "https://archifage.fruitsforyou.ma",
      isExternal: true,
    },
  ];

  const quality = [
    {
      title: t('quality.title'),
      icon: <ShieldCheck className="h-5 w-5 mr-2" />,
      path: "/qualitycontrol",
    },
    {
      title: t('quality.reports'),
      icon: <FileBarChart className="h-5 w-5 mr-2" />,
      path: "/Rapportqualité",
    },
    {
      title: t('quality.archive'),
      icon: <ArchiveRestore className="h-5 w-5 mr-2" />,
      path: "/Archivagedescontroles",
    },
  ];

  const ReceptionItems = [
    {
      title: t('reception.title'),
      icon: <ClipboardList className="h-5 w-5 mr-2" />,
      path: "/reception",
    },
    {
      title: 'Contrôle à la réception',
      icon: <ClipboardList className="h-5 w-5 mr-2" />,
      path: "/controle-reception",
    },
    {
      title: t('common.add') + " " + t('common.entry'),
      icon: <ClipboardList className="h-5 w-5 mr-2" />,
      path: "/new",
    },
    {
      title: 'Suivi réception',
      icon: <ClipboardList className="h-5 w-5 mr-2" />,
      path: "/suivi-reception",
    },
    {
      title: 'Suivi déchets',
      icon: <ClipboardList className="h-5 w-5 mr-2" />,
      path: "/suivi-dechets",
    },
  ];

  const personnelItems = [
    {
      title: t('personnel.title'),
      icon: <UserCog className="h-5 w-5 mr-2" />,
      path: "/personnelmanagement",
    },
    {
      title: t('personnel.schedule'),
      icon: <Calendar className="h-5 w-5 mr-2" />,
      path: "/schedules",
    },
    {
      title: t('personnel.workHoursHistory'),
      icon: <Clock className="h-5 w-5 mr-2" />,
      path: "/work-hours-history",
    },
    {
      title: t('personnel.payroll'),
      icon: <DollarSign className="h-5 w-5 mr-2" />,
      path: "/fiche-de-paie",
    },
  ];

  const production = [
    {
      title: t('production.consumption'),
      icon: <Calculator className="h-5 w-5 mr-2" />,
      path: "/calculedeconsomation",
    },
    {
      title: t('production.tracking'),
      icon: <History className="h-5 w-5 mr-2" />,
      path: "/historiquedeconsomation",
    },
    {
      title: t('production.title'),
      icon: <History className="h-5 w-5 mr-2" />,
      path: "/suivi-production",
    },
  ];

  const Comptabilité = [
    {
      title: t('accounting.templates'),
      icon: <LayoutTemplate className="h-5 w-5 mr-2" />,
      path: "/Templates",
    },
    {
      title: t('accounting.invoiceArchive'),
      icon: <ArchiveRestore className="h-5 w-5 mr-2" />,
      path: "https://archifage.fruitsforyou.ma",
      isExternal: true,
    },
  ];

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "bg-neutral-800 text-white flex-shrink-0 h-screen flex flex-col transition-all duration-300 ease-in-out shadow-lg",
          isSidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-neutral-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Leaf className="h-6 w-6 text-green-400" />
            {isSidebarOpen && <h1 className="font-bold text-xl">Fruits For You</h1>}
          </div>
          <button
            onClick={toggleSidebar}
            className="text-neutral-400 hover:text-white focus:outline-none"
          >
            {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

        {/* User Info */}
        {user && isSidebarOpen && (
          <div className="p-4 bg-neutral-900 border-b border-neutral-700">
            <div className="text-sm text-green-400 font-medium">{user.email}</div>
            <div className="text-xs text-neutral-500 capitalize">
              {t('common.role')}: {user.role === 'comptabilite' ? t('nav.accounting') : user.role}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-2 flex-grow overflow-y-auto">
          {renderSection(t('nav.menu'), menuItems, "menu")}
          {renderSection(t('nav.admin'), adminItems, "admin")}
          {renderSection(t('nav.logistics'), logisticsItems, "logistics")}
          {renderSection(t('nav.quality'), quality, "quality")}
          {renderSection(t('nav.reception'), ReceptionItems, "reception")}
          {renderSection(t('nav.production'), production, "production")}
          {renderSection(t('nav.personnel'), personnelItems, "personnel")}
          {renderSection(t('nav.accounting'), Comptabilité, "Comptabilité")}
        </nav>

        {/* Bottom Section with Version and Info */}
        {isSidebarOpen && (
          <div className="p-2 border-t border-neutral-700 text-center text-xs text-neutral-500">
            <div>Version 0.1</div>
            <div>© 2025 Convo Bio Compliance</div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
