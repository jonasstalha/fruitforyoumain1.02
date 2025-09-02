import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/contexts/LanguageContext";
import { Menu, Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import Sidebar from "./sidebar";
import { useLocation } from "wouter";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, navigate] = useLocation();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <>
      <header className="bg-white shadow-sm flex justify-between items-center p-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">{title}</h1>
          {subtitle && <p className="text-neutral-500">{subtitle}</p>}
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate('/communication-dashboard')}
            title={t('common.notifications')}
          >
            <Bell className="h-5 w-5" />
          </Button>

          <LanguageSwitcher />

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleMobileMenu}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Mobile sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={toggleMobileMenu}
          ></div>
          <div className="fixed top-0 left-0 bottom-0 w-64 bg-neutral-800">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 text-white"
              onClick={toggleMobileMenu}
            >
              <X className="h-5 w-5" />
            </Button>
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
