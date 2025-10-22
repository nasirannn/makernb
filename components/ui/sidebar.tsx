"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Music, Library, Sparkles, LogOut, User, BookOpen, Compass, LogIn, ChevronDown, Mic, FileText, Wand2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import AuthModal from '@/components/ui/auth-modal';

import { Tooltip } from '@/components/ui/tooltip';

interface CommonSidebarProps {
  // 移除 isGenerating 参数，因为不再需要显示生成状态
  hideMobileNav?: boolean; // 新增：是否隐藏移动端底部导航栏
}

export const CommonSidebar = ({ hideMobileNav = false }: CommonSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { credits } = useCredits();

  // 判断是否选中某个路径
  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [dropdownTimeout, setDropdownTimeout] = React.useState<NodeJS.Timeout | null>(null);
  const mobileNavRef = React.useRef<HTMLDivElement | null>(null);

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

  // 点击外部关闭用户菜单和下拉菜单
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const userMenuContainer = document.querySelector('.user-menu-container');
      const dropdownContainer = document.querySelector('.dropdown-container');
      
      if (userMenuOpen && userMenuContainer && !userMenuContainer.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      
      if (isDropdownOpen && dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (userMenuOpen || isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
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
      <div className="hidden md:flex w-16 h-full flex-col bg-muted/30 border-r border-border/30">
          {/* Home Button */}
          <div className="p-4 flex justify-center">
            <Tooltip content="Home" position="right">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-12 h-12 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition-all duration-300 rounded-lg"
              >
                <Link href="/">
                  <Image
                    src="/logo.svg"
                    alt="Logo"
                    width={48}
                    height={48}
                    className="h-12 w-12"
                  />
                </Link>
              </Button>
            </Tooltip>
          </div>

          <div className="flex flex-col items-center gap-4 px-4 pt-0 pb-4">
            {/* Studio Button */}
              <Tooltip content="Studio" position="right">
              <Button
                onClick={() => router.push('/studio')}
                variant="ghost"
                size="sm"
                className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${isActive('/studio') ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <Music className="h-5 w-5" />
              </Button>
            </Tooltip>

            {/* Library Button */}
            <Tooltip content="Library" position="right">
              <Button
                onClick={() => router.push('/library')}
                variant="ghost"
                size="sm"
                className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${isActive('/library') ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <Library className="h-5 w-5" />
              </Button>
            </Tooltip>

            {/* AI Music Tools Button with Dropdown */}
            <div className="relative dropdown-container">
              <Tooltip content="AI Music Tools" position="right">
                <Button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  onMouseEnter={handleDropdownMouseEnter}
                  onMouseLeave={handleDropdownMouseLeave}
                  variant="ghost"
                  size="sm"
                  className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${
                    isActive('/vocal-remover') || isActive('/lyrics-generator') || isActive('/ai-music-tools')
                      ? 'bg-primary/20 text-primary shadow-sm'
                      : 'text-muted-foreground'
                  }`}
                >
                  <Wand2 className="h-5 w-5" />
                </Button>
              </Tooltip>
              
              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div 
                  className="absolute left-full top-0 ml-2 min-w-48 w-max bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-xl z-[50] p-2"
                  onMouseEnter={handleDropdownMouseEnter}
                  onMouseLeave={handleDropdownMouseLeave}
                >
                  {aiMusicToolsDropdown.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors group rounded-md"
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
            <Tooltip content="Blog" position="right">
              <Button
                onClick={() => router.push('/blog')}
                variant="ghost"
                size="sm"
                className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${isActive('/blog') ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <BookOpen className="h-5 w-5" />
              </Button>
            </Tooltip>
          </div>

          {/* User Avatar or Sign In Button - Fixed at bottom */}
          <div className="mt-auto mb-4 flex flex-col items-center gap-2">
            {/* Credits Display */}
            {user && (
              <Tooltip
                content={
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Credits</span>
                    <span className="text-sm font-medium text-foreground">
                      {credits !== null ? credits.toLocaleString() : '...'}
                    </span>
                  </div>
                }
                position="right"
                allowWrap={true}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg text-muted-foreground"
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
              </Tooltip>
            )}
            
            {user ? (
              <div className="relative user-menu-container z-[40]">
                <Avatar
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="w-10 h-10 cursor-pointer hover:scale-110 transition-all duration-300 border-2 border-transparent hover:border-white/20"
                >
                  <AvatarImage
                    src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                    alt="User Avatar"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-600 text-white font-semibold text-sm">
                    {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                     user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* User Menu Dropdown */}
                {userMenuOpen && (
                  <div className="absolute bottom-0 left-full ml-2 w-64 bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-xl z-[40]">
                    <div className="p-4">
                      <div className="text-sm font-medium text-foreground truncate">
                        {user.user_metadata?.full_name || user.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                    </div>

                    <div className="p-2">
                      <button
                        onClick={() => {
                          handleSignOut();
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Tooltip content="Sign In" position="right">
                <Button
                  onClick={() => setIsAuthModalOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg text-muted-foreground"
                >
                  <LogIn className="h-5 w-5" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

      {/* Mobile Bottom Navigation */}
      <div ref={mobileNavRef} className={`md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/30 z-50 transition-transform duration-300 ${hideMobileNav ? 'translate-y-full' : 'translate-y-0'}`}>
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
          <div className="relative dropdown-container">
            <Button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              variant="ghost"
              size="sm"
              className={`h-12 w-12 flex items-center justify-center hover:bg-muted/50 transition-all duration-300 rounded-lg ${
                isActive('/vocal-remover') || isActive('/lyrics-generator') || isActive('/ai-music-tools')
                  ? 'bg-primary/20 text-primary shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              <Wand2 className="h-7 w-7" />
            </Button>
            
            {/* Mobile Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 min-w-48 w-max bg-background border border-border/30 rounded-lg shadow-lg p-2 z-[50]">
                {aiMusicToolsDropdown.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors group rounded-md"
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

          {/* User Button */}
          {user ? (
            <div className="relative user-menu-container z-[40]">
              <Button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                variant="ghost"
                size="sm"
                className="h-12 w-12 flex items-center justify-center hover:bg-muted/50 transition-all duration-300 rounded-lg"
              >
                <Avatar className="w-7 h-7">
                  <AvatarImage
                    src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                    alt="User Avatar"
                  />
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                    {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
              
              {/* User Menu Dropdown */}
              {userMenuOpen && (
                <div className="absolute bottom-12 right-2 bg-background border border-border/30 rounded-lg shadow-lg p-2 min-w-48 z-[40]">
                  <div className="flex flex-col gap-1">
                    <div className="px-3 py-2 border-b border-border/20 mb-2">
                      <div className="text-sm font-medium text-foreground truncate">
                        {user.user_metadata?.full_name || user.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {user.email}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleSignOut();
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              onClick={() => setIsAuthModalOpen(true)}
              variant="ghost"
              size="sm"
              className="h-12 w-12 flex items-center justify-center hover:bg-muted/50 transition-all duration-300 rounded-lg text-muted-foreground"
              aria-label="Sign in"
            >
              <LogIn className="h-7 w-7" />
            </Button>
          )}
        </div>
      </div>


      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};
