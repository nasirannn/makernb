"use client";
import { Menu, Coins, ChevronDown, PencilLine } from "lucide-react";
import React from "react";
import { Button } from "../ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { SubscriptionBadge } from "@/components/ui/subscription-badge";
import { DesktopUserDropdown } from "@/components/layout/desktop-user-dropdown";
import AuthModal from "../ui/auth-modal";
import { LogOut } from "lucide-react";
import { getZIndexClass } from "@/lib/z-index";
import { EditNicknameDialog } from "@/components/ui/edit-nickname-dialog";
import { ThemeModeToggle } from "@/components/ui/theme-mode-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import {
  NAV_DESKTOP_RIGHT_CLASSES,
} from "@/components/layout/nav-shared-styles";
import { formatIsoDateUTC, formatLocalizedNumber } from "@/lib/locale-format";
import { getStudioFeatureDefinition, isStudioAreaPath, type StudioFeatureKey } from "@/lib/studio-features";
import { useI18n } from "@/lib/i18n/provider";
import { stripLocalePrefix, withLocalePrefix } from "@/lib/i18n/routing";
import { TopNavShell } from "@/components/layout/top-nav-shell";

interface RouteProps {
  href: string;
  label: string;
  hasDropdown?: boolean;
  dropdownKey?: DropdownKey;
  dropdownItems?: DropdownItemProps[];
}

interface DropdownItemProps {
  href: string;
  label: string;
}

type DropdownKey = "studio" | "ai";

const studioDropdownFeatureOrder: StudioFeatureKey[] = [
  "music-generator",
  "music-extender",
  "music-cover",
  "mashup",
  "add-track",
];

const STUDIO_FEATURE_LABEL_KEYS: Record<StudioFeatureKey, string> = {
  "music-generator": "studioFeatures.musicGenerator",
  "music-extender": "studioFeatures.musicExtender",
  "music-cover": "studioFeatures.musicCover",
  "mashup": "studioFeatures.mashup",
  "add-track": "studioFeatures.addTrack",
  "add-vocal": "studioFeatures.addVocal",
  "add-melody": "studioFeatures.addMelody",
};

interface NavbarProps {
  credits?: number | null;
}

