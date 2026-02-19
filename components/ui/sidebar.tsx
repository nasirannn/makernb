"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SubscriptionBadge } from "@/components/ui/subscription-badge";
import { Music, Music2, Library, Sparkles, Sun, LogOut, BookOpen, LogIn, Split, FileText, Disc3, Wand2, RefreshCw, Expand, PanelLeftClose, PanelLeftOpen, PencilLine, Coins, Blend, AudioLines, Ellipsis } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePricingModal } from "@/contexts/PricingModalContext";
import AuthModal from '@/components/ui/auth-modal';
import { EditNicknameDialog } from "@/components/ui/edit-nickname-dialog";

import { Tooltip } from '@/components/ui/tooltip';
import { ThemeModeToggle } from "@/components/ui/theme-mode-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { cn } from "@/lib/utils";
import { getZIndexClass } from "@/lib/z-index";
import { formatIsoDateUTC, formatLocalizedNumber } from "@/lib/locale-format";
import { getStudioFeatureDefinition, isStudioAreaPath, type StudioFeatureKey } from "@/lib/studio-features";
import { useI18n } from "@/lib/i18n/provider";

interface CommonSidebarProps {
  // 移除 isGenerating 参数，因为不再需要显示生成状态
  hideMobileNav?: boolean; // 新增：是否隐藏移动端底部导航栏
  onWidthChange?: (width: number) => void;
  collapsedWidth?: number;
  expandedWidth?: number;
}

type SidebarNavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
};

const SIDEBAR_EXPANDED_STORAGE_KEY = "makernb.sidebar.expanded";

