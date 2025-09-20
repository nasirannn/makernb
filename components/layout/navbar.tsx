"use client";
import { Menu } from "lucide-react";
import React from "react";
import { Button } from "../ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "../ui/auth-modal";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Library, LogOut } from "lucide-react";

interface RouteProps {
  href: string;
  label: string;
}

interface FeatureProps {
  title: string;
  description: string;
}

const routeList: RouteProps[] = [
  {
    href: "/",
    label: "Home",
  },
  {
    href: "/studio",
    label: "Studio",
  },
  {
    href: "/explore",
    label: "Explore",
  },
  {
    href: "/blog",
    label: "Blog",
  },
  {
    href: "#faq",
    label: "FAQ",
  },
];

interface NavbarProps {
  credits?: number | null;
}

export const Navbar = ({ credits = null }: NavbarProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = React.useState(false);
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
      
      // 滚动时关闭用户菜单
      if (isUserMenuOpen) {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isUserMenuOpen]);

  // Close user menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const userMenuContainer = document.querySelector('.user-menu-container');
      if (userMenuContainer && !userMenuContainer.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen]);

  return (
    <header className={`shadow-inner w-full z-50 flex items-center px-20 py-5 fixed top-0 left-0 transition-all duration-300 ${
      isScrolled 
        ? 'bg-background/30 backdrop-blur-md border-b border-border/20' 
        : 'bg-transparent'
    }`}>
      <Link href="/" className="font-bold text-xl flex items-center">
        <Image
          src="/logo.svg"
          alt="90s R&B Logo"
          width={44}
          height={44}
          className="mr-3"
        />
        R&B Generator
      </Link>
      
      {/* <!-- Desktop Navigation --> */}
      <nav className="hidden lg:block absolute left-1/2 transform -translate-x-1/2">
        <ul className="flex items-center space-x-2">
          {routeList.map(({ href, label }) => {
            const isActive = pathname === href ||
                           (href === "/" && pathname === "/") ||
                           (href === "/blog" && pathname.startsWith("/blog")) ||
                           (href === "/explore" && pathname.startsWith("/explore")) ||
                           (href === "/studio" && pathname.startsWith("/studio"));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`text-sm px-5 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'text-primary bg-primary/10 font-medium'
                      : 'hover:text-primary hover:bg-primary/10'
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
          className="cursor-pointer lg:hidden"
        />
        
        {isOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
            <div className="fixed left-0 top-0 h-full w-80 bg-card border-r border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <Link href="/" className="flex items-center" onClick={() => setIsOpen(false)}>
                  <Image
                    src="/logo.svg"
                    alt="90s R&B Logo"
                    width={48}
                    height={48}
                    className="mr-2"
                  />
                  90s R&B
                </Link>
                <button onClick={() => setIsOpen(false)} className="text-2xl">×</button>
              </div>
              
              <div className="flex flex-col gap-2">
                {routeList.map(({ href, label }) => {
                  const isActive = pathname === href ||
                                 (href === "/" && pathname === "/") ||
                                 (href === "/blog" && pathname.startsWith("/blog")) ||
                                 (href === "/explore" && pathname.startsWith("/explore")) ||
                                 (href === "/studio" && pathname.startsWith("/studio"));
                  return (
                    <Button
                      key={href}
                      onClick={() => setIsOpen(false)}
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
        {user ? (
          <>
            {/* Credits Display */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg">
              <span className="text-sm">⚡</span>
              <span className="text-sm font-medium text-white">
                {credits === null ? '...' : credits}
              </span>
            </div>
            
            <div 
              className="relative user-menu-container"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            >
            {/* User Avatar */}
            <Avatar 
              className="cursor-pointer hover:scale-105 transition-transform duration-200 border-2 border-purple-400/30"
            >
              <AvatarImage
                src={user.user_metadata?.avatar_url || user.user_metadata?.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                alt="User Avatar"
              />
              <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white font-semibold text-sm">
                {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                 user.user_metadata?.name?.charAt(0)?.toUpperCase() ||
                 user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 top-12 w-64 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl py-2 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8 border border-purple-400/30">
                      <AvatarImage
                        src={user.user_metadata?.avatar_url || user.user_metadata?.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
                        alt="User Avatar"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white font-semibold text-xs">
                        {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                         user.user_metadata?.name?.charAt(0)?.toUpperCase() ||
                         user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="text-white/70 text-xs truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/studio?tab=library"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Library className="w-4 h-4" />
                    <span>Library</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsSignOutConfirmOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
            </div>
          </>
        ) : (
          <Button 
            onClick={() => setIsAuthModalOpen(true)}
            size="default" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-2 rounded-xl font-medium"
          >
            Get Started
          </Button>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isSignOutConfirmOpen}
        onClose={() => setIsSignOutConfirmOpen(false)}
        onConfirm={async () => {
          try {
            await signOut();
          } catch (error) {
            console.error('Sign out error:', error);
          } finally {
            setIsUserMenuOpen(false);
          }
        }}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="destructive"
      />
    </header>
  );
};
