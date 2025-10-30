"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Music, Library, Sparkles, LogOut, User, BookOpen, Compass, LogIn, ChevronDown, Mic, FileText, Wand2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [isExpanded, setIsExpanded] = React.useState(true);
  const mobileNavRef = React.useRef<HTMLDivElement | null>(null);

  // 切换sidebar展开/收起状态
  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

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
      <div className={`hidden md:flex h-full flex-col bg-muted/30 border-r border-border/30 transition-all duration-300 ${isExpanded ? 'w-60' : 'w-16'}`}>
          {/* Home Button */}
          <div className={`flex items-center min-h-[64px] ${isExpanded ? 'px-4 pt-6 pb-6 justify-between' : 'px-2 py-4 justify-center'}`}>
            {isExpanded ? (
              <>
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity pl-[6px]">
                  <Image
                    src="/logo.svg"
                    alt="Logo"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                  />
                  <span className="font-semibold text-lg">MakeRNB</span>
                </Link>
                <Button
                  onClick={toggleSidebar}
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 flex items-center justify-center hover:bg-white/10 transition-all duration-300 rounded-lg"
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
                  className="w-12 h-12 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition-all duration-300 rounded-lg"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </Tooltip>
            )}
          </div>

          <div className={`flex flex-col gap-2 pt-0 pb-4 ${isExpanded ? 'px-4' : 'px-2'}`}>
            {/* Studio Button */}
            {isExpanded ? (
              <Button
                onClick={() => router.push('/studio')}
                variant="ghost"
                size="sm"
                className={`w-full h-12 flex items-center justify-start gap-3 pl-3 pr-4 hover:bg-muted/50 hover:text-white transition-all duration-300 rounded-lg ${isActive('/studio') ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <Music className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">Studio</span>
              </Button>
            ) : (
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
            )}

            {/* Library Button */}
            {isExpanded ? (
              <Button
                onClick={() => router.push('/library')}
                variant="ghost"
                size="sm"
                className={`w-full h-12 flex items-center justify-start gap-3 pl-3 pr-4 hover:bg-muted/50 hover:text-white transition-all duration-300 rounded-lg ${isActive('/library') ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <Library className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">Library</span>
              </Button>
            ) : (
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
            )}

            {/* AI Music Tools Button with Dropdown */}
            <div className="relative dropdown-container">
              {isExpanded ? (
                <>
                  <Button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    onMouseEnter={handleDropdownMouseEnter}
                    onMouseLeave={handleDropdownMouseLeave}
                    variant="ghost"
                    size="sm"
                    className={`w-full h-12 flex items-center justify-start gap-3 pl-3 pr-4 hover:bg-muted/50 hover:text-white transition-all duration-300 rounded-lg ${
                      isActive('/vocal-remover') || isActive('/lyrics-generator')
                        ? 'bg-primary/20 text-primary shadow-sm'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Wand2 className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm font-medium flex-1 text-left">AI Music Tools</span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </Button>
                  
                  {/* Expanded Dropdown Menu */}
                  {isDropdownOpen && (
                    <div 
                      className="mt-1 ml-4 space-y-1"
                      onMouseEnter={handleDropdownMouseEnter}
                      onMouseLeave={handleDropdownMouseLeave}
                    >
                      {aiMusicToolsDropdown.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsDropdownOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2 hover:bg-accent transition-colors rounded-md text-sm ${
                            isActive(item.href) ? 'text-primary bg-primary/10' : 'text-muted-foreground'
                          }`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Tooltip content="AI Music Tools" position="right">
                    <Button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      onMouseEnter={handleDropdownMouseEnter}
                      onMouseLeave={handleDropdownMouseLeave}
                      variant="ghost"
                      size="sm"
                      className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${
                        isActive('/vocal-remover') || isActive('/lyrics-generator')
                          ? 'bg-primary/20 text-primary shadow-sm'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <Wand2 className="h-5 w-5" />
                    </Button>
                  </Tooltip>
                  
                  {/* Collapsed Dropdown Menu */}
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
                </>
              )}
            </div>

            {/* Blog Button */}
            {isExpanded ? (
              <Button
                onClick={() => router.push('/blog')}
                variant="ghost"
                size="sm"
                className={`w-full h-12 flex items-center justify-start gap-3 pl-3 pr-4 hover:bg-muted/50 hover:text-white transition-all duration-300 rounded-lg ${isActive('/blog') ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <BookOpen className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">Blog</span>
              </Button>
            ) : (
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
            )}
          </div>

          {/* User Avatar or Sign In Button - Fixed at bottom */}
          <div className={`mt-auto mb-4 flex flex-col gap-2 ${isExpanded ? 'px-4' : 'px-2'}`}>
            {/* Credits Display */}
            {user && (
              <>
                {isExpanded ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshCredits}
                    disabled={isRefreshingCredits}
                    className="w-full h-12 flex items-center justify-start gap-3 pl-3 pr-4 hover:bg-muted/50 hover:text-white transition-all duration-300 rounded-lg text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRefreshingCredits ? (
                      <RefreshCw className="h-5 w-5 flex-shrink-0 animate-spin" />
                    ) : (
                      <Sparkles className="h-5 w-5 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium">
                      {credits !== null ? `${credits.toLocaleString()} Credits` : 'Loading...'}
                    </span>
                  </Button>
                ) : (
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
                      onClick={handleRefreshCredits}
                      disabled={isRefreshingCredits}
                      className="w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRefreshingCredits ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )}
                    </Button>
                  </Tooltip>
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
                      className="w-full h-14 flex items-center justify-start gap-3 pl-3 pr-4 hover:bg-muted/50 transition-all duration-300 rounded-lg"
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage
                          src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                          alt="User Avatar"
                        />
                        <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-600 text-white font-semibold text-xs">
                          {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
                           user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {user.user_metadata?.full_name || user.email}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </div>
                      </div>
                    </Button>

                    {/* User Menu Dropdown */}
                    {userMenuOpen && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-xl z-[40] p-2">
                        <button
                          onClick={() => {
                            handleSignOut();
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
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
                      className="w-8 h-8 cursor-pointer hover:scale-110 transition-all duration-300 border-2 border-transparent hover:border-white/20"
                    >
                      <AvatarImage
                        src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                        alt="User Avatar"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-600 text-white font-semibold text-xs">
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
                )}
              </>
            ) : (
              <>
                {isExpanded ? (
                  <Button
                    onClick={() => setIsAuthModalOpen(true)}
                    variant="ghost"
                    size="sm"
                    className="w-full h-12 flex items-center justify-start gap-3 pl-3 pr-4 hover:bg-muted/50 hover:text-white transition-all duration-300 rounded-lg text-muted-foreground"
                  >
                    <LogIn className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm font-medium">Sign In</span>
                  </Button>
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
              </>
            )}
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


      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};