export const Navbar = ({ credits = null }: NavbarProps) => {
  const { t, locale } = useI18n();
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = React.useState(false);
  const [openDropdown, setOpenDropdown] = React.useState<DropdownKey | null>(null);
  const [openMobileDropdown, setOpenMobileDropdown] = React.useState<DropdownKey | null>(null);
  const [dropdownTimeout, setDropdownTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const normalizedPathname = React.useMemo(() => stripLocalePrefix(pathname), [pathname]);
  const { user, signOut, loading: authLoading } = useAuth();
  const { tierCode, tierName, hasSubscription, cancelAtPeriodEnd, cancelAt, currentPeriodEnd } = useSubscription();
  const { openModal } = usePricingModal();
  const withCurrentLocale = React.useCallback((path: string) => withLocalePrefix(path, locale), [locale]);
  const getStudioFeatureLabel = React.useCallback(
    (featureKey: StudioFeatureKey) => t(STUDIO_FEATURE_LABEL_KEYS[featureKey]),
    [t]
  );
  const studioDropdown = React.useMemo<DropdownItemProps[]>(
    () =>
      studioDropdownFeatureOrder.map((featureKey) => {
        const feature = getStudioFeatureDefinition(featureKey);
        return {
          href: feature.path,
          label: getStudioFeatureLabel(featureKey),
        };
      }),
    [getStudioFeatureLabel]
  );
  const aiMusicToolsDropdown = React.useMemo<DropdownItemProps[]>(
    () => [
      {
        href: "/vocal-separation",
        label: t("nav.vocalSeparation"),
      },
      {
        href: "/lyrics-generator",
        label: t("nav.lyricsGenerator"),
      },
    ],
    [t]
  );
  const routeList = React.useMemo<RouteProps[]>(
    () => [
      {
        href: "#studio",
        label: t("nav.studio"),
        hasDropdown: true,
        dropdownKey: "studio",
        dropdownItems: studioDropdown,
      },
      {
        href: "/library",
        label: t("nav.library"),
      },
      {
        href: "/explore",
        label: t("nav.explore"),
      },
      {
        href: "#ai",
        label: t("nav.aiMusicTool"),
        hasDropdown: true,
        dropdownKey: "ai",
        dropdownItems: aiMusicToolsDropdown,
      },
      {
        href: "/blog",
        label: t("nav.blog"),
      },
      {
        href: "/pricing",
        label: t("nav.pricing"),
      },
    ],
    [aiMusicToolsDropdown, studioDropdown, t]
  );
  const displayName = user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const formatDisplayDate = React.useCallback((dateValue?: string | null) => {
    if (!dateValue) return null;
    return formatIsoDateUTC(dateValue);
  }, []);
  const billingNotice = React.useMemo(() => {
    if (!hasSubscription) return null;
    if (cancelAtPeriodEnd) {
      const formatted = formatDisplayDate(cancelAt);
      return formatted
        ? t("common.cancelScheduledOn", { date: formatted })
        : t("common.cancellationScheduled");
    }
    const formatted = formatDisplayDate(currentPeriodEnd);
    return formatted ? t("common.nextChargeOn", { date: formatted }) : null;
  }, [cancelAt, cancelAtPeriodEnd, currentPeriodEnd, formatDisplayDate, hasSubscription, t]);

  const handleOpenPricingModal = (options?: { closeMobileMenu?: boolean }) => {
    if (options?.closeMobileMenu) {
      setIsOpen(false);
    }
    openModal();
  };

  // 处理下拉菜单的悬停逻辑
  const handleDropdownMouseEnter = (key: DropdownKey) => {
    if (dropdownTimeout) {
      clearTimeout(dropdownTimeout);
      setDropdownTimeout(null);
    }
    setOpenDropdown(key);
  };

  const handleDropdownMouseLeave = () => {
    const timeout = setTimeout(() => {
      setOpenDropdown(null);
    }, 150); // 150ms延迟
    setDropdownTimeout(timeout);
  };

  React.useEffect(() => {
    setIsHydrated(true);
  }, []);

  // 移动端菜单打开时锁定滚动
  React.useEffect(() => {
    if (isOpen) {
      // 锁定背景滚动
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      // 恢复滚动
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    // 清理函数
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  // Close user menu and dropdown when clicking outside
  React.useEffect(() => {
    if (!isOpen) {
      setOpenMobileDropdown(null);
    }
  }, [isOpen]);

  React.useEffect(() => {
    setOpenDropdown(null);
    setOpenMobileDropdown(null);
  }, [pathname]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const inDropdownContainer = !!target?.closest('.dropdown-container');

      if (!inDropdownContainer) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);

  // 清理timeout
  React.useEffect(() => {
    return () => {
      if (dropdownTimeout) {
        clearTimeout(dropdownTimeout);
      }
    };
  }, [dropdownTimeout]);

  const handleDesktopSignOut = React.useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }, [signOut]);

  const showAuthSkeleton = !isHydrated || authLoading;

  return (
    <TopNavShell
      brandHref={withCurrentLocale("/")}
      brandAlt={t("common.brandLogo")}
      className={getZIndexClass('NAVBAR')}
      rightContent={
        <div className={NAV_DESKTOP_RIGHT_CLASSES}>
          <LanguageToggle size="md" variant="nav" />
          <ThemeModeToggle size="md" variant="icon" className="rounded-2xl" />
          {showAuthSkeleton ? (
            <div className="h-10 w-24 rounded-md bg-black/10 animate-pulse" />
          ) : user ? (
            <DesktopUserDropdown
              user={user}
              displayName={displayName}
              credits={credits}
              tierCode={tierCode}
              tierName={tierName}
              billingNotice={billingNotice}
              t={t}
              onOpenPricing={() => handleOpenPricingModal()}
              onEditProfile={() => setIsNicknameDialogOpen(true)}
              onSignOut={handleDesktopSignOut}
            />
          ) : (
            <Button 
              onClick={() => setIsAuthModalOpen(true)}
              size="default" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-base font-semibold h-10"
            >
              {t("common.signIn")}
            </Button>
          )}
        </div>
      }
    >
      
      {/* <!-- Desktop Navigation --> */}
      <nav className="hidden lg:block ml-8">
        <ul className="flex items-center space-x-2">
          {routeList.map(({ href, label, hasDropdown, dropdownItems, dropdownKey }) => {
            const isActive =
              href === "/blog" ? normalizedPathname.startsWith("/blog") :
              href === "/explore" ? normalizedPathname.startsWith("/explore") :
              hasDropdown && dropdownKey === "studio" ? isStudioAreaPath(pathname) :
              href === "/library" ? normalizedPathname.startsWith("/library") :
              hasDropdown && dropdownKey === "ai" ? (normalizedPathname.startsWith("/vocal-separation") || normalizedPathname.startsWith("/lyrics-generator")) :
              normalizedPathname === href;
            
            if (hasDropdown && dropdownItems && dropdownKey) {
              const isOpenDropdown = openDropdown === dropdownKey;
              return (
                <li key={dropdownKey} className="relative dropdown-container">
                  <button
                    onClick={() => setOpenDropdown((prev) => prev === dropdownKey ? null : dropdownKey)}
                    onMouseEnter={() => handleDropdownMouseEnter(dropdownKey)}
                    onMouseLeave={handleDropdownMouseLeave}
                  className={`text-base px-5 py-3 rounded-lg transition-colors duration-200 flex items-center gap-1 font-medium ${
                      isActive
                        ? 'text-primary font-semibold'
                        : 'text-foreground/70 hover:text-foreground'
                    }`}
                  >
                    {label}
                    <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isOpenDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isOpenDropdown && (
                    <div 
                      className="absolute top-full left-0 mt-2 min-w-48 w-max bg-background rounded-2xl p-2 z-[110] shadow-[0_18px_55px_rgba(0,0,0,0.10)]"
                      onMouseEnter={() => handleDropdownMouseEnter(dropdownKey)}
                      onMouseLeave={handleDropdownMouseLeave}
                    >
                      {dropdownItems.map((item) => {
                        const isDropdownItemActive = normalizedPathname.startsWith(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={withCurrentLocale(item.href)}
                            onClick={() => setOpenDropdown(null)}
                            className={`group flex items-center px-3 py-2 my-1 transition-colors rounded-lg hover:bg-accent hover:text-accent-foreground ${
                              isDropdownItemActive
                                ? 'bg-foreground/10 text-foreground shadow-[0px_12px_30px_rgba(0,0,0,0.08)]'
                                : 'text-foreground/60'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium transition-colors group-hover:text-accent-foreground ${
                                isDropdownItemActive ? 'text-foreground' : 'text-foreground/60'
                              }`}>
                                {item.label}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            }
            
            return (
              <li key={href}>
                <Link
                  href={withCurrentLocale(href)}
                  className={`text-base px-5 py-3 rounded-lg transition-colors duration-200 font-medium ${
                    isActive
                      ? 'text-primary font-semibold'
                      : 'text-foreground/70 hover:text-foreground'
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* <!-- Mobile Menu --> */}
      <div className="flex items-center lg:hidden ml-auto">
        <Menu
          onClick={() => setIsOpen(!isOpen)}
          className="cursor-pointer lg:hidden text-foreground"
        />
        
        {isOpen && (
          <div className="fixed inset-0 lg:hidden z-[100]">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
            <div className="fixed right-0 top-0 h-full w-80 bg-card shadow-none p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <Link href={withCurrentLocale("/")} className="flex items-center" onClick={() => setIsOpen(false)}>
                  <Image
                    src="/logo.svg"
                    alt={t("common.brandLogo")}
                    width={40}
                    height={40}
                    className="mr-2"
                  />
                  <span className="font-bold text-base">MakeRNB</span>
                </Link>
                <button onClick={() => setIsOpen(false)} className="text-2xl">×</button>
              </div>
              
              <div className="flex-1 min-h-0 overflow-y-auto pb-4">
              {/* Mobile User Section */}
              {user ? (
                <div className="mb-4 pb-4">
                  {/* User Info */}
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage
                        src={user.user_metadata?.avatar_url || user.user_metadata?.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                        alt={t("common.userAvatar")}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-600 text-white font-semibold">
                        {displayName?.charAt(0)?.toUpperCase() ||
                         user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-foreground font-medium text-sm truncate flex-1">
                          {displayName || t("common.user")}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenPricingModal({ closeMobileMenu: true })}
                          className="group inline-flex items-center gap-1.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          aria-label={t("common.openPricing")}
                          title={billingNotice ?? undefined}
                        >
                          <SubscriptionBadge
                            tone={tierCode ?? "free"}
                            label={tierName}
                            tooltip={billingNotice ?? undefined}
                            className="cursor-pointer transition-colors !bg-primary !text-primary-foreground hover:!bg-primary/90 !border-primary/40 dark:!border-primary/50 !py-1"
                          />
                        </button>
                      </div>
                      <p className="text-muted-foreground text-xs truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  
                  {/* Credits Display */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5">
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    <span className="text-base font-semibold text-foreground">
                      {credits === null ? '...' : `${formatLocalizedNumber(credits)} ${t("common.credits")}`}
                    </span>
                  </div>
                  
                  {/* Mobile Menu Items */}
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setIsNicknameDialogOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground/80 hover:bg-black/5 hover:text-foreground transition-colors rounded-lg"
                    >
                      <PencilLine className="w-4 h-4" />
                      <span>{t("common.editProfile")}</span>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await signOut();
                          setIsOpen(false);
                        } catch (error) {
                          console.error('Sign out error:', error);
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground/80 hover:bg-black/5 hover:text-foreground transition-colors rounded-lg"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t("common.signOut")}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-4 pb-4">
                  <Button 
                    onClick={() => {
                      setIsAuthModalOpen(true);
                      setIsOpen(false);
                    }}
                    size="default" 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-1.5 rounded-md text-base font-semibold"
                  >
                    {t("common.signIn")}
                  </Button>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                {routeList.map(({ href, label, hasDropdown, dropdownItems, dropdownKey }) => {
                  const isActive = normalizedPathname === href ||
                                 (href === "/blog" && normalizedPathname.startsWith("/blog")) ||
                                 (href === "/explore" && normalizedPathname.startsWith("/explore")) ||
                                 (hasDropdown && dropdownKey === "studio" && isStudioAreaPath(pathname)) ||
                                 (href === "/library" && normalizedPathname.startsWith("/library")) ||
                                 (hasDropdown && dropdownKey === "ai" && (normalizedPathname.startsWith("/vocal-separation") || normalizedPathname.startsWith("/lyrics-generator")));
                  
                  if (hasDropdown && dropdownItems && dropdownKey) {
                    const isMobileDropdownOpen = openMobileDropdown === dropdownKey;
                    return (
                      <div key={dropdownKey} className="space-y-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setOpenMobileDropdown((prev) => prev === dropdownKey ? null : dropdownKey)}
                          className="w-full h-10 justify-between px-3 text-base text-foreground/80 hover:text-foreground hover:bg-transparent"
                          aria-expanded={isMobileDropdownOpen}
                        >
                          <span>{label}</span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${isMobileDropdownOpen ? 'rotate-180' : ''}`} />
                        </Button>
                        {isMobileDropdownOpen && (
                          <div className="ml-4 space-y-1">
                            {dropdownItems.map((item) => {
                              return (
                                <Button
                                  key={item.href}
                                  onClick={() => {
                                    setIsOpen(false);
                                    setOpenMobileDropdown(null);
                                  }}
                                  asChild
                                  variant="ghost"
                                  className="w-full justify-start text-sm h-auto py-1.5 px-3 my-1 hover:bg-transparent hover:text-foreground text-foreground/70"
                                >
                                  <Link href={withCurrentLocale(item.href)} className="flex items-center gap-2">
                                    <div className="font-medium">{item.label}</div>
                                  </Link>
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  return (
                    <Button
                      key={href}
                      onClick={() => {
                        setIsOpen(false);
                        setOpenMobileDropdown(null);
                      }}
                      asChild
                      variant="ghost"
                      className={`w-full h-10 justify-start px-3 text-base ${
                        isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:text-foreground'
                      }`}
                    >
                      <Link href={withCurrentLocale(href)}>{label}</Link>
                    </Button>
                  );
                })}
              </div>
              </div>
              <div className="mt-auto shrink-0 border-t border-border/20 pt-2 pb-2 px-3 bg-card">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                      {t("common.language")}
                    </div>
                    <LanguageToggle size="sm" variant="nav" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                      {t("common.theme")}
                    </div>
                    <ThemeModeToggle size="md" variant="icon" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

      {user && (
        <EditNicknameDialog
          open={isNicknameDialogOpen}
          onOpenChange={setIsNicknameDialogOpen}
          initialValue={displayName}
        />
      )}

    </TopNavShell>
  );
};