const SIDEBAR_STUDIO_FEATURE_ORDER: StudioFeatureKey[] = [
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

const AI_TOOL_ROUTE_ITEMS = [
  {
    href: "/vocal-separation",
    labelKey: "nav.vocalSeparation",
    descriptionKey: "aiTools.vocalSeparationDescription",
  },
  {
    href: "/lyrics-generator",
    labelKey: "nav.lyricsGenerator",
    descriptionKey: "aiTools.lyricsGeneratorDescription",
  },
] as const;

const STUDIO_FEATURE_ICON_MAP: Record<StudioFeatureKey, React.ElementType> = {
  "music-generator": Music2,
  "music-extender": Expand,
  "music-cover": Disc3,
  "mashup": Blend,
  "add-track": AudioLines,
  "add-vocal": Wand2,
  "add-melody": Music,
};

const readSidebarExpandedFromStorage = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const CommonSidebar = ({
  hideMobileNav = false,
  onWidthChange,
  collapsedWidth = 72,
  expandedWidth = 224
}: CommonSidebarProps) => {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { credits, refreshCredits } = useCredits();
  const { tierCode, tierName, hasSubscription, cancelAtPeriodEnd, cancelAt, currentPeriodEnd } = useSubscription();
  const { openModal } = usePricingModal();
  const getStudioFeatureLabel = React.useCallback(
    (featureKey: StudioFeatureKey) => t(STUDIO_FEATURE_LABEL_KEYS[featureKey]),
    [t]
  );

  // 判断是否选中某个路径
  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [isRefreshingCredits, setIsRefreshingCredits] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(readSidebarExpandedFromStorage);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = React.useState(false);
  const [isCollapsedCreditsHovered, setIsCollapsedCreditsHovered] = React.useState(false);
  const [suppressCollapsedCreditsHover, setSuppressCollapsedCreditsHover] = React.useState(false);
  const collapsedCreditsHoverRef = React.useRef(false);
  const mobileNavRef = React.useRef<HTMLDivElement | null>(null);
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

  const handleOpenPricingModal = () => {
    setUserMenuOpen(false);
    openModal();
  };

  // 切换sidebar展开/收起状态
  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore localStorage write failures
      }
      return next;
    });
  };

  React.useEffect(() => {
    onWidthChange?.(isExpanded ? expandedWidth : collapsedWidth);
  }, [isExpanded, onWidthChange, expandedWidth, collapsedWidth]);

  // AI Music Tools dropdown items
  const aiMusicToolsDropdown = React.useMemo(
    () =>
      AI_TOOL_ROUTE_ITEMS.map((item) => ({
        href: item.href,
        label: t(item.labelKey),
        description: t(item.descriptionKey),
        icon: item.href === "/vocal-separation"
          ? <Split className="h-4 w-4" />
          : <FileText className="h-4 w-4" />
      })),
    [t]
  );
  // 处理积分刷新
  const handleRefreshCredits = async () => {
    if (isRefreshingCredits) return;
    
    setIsRefreshingCredits(true);
    try {
      await refreshCredits();
    } catch (error) {
      console.error('Failed to refresh credits:', error);
    } finally {
      setIsRefreshingCredits(false);
    }
  };

  const handleCollapsedRefreshCredits = async () => {
    if (isRefreshingCredits) return;
    await handleRefreshCredits();
    setSuppressCollapsedCreditsHover(collapsedCreditsHoverRef.current);
  };

  // 点击外部关闭用户菜单和下拉菜单
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const userMenuContainer = document.querySelector('.user-menu-container');
      const dropdownContainer = document.querySelector('.dropdown-container');
      
      // 检查是否点击在菜单项上
      const clickedElement = event.target as Element;
      const isMenuLink = clickedElement?.closest('a[href]') || clickedElement?.closest('button');
      
      if (userMenuOpen && userMenuContainer && !userMenuContainer.contains(event.target as Node) && !isMenuLink) {
        setUserMenuOpen(false);
      }
      
      if (isDropdownOpen && dropdownContainer && !dropdownContainer.contains(event.target as Node) && !isMenuLink) {
        setIsDropdownOpen(false);
      }
    };

    if (userMenuOpen || isDropdownOpen) {
      // 使用 setTimeout 延迟添加事件监听器，避免立即触发
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [userMenuOpen, isDropdownOpen]);

  const studioFeatureNavItems: SidebarNavItem[] = React.useMemo(() => {
    const featureItems = SIDEBAR_STUDIO_FEATURE_ORDER.map((featureKey) => {
      const feature = getStudioFeatureDefinition(featureKey);
      return {
        label: getStudioFeatureLabel(featureKey),
        href: feature.path,
        icon: STUDIO_FEATURE_ICON_MAP[featureKey],
      };
    });

    return [...featureItems, { label: t("nav.library"), href: "/library", icon: Library }];
  }, [getStudioFeatureLabel, t]);

  const exploreNavItems: SidebarNavItem[] = React.useMemo(() => ([
    { label: t("nav.explore"), href: "/explore", icon: Sparkles },
    { label: t("nav.blog"), href: "/blog", icon: BookOpen }
  ]), [t]);

  const aiToolNavItems: SidebarNavItem[] = React.useMemo(
    () =>
      AI_TOOL_ROUTE_ITEMS.map((item) => ({
        label: t(item.labelKey),
        href: item.href,
        icon: item.href === "/vocal-separation" ? Split : FileText,
      })),
    [t]
  );

  const expandedButtonClasses = (active: boolean) =>
    cn(
      "group w-full h-11 flex items-center justify-start gap-3 rounded-2xl px-3.5 transition-colors duration-200",
      active
        ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
        : "text-foreground/60 hover:bg-accent hover:text-accent-foreground"
    );

  const collapsedButtonClasses = (active: boolean) =>
    cn(
      "group relative w-11 h-11 flex items-center justify-center rounded-2xl border border-transparent transition-colors duration-200",
      active
        ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary"
        : "text-foreground/60 hover:bg-accent hover:text-accent-foreground"
    );

  const renderNavButton = (item: SidebarNavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    if (isExpanded) {
      return (
        <Button
          key={item.href}
          onClick={() => router.push(item.href)}
          variant="ghost"
          size="sm"
          className={expandedButtonClasses(active)}
        >
          <Icon
            className={cn(
              "h-5 w-5 flex-shrink-0 transition-colors",
              active
                ? "text-primary group-hover:text-primary"
                : "text-foreground/60 group-hover:text-accent-foreground"
            )}
          />
          <div className="flex-1 text-left">
            <span className="text-sm font-medium">{item.label}</span>
          </div>
          {item.badge && (
            <Badge variant="outline" className="text-xs uppercase tracking-wide border-black/15 text-foreground/70">
              {item.badge}
            </Badge>
          )}
        </Button>
      );
    }

    return (
      <Tooltip key={item.href} content={item.label} position="right">
        <Button
          onClick={() => router.push(item.href)}
          variant="ghost"
          size="sm"
          className={collapsedButtonClasses(active)}
        >
          <Icon
            className={cn(
              "h-5 w-5 transition-colors",
              active ? "text-primary" : "text-foreground/60 group-hover:text-foreground"
            )}
          />
          <span className="sr-only">{item.label}</span>
        </Button>
      </Tooltip>
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // 动态测量移动端底部导航高度，设置 CSS 变量 --mobile-nav-height
  React.useEffect(() => {
    const updateNavHeight = () => {
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
      const el = mobileNavRef.current;
      const height = (!isDesktop && el && !hideMobileNav) ? el.offsetHeight : 0;
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--mobile-nav-height', `${height}px`);
      }
    };

    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);
    return () => window.removeEventListener('resize', updateNavHeight);
  }, [hideMobileNav]);

  return (
    <>
      <div
        className={`hidden md:flex fixed left-0 top-0 bottom-0 h-screen ${getZIndexClass('SIDEBAR')} flex-col ${
          isExpanded ? 'w-56' : 'w-[72px]'
        }`}
      >
        <div className="flex h-full flex-col backdrop-blur-md">
          <div className="flex h-full flex-col">
            {/* Home Button */}
            <div className={`flex items-center h-[72px] px-4 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
              {isExpanded ? (
                <>
                  <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                    <Image
                      src="/logo.svg"
                      alt={t("common.brandLogo")}
                      width={32}
                      height={32}
                      className="h-8 w-8"
                    />
                    <span className="sidebar-brand">MakeRNB</span>
                  </Link>
                  <Button
                    onClick={toggleSidebar}
                    variant="ghost"
                    size="sm"
                    className="w-8 h-8 p-0 flex items-center justify-center rounded-xl text-foreground/60 hover:bg-black/5 hover:text-foreground"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Tooltip content={t("nav.expandSidebar")} position="right">
                  <Button
                    onClick={toggleSidebar}
                    variant="ghost"
                    size="sm"
                    className="group relative w-11 h-11 flex items-center justify-center rounded-2xl text-foreground/60 hover:bg-black/5 hover:text-foreground"
                  >
                    <span className="absolute inset-0 flex items-center justify-center transition-opacity duration-150 group-hover:opacity-0 group-focus:opacity-0">
                      <Image
                        src="/logo.svg"
                        alt={t("common.brandLogo")}
                        width={28}
                        height={28}
                        className="h-7 w-7"
                      />
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
                      <PanelLeftOpen className="h-5 w-5" />
                    </span>
                    <span className="sr-only">{t("nav.expandSidebarSrOnly")}</span>
                  </Button>
                </Tooltip>
              )}
            </div>

            <div className={`${isExpanded ? 'px-4 pt-1 pb-1' : 'px-2 pt-1 pb-1'} flex flex-col gap-2`}>
              {user ? (
                <>
                  {isExpanded ? (
                    <div className="relative user-menu-container z-[40]">
                      <Button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        variant="ghost"
                        size="sm"
                        className="w-full h-14 rounded-2xl bg-transparent hover:bg-muted/60 flex items-center gap-3 px-4"
                      >
                        <Avatar className="w-9 h-9 flex-shrink-0">
                          <AvatarImage
                            src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                            alt={t("common.userAvatar")}
                          />
                          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-700 text-white font-semibold text-base">
                            {displayName?.charAt(0)?.toUpperCase() ||
                             user.email?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">
                              {displayName || user.email}
                            </div>
                            <div className="mt-0.5 text-sm font-medium tracking-normal text-muted-foreground truncate">
                              {tierName}
                            </div>
                          </div>
                          <Ellipsis className="h-4 w-4 flex-shrink-0 text-foreground/45" aria-hidden="true" />
                        </div>
                      </Button>

                      {userMenuOpen && (
                        <div className="absolute top-0 left-full ml-5 min-w-52 w-max bg-background border border-black/10 rounded-2xl p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.12)] z-[110]">
                          <div className="px-2.5 py-1.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-foreground font-semibold text-sm truncate flex-1">
                                {displayName || t("common.user")}
                              </p>
                              <button
                                type="button"
                                onClick={handleOpenPricingModal}
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
                            <p className="text-muted-foreground text-sm truncate">
                              {user.email}
                            </p>
                          </div>

                          <div className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-primary">
                                <Coins className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-sm font-medium text-foreground">{t("common.credits")}</span>
                            </div>
                            <span className="min-w-6 text-right text-xs font-semibold text-foreground tabular-nums">
                              {credits === null ? '...' : formatLocalizedNumber(credits)}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setIsNicknameDialogOpen(true);
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground transition-colors"
                          >
                            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-foreground/70">
                              <PencilLine className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-foreground font-medium text-sm">{t("common.editProfile")}</span>
                          </button>
                          <button
                            onClick={() => {
                              handleSignOut();
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground transition-colors"
                          >
                            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-foreground/70">
                              <LogOut className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-foreground font-medium text-sm">{t("common.signOut")}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative user-menu-container z-[40] flex h-14 items-center justify-center">
                      <Avatar
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="w-9 h-9 cursor-pointer"
                      >
                        <AvatarImage
                          src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                          alt={t("common.userAvatar")}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-700 text-white font-semibold">
                          {displayName?.charAt(0)?.toUpperCase() ||
                           user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {userMenuOpen && (
                        <div className="absolute top-0 left-full ml-3 min-w-52 w-max bg-background border border-black/10 rounded-2xl p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.12)] z-[110]">
                          <div className="px-2.5 py-1.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="text-sm font-semibold text-foreground truncate flex-1">
                                {displayName || t("common.user")}
                              </div>
                              <button
                                type="button"
                                onClick={handleOpenPricingModal}
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
                            <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                          </div>

                          <div className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-primary">
                                <Coins className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-sm font-medium text-foreground">{t("common.credits")}</span>
                            </div>
                            <span className="min-w-6 text-right text-xs font-semibold text-foreground tabular-nums">
                              {credits === null ? '...' : formatLocalizedNumber(credits)}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setIsNicknameDialogOpen(true);
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground transition-colors"
                          >
                            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-foreground/70">
                              <PencilLine className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-foreground font-medium text-sm">{t("common.editProfile")}</span>
                          </button>
                          <button
                            onClick={() => {
                              handleSignOut();
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground transition-colors"
                          >
                            <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-foreground/70">
                              <LogOut className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-foreground font-medium text-sm">{t("common.signOut")}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {isExpanded ? (
                    <Button
                      onClick={() => setIsAuthModalOpen(true)}
                      variant="ghost"
                      size="sm"
                      className="w-full h-12 rounded-2xl bg-muted/40 text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                    >
                      <LogIn className="h-5 w-5" />
                      <span className="text-sm font-medium">{t("common.signIn")}</span>
                    </Button>
                  ) : (
                    <div className="flex justify-center">
                      <Tooltip content={t("common.signIn")} position="right">
                        <Button
                          onClick={() => setIsAuthModalOpen(true)}
                          variant="ghost"
                          size="sm"
                          className={collapsedButtonClasses(false)}
                        >
                          <LogIn className="h-5 w-5" />
                        </Button>
                      </Tooltip>
                    </div>
                  )}
                </>
              )}
              </div>

            <div className={`flex-1 overflow-y-auto overflow-x-visible ${isExpanded ? 'px-4' : 'px-2'} pt-0 pb-6`}>
              <div className={`rounded-[28px] p-0 ${isExpanded ? '' : 'flex flex-col items-center'}`}>
                <div className={`flex flex-col ${isExpanded ? 'gap-2' : 'gap-2 items-center'}`}>
                  {studioFeatureNavItems.map(renderNavButton)}
                  {aiToolNavItems.map(renderNavButton)}
                  {exploreNavItems.map(renderNavButton)}
                </div>
              </div>
            </div>

            <div className={`border-t border-dashed border-black/5 dark:border-white/5 ${isExpanded ? 'px-4 pt-4 pb-6' : 'px-2 pt-4 pb-6'} flex flex-col gap-2`}>
              {user && (
                <>
                  {isExpanded ? (
                    <>
                    {!hasSubscription && (
                      <div className="relative w-full overflow-hidden rounded-2xl bg-primary/90 px-4 py-3 text-left text-primary-foreground shadow-[0_12px_32px_hsl(var(--primary)/0.25)]">
                        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,hsl(var(--primary-foreground)/0.35),transparent_60%)]" />
                        <div className="relative flex flex-col gap-1">
                          <p className="text-sm text-primary-foreground/80">
                            {t("common.unlockFullAccess")}
                          </p>
                          <Button
                            asChild
                            className="mt-1 h-9 w-full rounded-full bg-primary-foreground text-primary text-sm font-semibold hover:bg-primary-foreground/90"
                          >
                            <Link href="/pricing">{t("common.upgradeNow")}</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                  ) : (
                    <div className="relative group w-full">
                      <div
                        onMouseEnter={() => {
                          collapsedCreditsHoverRef.current = true;
                          setIsCollapsedCreditsHovered(true);
                        }}
                        onMouseLeave={() => {
                          collapsedCreditsHoverRef.current = false;
                          setIsCollapsedCreditsHovered(false);
                          setSuppressCollapsedCreditsHover(false);
                        }}
                        className={`w-full h-14 rounded-2xl px-2 py-3 text-foreground transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 ${
                          isRefreshingCredits ? 'opacity-70 cursor-wait' : 'cursor-default'
                        } flex flex-col items-center text-center`}
                      >
                        <div className="relative w-full flex items-center justify-center">
                          {isRefreshingCredits ? (
                            <div
                              aria-hidden="true"
                              className="h-9 w-9 rounded-full text-foreground/70 transition-colors flex items-center justify-center"
                            >
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            </div>
                          ) : isCollapsedCreditsHovered && !suppressCollapsedCreditsHover ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCollapsedRefreshCredits();
                              }}
                              className="h-9 w-9 rounded-full text-foreground/70 hover:text-foreground"
                              aria-label={t("common.refreshCredits")}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none text-foreground tabular-nums">
                              {credits !== null ? (
                                formatLocalizedNumber(credits)
                              ) : (
                                <span className="inline-flex h-full items-center leading-none">...</span>
                              )}
                            </span>
                          )}
                        </div>
                        {!isRefreshingCredits && (!isCollapsedCreditsHovered || suppressCollapsedCreditsHover) && (
                          <span className="mt-1 text-xs font-medium text-foreground/45">
                            {t("common.credits")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {isExpanded ? (
                <div
                  className="w-full min-h-12 rounded-2xl bg-transparent px-3 py-2 transition-all duration-300 border border-transparent hover:bg-muted/30"
                >
                  <div className="flex min-h-8 w-full items-center gap-2">
                    {user && (
                      <button
                        type="button"
                        onClick={handleRefreshCredits}
                        disabled={isRefreshingCredits}
                        className={cn(
                          "inline-flex h-9 min-w-0 max-w-[92px] items-center gap-1.5 rounded-2xl px-2.5 text-foreground/60 transition-colors",
                          "hover:bg-foreground/5 hover:text-foreground",
                          isRefreshingCredits ? "cursor-wait opacity-70" : "cursor-pointer"
                        )}
                        aria-label={t("common.refreshCredits")}
                        title={t("common.refreshCredits")}
                      >
                        {isRefreshingCredits ? (
                          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
                        ) : (
                          <Coins className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="min-w-0 truncate text-xs font-semibold leading-none tabular-nums">
                          {credits !== null ? formatLocalizedNumber(credits) : "..."}
                        </span>
                      </button>
                    )}
                    <LanguageToggle
                      size="sm"
                      className="h-9 w-9 rounded-2xl text-foreground/60 hover:text-foreground"
                    />
                    <ThemeModeToggle
                      size="sm"
                      variant="icon"
                      className="h-9 w-9 rounded-2xl text-foreground/60 hover:text-foreground"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <Tooltip content={t("common.switchLanguage")} position="right">
                    <div className="flex h-14 w-full items-center justify-center rounded-2xl transition-all duration-300 hover:bg-muted/30">
                      <LanguageToggle
                        size="md"
                        className="h-10 w-10 rounded-2xl text-foreground/60 hover:text-foreground"
                      />
                    </div>
                  </Tooltip>
                  <Tooltip content={t("common.toggleTheme")} position="right">
                    <div className="flex h-14 w-full items-center justify-center rounded-2xl transition-all duration-300 hover:bg-muted/30">
                      <ThemeModeToggle
                        size="md"
                        variant="icon"
                        className="rounded-2xl text-foreground/60 hover:text-foreground"
                      />
                    </div>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Bottom Navigation */}
      <div ref={mobileNavRef} className={`md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t-0 z-[100] transition-transform duration-300 ${hideMobileNav ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="flex items-center justify-around py-2">
          {/* Studio Button */}
          <Button
            onClick={() => router.push('/music-generator')}
            variant="ghost"
            size="sm"
            className={`h-12 w-12 flex items-center justify-center hover:bg-muted/50 transition-all duration-300 rounded-lg ${isStudioAreaPath(pathname) ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
            id="mobile-studio-nav"
          >
            <Music className="h-7 w-7" />
          </Button>

          {/* Library Button */}
          <Button
            onClick={() => router.push('/library')}
            variant="ghost"
            size="sm"
            className={`h-12 w-12 flex items-center justify-center hover:bg-muted/50 transition-all duration-300 rounded-lg ${isActive('/library') ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
          >
            <Library className="h-7 w-7" />
          </Button>

          {/* AI Music Tools Button */}
          <div className="relative dropdown-container" onClick={(e) => e.stopPropagation()}>
            <Button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              variant="ghost"
              size="sm"
              className={`h-12 w-12 flex items-center justify-center hover:bg-muted/50 transition-all duration-300 rounded-lg ${
                isActive('/vocal-separation') || isActive('/lyrics-generator')
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <Wand2 className="h-7 w-7" />
            </Button>
            
            {/* Mobile Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 min-w-48 w-max bg-background border border-border/30 rounded-lg shadow-lg p-2 z-[60]">
                {aiMusicToolsDropdown.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // 延迟关闭菜单，确保点击事件完成
                      setTimeout(() => {
                        setIsDropdownOpen(false);
                        router.push(item.href);
                      }, 50);
                    }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors group rounded-md cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center transition-colors text-primary group-hover:bg-accent-foreground/15 group-hover:text-accent-foreground">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium text-sm group-hover:text-accent-foreground">{item.label}</p>
                      <p className="text-muted-foreground text-sm truncate group-hover:text-accent-foreground/85">{item.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Blog Button */}
          <Button
            onClick={() => router.push('/blog')}
            variant="ghost"
            size="sm"
            className={`h-12 w-12 flex items-center justify-center hover:bg-muted/50 transition-all duration-300 rounded-lg ${isActive('/blog') ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
          >
            <BookOpen className="h-7 w-7" />
          </Button>
        </div>
      </div>

      {user && (
        <EditNicknameDialog
          open={isNicknameDialogOpen}
          onOpenChange={setIsNicknameDialogOpen}
          initialValue={displayName}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

    </>
  );
};
