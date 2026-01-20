"use client";
import { Menu, Sparkles, ChevronDown, Mic, FileText, PencilLine } from "lucide-react";
import React from "react";
import { Button } from "../ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import AuthModal from "../ui/auth-modal";
import { LogOut } from "lucide-react";
import { getZIndexClass } from "@/lib/z-index";
import { EditNicknameDialog } from "@/components/ui/edit-nickname-dialog";
import { ThemeModeToggle } from "@/components/ui/theme-mode-toggle";
import { SubscriptionBadge } from "@/components/ui/subscription-badge";

interface RouteProps {
  href: string;
  label: string;
  hasDropdown?: boolean;
  dropdownItems?: DropdownItemProps[];
}

interface DropdownItemProps {
  href: string;
  label: string;
}

const aiMusicToolsDropdown: DropdownItemProps[] = [
  {
    href: "/vocal-remover",
    label: "Vocal Remover",
  },
  {
    href: "/lyrics-generator",
    label: "Lyrics Generator",
  }
];

const routeList: RouteProps[] = [
  {
    href: "/studio",
    label: "Studio",
  },
  {
    href: "/library",
    label: "Library",
  },
  {
    href: "#",
    label: "AI Music Tool",
    hasDropdown: true,
    dropdownItems: aiMusicToolsDropdown,
  },
  {
    href: "/blog",
    label: "Blog",
  },
  {
    href: "/#pricing",
    label: "Pricing",
  },
];

interface NavbarProps {
  credits?: number | null;
}

