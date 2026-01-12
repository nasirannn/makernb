"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Music, Library, Sparkles, LogOut, BookOpen, LogIn, Mic, FileText, Wand2, RefreshCw, ChevronLeft, ChevronRight, PencilLine } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import AuthModal from '@/components/ui/auth-modal';
import { EditNicknameDialog } from "@/components/ui/edit-nickname-dialog";
import { supabase } from '@/lib/supabase';

import { Tooltip } from '@/components/ui/tooltip';
import { ThemeModeToggle } from "@/components/ui/theme-mode-toggle";
import { SubscriptionBadge } from "@/components/ui/subscription-badge";

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
  const [tierCode, setTierCode] = React.useState<'basic' | 'premium' | null>(null);
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

  // 处理下拉菜单的悬停逻辑
  const handleDropdownMouseEnter = () => {
    if (dropdownTimeout) {
      clearTimeout(dropdownTimeout);
      setDropdownTimeout(null);
    }
    setIsDropdownOpen(true);
  };

  const handleDropdownMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 150); // 150ms延迟
    setDropdownTimeout(timeout);
  };

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
    `group w-full h-12 flex items-center justify-start gap-3 rounded-2xl px-4 transition-all duration-300 ${
      active
        ? 'bg-black/5 text-foreground shadow-[0px_12px_30px_rgba(0,0,0,0.08)]'
        : 'text-foreground/60 hover:text-foreground hover:bg-black/5'
    }`;

  const collapsedButtonClasses = (active: boolean) =>
    `group relative w-12 h-12 flex items-center justify-center rounded-2xl border border-transparent transition-all duration-300 ${
      active
        ? 'bg-black/5 text-foreground shadow-[0px_12px_30px_rgba(0,0,0,0.08)]'
        : 'text-foreground/60 hover:text-foreground hover:bg-black/5'
    }`;

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
          <Icon className="h-5 w-5 flex-shrink-0" />
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
          <Icon className="h-5 w-5" />
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

  // 获取用户订阅信息
  React.useEffect(() => {
    const fetchUserSubscription = async () => {
      if (!user) {
        setTierCode(null);
        return;
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          setTierCode(null);
          return;
        }

        const response = await fetch('/api/user-subscription', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // 只有当 tierCode 不为 null 时才设置（有活跃订阅）
          setTierCode(data.tierCode || null);
        } else {
          setTierCode(null);
        }
      } catch (error) {
        console.error('Failed to fetch user subscription:', error);
        setTierCode(null);
      }
    };

    // 延迟获取，确保session已准备好
    const timer = setTimeout(() => {
      fetchUserSubscription();
    }, 1000);

    return () => clearTimeout(timer);
  }, [user]);

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
        className={`hidden md:flex fixed left-0 top-0 bottom-0 z-[55] h-screen flex-col transition-[width] duration-500 ${
          isExpanded ? 'w-56' : 'w-20'
        }`}
      >
        <div className="flex h-full flex-col bg-background/70 backdrop-blur-md shadow-[1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex h-full flex-col">
            {/* Home Button */}
            <div className={`flex items-center min-h-[72px] ${isExpanded ? 'px-5 pt-6 pb-4 justify-between' : 'px-2 py-5 justify-center'}`}>
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
                    className="w-12 h-12 flex items-center justify-center rounded-2xl text-foreground/60 hover:bg-black/5 hover:text-foreground"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </Tooltip>
              )}
            </div>

            <div className={`flex-1 overflow-y-auto overflow-x-visible ${isExpanded ? 'px-4 pt-4' : 'px-2 pt-4'} pb-6 space-y-4`}>
              <div className={`rounded-[28px] bg-black/[0.03] ${isExpanded ? 'p-3' : 'p-2 flex flex-col items-center gap-3'}`}>
                {isExpanded && (
                  <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.35em] text-foreground/50">Workspace</p>
                )}
                <div className={`flex flex-col ${isExpanded ? 'gap-2' : 'gap-3 items-center'}`}>
                  {workspaceNavItems.map(renderNavButton)}
                </div>
              </div>

              <div className={`rounded-[28px] bg-black/[0.03] ${isExpanded ? 'p-3' : 'p-2 flex flex-col items-center gap-3'}`}>
                {isExpanded && (
                  <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.35em] text-foreground/50">AI MUSIC Tools</p>
                )}
                <div className={`flex flex-col ${isExpanded ? 'gap-2' : 'gap-3 items-center'}`}>
                  {aiToolNavItems.map(renderNavButton)}
                </div>
              </div>

              <div className={`rounded-[28px] bg-black/[0.03] ${isExpanded ? 'p-3' : 'p-2 flex flex-col items-center gap-3'}`}>
                {isExpanded && (
                  <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.35em] text-foreground/50">Explore</p>
                )}
                <div className={`flex flex-col ${isExpanded ? 'gap-2' : 'gap-3 items-center'}`}>
                  {exploreNavItems.map(renderNavButton)}
                </div>
              </div>
            </div>

            <div className={`border-t border-black/10 ${isExpanded ? 'px-4 pt-4 pb-6' : 'px-2 pt-4 pb-6'} flex flex-col gap-3`}>
              {isExpanded ? (
                <div className="w-full rounded-2xl bg-black/[0.03] px-4 py-3 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-[0.4em] text-foreground/55">
                      Theme
                    </span>
                    <span className="text-sm font-semibold leading-none text-foreground/90">
                      Light / Dark
                    </span>
                  </div>
                  <ThemeModeToggle size="md" className="rounded-2xl" />
                </div>
              ) : (
                <Tooltip content="Light / Dark mode" position="right">
                  <div className="flex justify-center">
                    <ThemeModeToggle size="md" className="rounded-2xl h-12 w-12 bg-black/[0.03]" />
                  </div>
                </Tooltip>
              )}

              {user && (
                <>
                  {isExpanded ? (
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
                    className={`w-full rounded-2xl bg-black/[0.03] px-4 py-4 text-left transition-all duration-300 border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-0 ${
                      isRefreshingCredits ? 'opacity-70 cursor-wait' : 'hover:bg-black/5 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between text-foreground">
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium uppercase tracking-[0.4em] text-foreground/55">
                          Credits
                        </span>
                        <span className="text-lg font-semibold leading-none">
                          {credits !== null ? credits.toLocaleString() : '...'}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRefreshCredits();
                        }}
                        disabled={isRefreshingCredits}
                        className="h-8 w-8 rounded-xl border border-black/10 bg-black/5 text-foreground hover:bg-black/10"
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
                  ) : (
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
                      className={`w-full rounded-2xl px-2 py-3 text-foreground transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-0 ${
                        isRefreshingCredits ? 'opacity-70 cursor-wait' : 'cursor-pointer'
                      } flex flex-col items-center text-center`}
                    >
                      <span className="block text-sm font-semibold leading-tight">
                        {credits !== null ? credits.toLocaleString() : '...'}
                      </span>
                      <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.35em] text-foreground/55">
                        Credits
                      </span>
                    </div>
                  )}
                </>
              )}

              {user ? (
                <>
                  {isExpanded ? (
                    <div className="relative user-menu-container z-[40]">
                      <Button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        variant="ghost"
                        size="sm"
                        className="w-full h-16 rounded-2xl bg-black/[0.03] hover:bg-black/5 flex items-center gap-3 px-4"
                      >
                        <Avatar className="w-10 h-10 flex-shrink-0">
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
                            {tierCode && (
                              <SubscriptionBadge tier={tierCode} />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </div>
                        </div>
                      </Button>

                      {userMenuOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl bg-background border border-black/10 p-3 shadow-[0_18px_55px_rgba(0,0,0,0.12)]">
                          <button
                            onClick={() => {
                              setIsNicknameDialogOpen(true);
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground"
                          >
                            <PencilLine className="w-4 h-4" />
                            <span>Edit profile</span>
                          </button>
                          <button
                            onClick={() => {
                              handleSignOut();
                              setUserMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative user-menu-container z-[40] flex justify-center">
                      <Avatar
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="w-10 h-10 cursor-pointer"
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
                        <div className="absolute bottom-0 left-full ml-3 w-56 rounded-2xl bg-background border border-black/10 shadow-[0_18px_55px_rgba(0,0,0,0.12)]">
                          <div className="p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-foreground truncate flex-1">
                                {displayName || user.email}
                              </div>
                              {tierCode && (
                                <SubscriptionBadge tier={tierCode} />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                          </div>
                          <div className="p-2">
                            <button
                              onClick={() => {
                                setIsNicknameDialogOpen(true);
                                setUserMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground"
                            >
                              <PencilLine className="w-4 h-4" />
                              <span>Edit profile</span>
                            </button>
                            <button
                              onClick={() => {
                                handleSignOut();
                                setUserMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground"
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
                      className="w-full h-12 rounded-2xl bg-black/[0.03] text-foreground/80 hover:bg-black/5"
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
                    className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors group rounded-md cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center group-hover:bg-primary/30 transition-colors text-primary">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium text-sm">{item.label}</p>
                      <p className="text-muted-foreground text-xs truncate">{item.description}</p>
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
