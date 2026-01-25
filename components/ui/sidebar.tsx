"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Music, Library, Sparkles, Sun, LogOut, BookOpen, LogIn, Mic, FileText, Wand2, RefreshCw, ChevronLeft, ChevronRight, PencilLine } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useTheme } from "next-themes";
import AuthModal from '@/components/ui/auth-modal';
import { EditNicknameDialog } from "@/components/ui/edit-nickname-dialog";

import { Tooltip } from '@/components/ui/tooltip';
import { ThemeModeToggle } from "@/components/ui/theme-mode-toggle";
import { cn } from "@/lib/utils";
import { getZIndexClass } from "@/lib/z-index";

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

export const CommonSidebar = ({
  hideMobileNav = false,
  onWidthChange,
  collapsedWidth = 80,
  expandedWidth = 224
}: CommonSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { credits, refreshCredits } = useCredits();
  const { tierName, hasSubscription } = useSubscription();
  const { theme, setTheme } = useTheme();

  // 判断是否选中某个路径
  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [dropdownTimeout, setDropdownTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const [isRefreshingCredits, setIsRefreshingCredits] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = React.useState(false);
  const mobileNavRef = React.useRef<HTMLDivElement | null>(null);
  const displayName = user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';

  // 切换sidebar展开/收起状态
  const toggleSidebar = () => {
    setIsExpanded((prev) => !prev);
  };

  React.useEffect(() => {
    onWidthChange?.(isExpanded ? expandedWidth : collapsedWidth);
  }, [isExpanded, onWidthChange, expandedWidth, collapsedWidth]);

  // AI Music Tools dropdown items
const aiMusicToolsDropdown = [
  {
    href: "/vocal-remover",
    label: "Vocal Remover",
    description: "Separate vocals from music",
    icon: <Mic className="h-4 w-4" />
  },
  {
    href: "/lyrics-generator",
    label: "Lyrics Generator",
    description: "Generate creative lyrics with AI",
    icon: <FileText className="h-4 w-4" />
  }
];
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

  // 清理timeout
  React.useEffect(() => {
    return () => {
      if (dropdownTimeout) {
        clearTimeout(dropdownTimeout);
      }
    };
  }, [dropdownTimeout]);

  const workspaceNavItems: SidebarNavItem[] = React.useMemo(() => ([
    { label: "Studio", href: "/studio", icon: Music },
    { label: "Library", href: "/library", icon: Library }
  ]), []);

  const exploreNavItems: SidebarNavItem[] = React.useMemo(() => ([
    { label: "Explore", href: "/explore", icon: Sparkles },
    { label: "Blog", href: "/blog", icon: BookOpen }
  ]), []);

  const aiToolNavItems: SidebarNavItem[] = React.useMemo(() => ([
    { label: "Vocal Remover", href: "/vocal-remover", icon: Mic },
    { label: "Lyrics Generator", href: "/lyrics-generator", icon: FileText }
  ]), []);

  const expandedButtonClasses = (active: boolean) =>
    cn(
      "group w-full h-12 flex items-center justify-start gap-3 rounded-2xl px-4 transition-colors duration-200",
      active
        ? "bg-foreground/10 text-foreground shadow-[0px_12px_30px_rgba(0,0,0,0.08)] hover:bg-accent hover:text-accent-foreground"
        : "text-foreground/60 hover:bg-accent hover:text-accent-foreground"
    );

  const collapsedButtonClasses = (active: boolean) =>
    cn(
      "group relative w-12 h-12 flex items-center justify-center rounded-2xl border border-transparent transition-colors duration-200",
      active
        ? "bg-foreground/10 text-foreground shadow-[0px_12px_30px_rgba(0,0,0,0.08)] hover:bg-accent hover:text-accent-foreground"
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
                ? "text-primary group-hover:text-accent-foreground"
                : "text-foreground/60 group-hover:text-accent-foreground"
            )}
          />
          <div className="flex-1 text-left">
            <span className="text-sm font-medium">{item.label}</span>
          </div>
          {item.badge && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide border-black/15 text-foreground/70">
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
        className={`hidden md:flex fixed left-0 top-0 bottom-0 ${getZIndexClass('SIDEBAR')} h-screen flex-col transition-[width] duration-500 ${
          isExpanded ? 'w-56' : 'w-20'
        }`}
      >
        <div className="flex h-full flex-col bg-background/70 backdrop-blur-md shadow-[1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex h-full flex-col">
            {/* Home Button */}
            <div className={`flex items-center h-[72px] px-4 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
              {isExpanded ? (
                <>
                  <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                    <Image
                      src="/logo.svg"
                      alt="Logo"
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
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Tooltip content="Expand Sidebar" position="right">
                  <Button
                    onClick={toggleSidebar}
                    variant="ghost"
                    size="sm"
                    className="group relative w-12 h-12 flex items-center justify-center rounded-2xl text-foreground/60 hover:bg-black/5 hover:text-foreground"
                  >
                    <span className="absolute inset-0 flex items-center justify-center transition-opacity duration-150 group-hover:opacity-0 group-focus:opacity-0">
                      <Image
                        src="/logo.svg"
                        alt="MakerNB Logo"
                        width={28}
                        height={28}
                        className="h-7 w-7"
                      />
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
                      <ChevronRight className="h-5 w-5" />
                    </span>
                    <span className="sr-only">Expand sidebar</span>
                  </Button>
                </Tooltip>
              )}
            </div>

            <div className={`${isExpanded ? 'px-4 pt-2 pb-2' : 'px-2 pt-2 pb-2'} flex flex-col gap-3`}>
              {user ? (
                <>
                  {isExpanded ? (
                    <div className="relative user-menu-container z-[40]">
                      <Button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        variant="ghost"
                        size="sm"
                        className="w-full h-16 rounded-2xl bg-transparent hover:bg-muted/60 flex items-center gap-3 px-4"
                      >
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage
                            src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                            alt="User Avatar"
                          />
                          <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-700 text-white font-semibold text-base">
                            {displayName?.charAt(0)?.toUpperCase() ||
                             user.email?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="text-sm font-semibold text-foreground truncate flex-1">
                              {displayName || user.email}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {tierName}
                          </div>
                        </div>
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 text-foreground/40 flex-shrink-0 transition-transform duration-200",
                            userMenuOpen ? "rotate-90" : ""
                          )}
                        />
                      </Button>

                      {userMenuOpen && (
                        <div className="absolute top-0 left-full ml-3 w-56 rounded-2xl bg-background p-3 shadow-[0_18px_55px_rgba(0,0,0,0.12)]">
                          <div className="px-1 pb-2">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-foreground font-semibold text-sm truncate flex-1">
                                {displayName || user.email}
                              </p>
                              <span className="text-xs font-medium text-foreground/70">
                                {tierName}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-xs truncate">
                              {user.email}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setIsNicknameDialogOpen(true);
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-muted/40 hover:text-foreground"
                          >
                            <PencilLine className="w-4 h-4" />
                            <span>Edit profile</span>
                          </button>
                          <button
                            onClick={() => {
                              handleSignOut();
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-muted/40 hover:text-foreground"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative user-menu-container z-[40] flex h-16 items-center justify-center">
                      <Avatar
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="w-8 h-8 cursor-pointer"
                      >
                        <AvatarImage
                          src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                          alt="User Avatar"
                        />
                        <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-700 text-white font-semibold">
                          {displayName?.charAt(0)?.toUpperCase() ||
                           user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {userMenuOpen && (
                        <div className="absolute top-0 left-full ml-3 w-56 rounded-2xl bg-background shadow-[0_18px_55px_rgba(0,0,0,0.12)]">
                          <div className="p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-foreground truncate flex-1">
                                {displayName || user.email}
                              </div>
                              <span className="text-xs font-medium text-foreground/70">
                                {tierName}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                          </div>
                          <div className="p-2">
                            <button
                              onClick={() => {
                                setIsNicknameDialogOpen(true);
                                setUserMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-muted/40 hover:text-foreground"
                            >
                              <PencilLine className="w-4 h-4" />
                              <span>Edit profile</span>
                            </button>
                            <button
                              onClick={() => {
                                handleSignOut();
                                setUserMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-muted/40 hover:text-foreground"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>Sign Out</span>
                            </button>
                          </div>
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
                      <span className="text-sm font-medium">Sign In</span>
                    </Button>
                  ) : (
                    <Tooltip content="Sign In" position="right">
                      <Button
                        onClick={() => setIsAuthModalOpen(true)}
                        variant="ghost"
                        size="sm"
                        className={collapsedButtonClasses(false)}
                      >
                        <LogIn className="h-5 w-5" />
                      </Button>
                    </Tooltip>
                  )}
                </>
              )}
            </div>

            <div className={`flex-1 overflow-y-auto overflow-x-visible ${isExpanded ? 'px-4 pt-0' : 'px-2 pt-0'} pb-6`}>
              <div className={`rounded-[28px] ${isExpanded ? 'p-3' : 'p-2'} ${isExpanded ? '' : 'flex flex-col items-center'}`}>
                <div className={`flex flex-col ${isExpanded ? 'gap-2' : 'gap-3 items-center'}`}>
                  {workspaceNavItems.map(renderNavButton)}
                  {aiToolNavItems.map(renderNavButton)}
                  {exploreNavItems.map(renderNavButton)}
                </div>
              </div>
            </div>

            <div className={`border-t border-dashed border-black/5 dark:border-white/5 ${isExpanded ? 'px-4 pt-4 pb-6' : 'px-2 pt-4 pb-6'} flex flex-col gap-3`}>
              {isExpanded ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setTheme(theme === "dark" ? "light" : "dark");
                    }
                  }}
                  className="w-full h-12 rounded-2xl bg-transparent hover:bg-muted/60 px-4 flex items-center justify-between cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0"
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-foreground/60" />
                    <span className="text-sm font-medium text-foreground/60">
                      Theme
                    </span>
                  </div>
                  <ThemeModeToggle size="sm" variant="icon" className="rounded-2xl" />
                </div>
              ) : (
                <Tooltip content="Light / Dark mode" position="right">
                  <div className="flex h-12 w-full items-center justify-center rounded-2xl">
                    <ThemeModeToggle size="md" variant="icon" className="rounded-2xl" />
                  </div>
                </Tooltip>
              )}

              {user && (
                <>
                  {isExpanded ? (
                  <>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-disabled={isRefreshingCredits}
                      onClick={() => {
                        if (!isRefreshingCredits) {
                          handleRefreshCredits();
                        }
                      }}
                      onKeyDown={(event) => {
                        if (isRefreshingCredits) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleRefreshCredits();
                        }
                      }}
                      className={`w-full h-14 rounded-2xl bg-transparent px-4 py-4 text-left transition-all duration-300 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 ${
                        isRefreshingCredits ? 'opacity-70 cursor-wait' : 'hover:bg-muted/60 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center text-foreground">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-foreground/60" />
                          <span className="text-sm font-medium text-foreground/60">
                            Credits
                          </span>
                        </div>
                        <div className="relative group ml-auto flex min-w-[64px] items-center justify-end">
                          <span className="text-md font-semibold leading-none tabular-nums text-right transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0">
                            {credits !== null ? credits.toLocaleString() : '...'}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRefreshCredits();
                            }}
                            disabled={isRefreshingCredits}
                            className="absolute right-0 h-8 w-8 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-opacity duration-150 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                            aria-label="Refresh credits"
                          >
                            {isRefreshingCredits ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {!hasSubscription && (
                      <div className="relative w-full overflow-hidden rounded-2xl bg-primary/90 px-4 py-3 text-left text-primary-foreground shadow-[0_12px_32px_hsl(var(--primary)/0.25)]">
                        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,hsl(var(--primary-foreground)/0.35),transparent_60%)]" />
                        <div className="relative flex flex-col gap-1">
                          <p className="text-xs text-primary-foreground/80">
                            Unlock full access & more credits.
                          </p>
                          <Button
                            asChild
                            className="mt-1 h-9 w-full rounded-full bg-primary-foreground text-primary text-sm font-semibold hover:bg-primary-foreground/90"
                          >
                            <Link href="/#pricing">Upgrade Now</Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                  ) : (
                    <div className="relative group w-full">
                      <div
                        role="button"
                        tabIndex={0}
                        aria-disabled={isRefreshingCredits}
                        onClick={() => {
                          if (!isRefreshingCredits) {
                            handleRefreshCredits();
                          }
                        }}
                        onKeyDown={(event) => {
                          if (isRefreshingCredits) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleRefreshCredits();
                          }
                        }}
                        className={`w-full h-14 rounded-2xl px-2 py-3 text-foreground transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 ${
                          isRefreshingCredits ? 'opacity-70 cursor-wait' : 'cursor-pointer'
                        } flex flex-col items-center text-center`}
                      >
                        <div className="relative w-full">
                          <div className="transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0 flex items-center justify-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-muted/40 px-2.5 py-1 text-sm font-semibold leading-none text-foreground tabular-nums">
                              {credits !== null ? credits.toLocaleString() : '...'}
                            </span>
                          </div>

                          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                            <div
                              aria-hidden="true"
                              className="h-9 w-9 rounded-full text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors flex items-center justify-center"
                            >
                              <RefreshCw className={cn("h-4 w-4", isRefreshingCredits ? "animate-spin" : "")} />
                            </div>
                          </div>
                        </div>
                        <span className="mt-1 text-[10px] font-medium text-foreground/45">
                          Credits
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Bottom Navigation */}
      <div ref={mobileNavRef} className={`md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/30 z-[100] transition-transform duration-300 ${hideMobileNav ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="flex items-center justify-around py-2">
          {/* Studio Button */}
          <Button
            onClick={() => router.push('/studio')}
            variant="ghost"
            size="sm"
            className={`h-12 w-12 flex items-center justify-center hover:bg-muted/50 transition-all duration-300 rounded-lg ${isActive('/studio') ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
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
                isActive('/vocal-remover') || isActive('/lyrics-generator')
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
                      <p className="text-muted-foreground text-xs truncate group-hover:text-accent-foreground/85">{item.description}</p>
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