export const Navbar = ({ credits = null }: NavbarProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [dropdownTimeout, setDropdownTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHome = pathname === "/";
  const { user, signOut, loading: authLoading } = useAuth();
  const { tierCode } = useSubscription();
  const displayName = user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';

  // 处理 Pricing 链接的跳转和滚动
  const handlePricingClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === '/') {
      // 如果已经在首页，阻止默认行为并平滑滚动
      e.preventDefault();
      const pricingElement = document.getElementById('pricing');
      if (pricingElement) {
        pricingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    // 如果不在首页，让 Link 组件正常处理导航
    // 跨页面跳转后，通过 useEffect 处理滚动
  };

  // 处理跨页面跳转后的滚动（当 URL 包含 #pricing hash 时）
  React.useEffect(() => {
    if (pathname === '/' && window.location.hash === '#pricing') {
      // 等待页面渲染完成后滚动
      setTimeout(() => {
        const pricingElement = document.getElementById('pricing');
        if (pricingElement) {
          pricingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // 清除 hash 以避免刷新时重复滚动
          window.history.replaceState(null, '', window.location.pathname);
        }
      }, 100);
    }
  }, [pathname]);

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

  React.useEffect(() => {
    const handleScroll = () => {
      // 滚动时关闭用户菜单
      if (isUserMenuOpen) {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isUserMenuOpen]);

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
    const handleClickOutside = (event: MouseEvent) => {
      const userMenuContainer = document.querySelector('.user-menu-container');
      const dropdownContainer = document.querySelector('.dropdown-container');
      
      if (userMenuContainer && !userMenuContainer.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      
      if (dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isUserMenuOpen || isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen, isDropdownOpen]);

  // 清理timeout
  React.useEffect(() => {
    return () => {
      if (dropdownTimeout) {
        clearTimeout(dropdownTimeout);
      }
    };
  }, [dropdownTimeout]);

  return (
    <header 
      className={`w-full flex items-center px-6 lg:px-20 py-3 lg:py-4 absolute top-0 left-0 backdrop-blur-md text-foreground shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)] ${getZIndexClass('NAVBAR')} ${
        // Home should match the same page background tone as other sections (not a gray overlay).
        isHome ? "bg-[#f7f6f2] dark:bg-[#05060b]" : "bg-background/70"
      }`}
    >
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/logo.svg"
          alt="MakeRNB Logo"
          width={36}
          height={36}
          className="h-9 w-9"
        />
        <span className="sidebar-brand">MakeRNB</span>
      </Link>
      
      {/* <!-- Desktop Navigation --> */}
      <nav className="hidden lg:block ml-8">
        <ul className="flex items-center space-x-2">
          {routeList.map(({ href, label, hasDropdown, dropdownItems }) => {
            const hasTrackParam = pathname === "/studio" && Boolean(searchParams?.get("track"));
            const isActive =
              href === "/blog" ? pathname.startsWith("/blog") :
              href === "/explore" ? pathname.startsWith("/explore") :
              href === "/studio" ? pathname.startsWith("/studio") && !hasTrackParam :
              href === "/library" ? pathname.startsWith("/library") :
              href === "#" ? (pathname.startsWith("/vocal-remover") || pathname.startsWith("/lyrics-generator")) :
              pathname === href;
            
            if (hasDropdown && dropdownItems) {
              return (
                <li key={href} className="relative dropdown-container">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    onMouseEnter={handleDropdownMouseEnter}
                    onMouseLeave={handleDropdownMouseLeave}
                  className={`text-base px-5 py-3 rounded-lg transition-colors duration-200 flex items-center gap-1 font-semibold ${
                      isActive
                        ? 'text-primary'
                        : 'text-foreground/70 hover:text-foreground'
                    }`}
                  >
                    {label}
                    <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <div 
                      className="absolute top-full left-0 mt-2 min-w-48 w-max bg-background rounded-2xl p-2 z-[110] shadow-[0_18px_55px_rgba(0,0,0,0.10)]"
                      onMouseEnter={handleDropdownMouseEnter}
                      onMouseLeave={handleDropdownMouseLeave}
                    >
                      {dropdownItems.map((item) => {
                        const isDropdownItemActive = pathname.startsWith(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsDropdownOpen(false)}
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
                  href={href}
                  onClick={href === "/#pricing" ? handlePricingClick : undefined}
                  className={`text-base px-5 py-3 rounded-lg transition-colors duration-200 font-semibold ${
                    isActive
                      ? 'text-primary'
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
            <div className="fixed right-0 top-0 h-full w-80 bg-card shadow-[-1px_0_0_rgba(0,0,0,0.08)] p-6">
              <div className="flex items-center justify-between mb-6">
                <Link href="/" className="flex items-center" onClick={() => setIsOpen(false)}>
                  <Image
                    src="/logo.svg"
                    alt="MakeRNB Logo"
                    width={40}
                    height={40}
                    className="mr-2"
                  />
                  <span className="font-bold text-base">MakeRNB</span>
                </Link>
                <button onClick={() => setIsOpen(false)} className="text-2xl">×</button>
              </div>
              
              {/* Mobile User Section */}
              {user ? (
                <div className="mb-6 pb-6 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                  {/* User Info */}
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="w-10 h-10 border border-purple-600/30">
                      <AvatarImage
                        src={user.user_metadata?.avatar_url || user.user_metadata?.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                        alt="User Avatar"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-600 text-white font-semibold">
                        {displayName?.charAt(0)?.toUpperCase() ||
                         user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-foreground font-medium text-sm truncate flex-1">
                          {displayName || 'User'}
                        </p>
	                        {tierCode && (
	                          <SubscriptionBadge tier={tierCode} />
	                        )}
                      </div>
                      <p className="text-muted-foreground text-xs truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  
                  {/* Credits Display */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-base font-semibold text-foreground">
                      {credits === null ? '...' : credits} Credits
                    </span>
                  </div>
                  
                  {/* Mobile Menu Items */}
                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setIsNicknameDialogOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground/80 hover:bg-black/5 hover:text-foreground transition-colors rounded-lg"
                    >
                      <PencilLine className="w-4 h-4" />
                      <span>Edit profile</span>
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
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-6 pb-6 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                  <Button 
                    onClick={() => {
                      setIsAuthModalOpen(true);
                      setIsOpen(false);
                    }}
                    size="default" 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-1.5 rounded-md text-base font-semibold"
                  >
                    Sign In
                  </Button>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <div className="px-3 pt-2 pb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground mb-2">
                    Theme
                  </div>
                  <ThemeModeToggle size="md" />
                </div>
                {routeList.map(({ href, label, hasDropdown, dropdownItems }) => {
                  const isActive = pathname === href ||
                                 (href === "/blog" && pathname.startsWith("/blog")) ||
                                 (href === "/explore" && pathname.startsWith("/explore")) ||
                                 (href === "/studio" && pathname.startsWith("/studio")) ||
                                 (href === "/library" && pathname.startsWith("/library")) ||
                                 (href === "#" && (pathname.startsWith("/vocal-remover") || pathname.startsWith("/lyrics-generator")));
                  
                  if (hasDropdown && dropdownItems) {
                    return (
                      <div key={href} className="space-y-1">
                        <div className={`text-sm px-3 py-2 rounded-lg font-medium ${
                          isActive ? 'bg-primary/10 text-primary' : 'text-foreground/70'
                        }`}>
                          {label}
                        </div>
                        <div className="ml-4 space-y-1">
                          {dropdownItems.map((item) => {
                            const isDropdownItemActive = pathname.startsWith(item.href);
                            return (
                              <Button
                                key={item.href}
                                onClick={() => setIsOpen(false)}
                                asChild
                                variant="ghost"
                              className={`justify-start text-sm h-auto py-2 px-3 my-1 hover:bg-accent hover:text-accent-foreground ${
                                isDropdownItemActive
                                  ? 'bg-foreground/10 text-foreground shadow-[0px_12px_30px_rgba(0,0,0,0.08)] font-medium'
                                  : 'text-foreground/60'
                              }`}
                              >
                                <Link href={item.href} className="flex items-center gap-2">
                                  <div>
                                    <div className="font-medium">{item.label}</div>
                                  </div>
                                </Link>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <Button
                      key={href}
                      onClick={() => {
                        setIsOpen(false);
                        // 如果是 pricing 链接且已在首页，平滑滚动
                        if (href === "/#pricing" && pathname === '/') {
                          setTimeout(() => {
                            const pricingElement = document.getElementById('pricing');
                            if (pricingElement) {
                              pricingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }, 100);
                        }
                      }}
                      asChild
                      variant="ghost"
                      className={`justify-start text-base ${
                        isActive ? 'bg-primary/10 text-primary font-medium' : ''
                      }`}
                    >
                      <Link href={href}>{label}</Link>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* <!-- Desktop Right Side --> */}
      <div className="hidden lg:flex ml-auto items-center gap-4">
        <ThemeModeToggle />
        {authLoading ? (
          <div className="h-10 w-24 rounded-md bg-black/10 animate-pulse" />
        ) : user ? (
          <>
            <div 
              className="relative user-menu-container"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
            {/* User Avatar */}
            <Avatar 
              className="w-10 h-10 cursor-pointer hover:scale-105 transition-transform duration-200 border-2 border-purple-600/30"
            >
              <AvatarImage
                src={user.user_metadata?.avatar_url || user.user_metadata?.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                alt="User Avatar"
              />
              <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-600 text-white font-semibold text-sm">
                {displayName?.charAt(0)?.toUpperCase() ||
                 user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div 
    className="absolute right-0 top-12 min-w-52 w-max bg-background border border-black/10 rounded-2xl p-1.5 shadow-[0_18px_55px_rgba(0,0,0,0.12)] z-[110]"
  >
                {/* User Info */}
                <div className="px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-foreground font-semibold text-sm truncate flex-1">
                      {displayName || 'User'}
                    </p>
	                    {tierCode && (
	                      <SubscriptionBadge tier={tierCode} />
	                    )}
                  </div>
                  <p className="text-muted-foreground text-xs truncate">
                    {user.email}
                  </p>
                </div>

                {/* Credits */}
                <div className="px-2.5 pb-1.5">
                  <div className="flex items-center justify-between gap-3 py-1.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-medium text-foreground">Credits</span>
                    </div>
                    <span className="min-w-6 rounded-md bg-black/5 px-2 py-0.5 text-center text-[11px] font-semibold text-foreground">
                      {credits === null ? '...' : credits}
                    </span>
                  </div>
                </div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsNicknameDialogOpen(true);
                      }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground transition-colors"
                    >
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-foreground/70">
                    <PencilLine className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-foreground font-medium text-sm">Edit profile</span>
                </button>

                {/* Sign Out Button */}
                    <button
                      onClick={async () => {
                        try {
                          await signOut();
                          setIsUserMenuOpen(false);
                        } catch (error) {
                          console.error('Sign out error:', error);
                        }
                      }}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-black/5 hover:text-foreground transition-colors"
                    >
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-foreground/70">
                    <LogOut className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-foreground font-medium text-sm">Sign Out</span>
                </button>
              </div>
            )}
            </div>
          </>
        ) : (
          <Button 
            onClick={() => setIsAuthModalOpen(true)}
            size="default" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-base font-semibold h-10"
          >
            Sign In
          </Button>
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

    </header>
  );
};
