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
import AuthModal from "../ui/auth-modal";
import { LogOut } from "lucide-react";
import { getZIndexClass } from "@/lib/z-index";
import { EditNicknameDialog } from "@/components/ui/edit-nickname-dialog";
import { ThemeModeToggle } from "@/components/ui/theme-mode-toggle";
import { isStudioAreaPath } from "@/lib/studio-features";

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

const studioDropdown: DropdownItemProps[] = [
  {
    href: "/music-generator",
    label: "Music Generator",
  },
  {
    href: "/music-extender",
    label: "Music Extender",
  },
  {
    href: "/music-cover",
    label: "Music Cover",
  },
  {
    href: "/mashup",
    label: "Mashup",
  },
  {
    href: "/add-track",
    label: "Add Track",
  },
];

const aiMusicToolsDropdown: DropdownItemProps[] = [
  {
    href: "/vocal-separation",
    label: "Vocal Separation",
  },
  {
    href: "/lyrics-generator",
    label: "Lyrics Generator",
  }
];

const routeList: RouteProps[] = [
  {
    href: "#studio",
    label: "Studio",
    hasDropdown: true,
    dropdownKey: "studio",
    dropdownItems: studioDropdown,
  },
  {
    href: "/library",
    label: "Library",
  },
  {
    href: "#ai",
    label: "AI Music Tool",
    hasDropdown: true,
    dropdownKey: "ai",
    dropdownItems: aiMusicToolsDropdown,
  },
  {
    href: "/blog",
    label: "Blog",
  },
  {
    href: "/pricing",
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
  const [openDropdown, setOpenDropdown] = React.useState<DropdownKey | null>(null);
  const [openMobileDropdown, setOpenMobileDropdown] = React.useState<DropdownKey | null>(null);
  const [dropdownTimeout, setDropdownTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const pathname = usePathname();
  const { user, signOut, loading: authLoading } = useAuth();
  const { tierCode, tierName, hasSubscription, cancelAtPeriodEnd, cancelAt, currentPeriodEnd } = useSubscription();
  const { openModal } = usePricingModal();
  const displayName = user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const formatDisplayDate = React.useCallback((dateValue?: string | null) => {
    if (!dateValue) return null;
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }, []);
  const billingNotice = React.useMemo(() => {
    if (!hasSubscription) return null;
    if (cancelAtPeriodEnd) {
      const formatted = formatDisplayDate(cancelAt);
      return formatted ? `Scheduled to cancel on ${formatted}` : "Cancellation scheduled.";
    }
    const formatted = formatDisplayDate(currentPeriodEnd);
    return formatted ? `Next charge on ${formatted}.` : null;
  }, [hasSubscription, cancelAtPeriodEnd, cancelAt, currentPeriodEnd, formatDisplayDate]);

  const handleOpenPricingModal = (options?: { closeMobileMenu?: boolean }) => {
    if (options?.closeMobileMenu) {
      setIsOpen(false);
    }
    setIsUserMenuOpen(false);
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
      const userMenuContainer = document.querySelector('.user-menu-container');
      const target = event.target as HTMLElement | null;
      const inDropdownContainer = !!target?.closest('.dropdown-container');
      
      if (userMenuContainer && !userMenuContainer.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      
      if (!inDropdownContainer) {
        setOpenDropdown(null);
      }
    };

    if (isUserMenuOpen || openDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen, openDropdown]);

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
      className={`w-full flex items-center px-6 lg:px-20 py-3 lg:py-4 absolute top-0 left-0 text-foreground ${getZIndexClass('NAVBAR')} bg-transparent`}
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
          {routeList.map(({ href, label, hasDropdown, dropdownItems, dropdownKey }) => {
            const isActive =
              href === "/blog" ? pathname.startsWith("/blog") :
              href === "/explore" ? pathname.startsWith("/explore") :
              hasDropdown && dropdownKey === "studio" ? isStudioAreaPath(pathname) :
              href === "/library" ? pathname.startsWith("/library") :
              hasDropdown && dropdownKey === "ai" ? (pathname.startsWith("/vocal-separation") || pathname.startsWith("/lyrics-generator")) :
              pathname === href;
            
            if (hasDropdown && dropdownItems && dropdownKey) {
              const isOpenDropdown = openDropdown === dropdownKey;
              return (
                <li key={dropdownKey} className="relative dropdown-container">
                  <button
                    onClick={() => setOpenDropdown((prev) => prev === dropdownKey ? null : dropdownKey)}
                    onMouseEnter={() => handleDropdownMouseEnter(dropdownKey)}
                    onMouseLeave={handleDropdownMouseLeave}
                  className={`text-base px-5 py-3 rounded-lg transition-colors duration-200 flex items-center gap-1 font-semibold ${
                      isActive
                        ? 'text-primary'
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
                        const isDropdownItemActive = pathname.startsWith(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
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
                  href={href}
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
            <div className="fixed right-0 top-0 h-full w-80 bg-card shadow-none p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
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
              
              <div className="flex-1 min-h-0 overflow-y-auto pb-4">
              {/* Mobile User Section */}
              {user ? (
                <div className="mb-4 pb-4">
                  {/* User Info */}
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-10 h-10">
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
                        <button
                          type="button"
                          onClick={() => handleOpenPricingModal({ closeMobileMenu: true })}
                          className="group inline-flex items-center gap-1.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          aria-label="Open pricing"
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
                      {credits === null ? '...' : credits} Credits
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
                <div className="mb-4 pb-4">
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
                {routeList.map(({ href, label, hasDropdown, dropdownItems, dropdownKey }) => {
                  const isActive = pathname === href ||
                                 (href === "/blog" && pathname.startsWith("/blog")) ||
                                 (href === "/explore" && pathname.startsWith("/explore")) ||
                                 (hasDropdown && dropdownKey === "studio" && isStudioAreaPath(pathname)) ||
                                 (href === "/library" && pathname.startsWith("/library")) ||
                                 (hasDropdown && dropdownKey === "ai" && (pathname.startsWith("/vocal-separation") || pathname.startsWith("/lyrics-generator")));
                  
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
                                  <Link href={item.href} className="flex items-center gap-2">
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
                      <Link href={href}>{label}</Link>
                    </Button>
                  );
                })}
              </div>
              </div>
              <div className="mt-auto shrink-0 border-t border-border/20 pt-2 pb-2 px-3 bg-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    Theme
                  </div>
                  <ThemeModeToggle size="md" variant="icon" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* <!-- Desktop Right Side --> */}
      <div className="hidden lg:flex ml-auto items-center gap-4">
        <ThemeModeToggle size="md" variant="icon" className="rounded-2xl" />
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
              className="w-10 h-10 cursor-pointer hover:scale-105 transition-transform duration-200"
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
                    <button
                      type="button"
                      onClick={() => handleOpenPricingModal()}
                      className="group inline-flex items-center gap-1.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Open pricing"
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

                {/* Credits */}
                <div className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-primary">
                      <Coins className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium text-foreground">Credits</span>
                  </div>
                  <span className="min-w-6 text-right text-[11px] font-semibold text-foreground tabular-nums">
                    {credits === null ? '...' : credits}
                  </span>
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
