"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Music, Library, Sparkles, LogOut, User, BookOpen, Compass } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import AuthModal from '@/components/ui/auth-modal';

import { Tooltip } from '@/components/ui/tooltip';

interface CommonSidebarProps {
  // 移除 isGenerating 参数，因为不再需要显示生成状态
}

export const CommonSidebar = ({}: CommonSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { credits } = useCredits();

  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = React.useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  // 点击外部关闭用户菜单
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuOpen && !(event.target as Element).closest('.user-menu-container')) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setSignOutDialogOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      <div className="w-16 h-full flex flex-col bg-muted/30">
          {/* Home Button */}
          <div className="p-4 flex justify-center">
            <Tooltip content="🏠 Home" position="right">
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
              <Tooltip content="🎵 Studio" position="right">
              <Button
                onClick={() => router.push('/studio')}
                variant="ghost"
                size="sm"
                className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${pathname === '/studio' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <Music className="h-5 w-5" />
              </Button>
            </Tooltip>

            {/* Explore Button */}
            <Tooltip content="🔍 Explore" position="right">
              <Button
                onClick={() => router.push('/explore')}
                variant="ghost"
                size="sm"
                className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${pathname === '/explore' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
              >
                <Compass className="h-5 w-5" />
              </Button>
            </Tooltip>

            {/* Blog Button */}
            <Tooltip content="📝 Blog" position="right">
              <Button
                onClick={() => router.push('/blog')}
                variant="ghost"
                size="sm"
                className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${pathname === '/blog' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
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
              <div className="relative user-menu-container">
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
                  <div className="absolute bottom-0 left-full ml-2 w-64 bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-xl z-[100]">
                    <div className="p-4">
                      <div className="text-sm font-medium text-foreground truncate">
                        {user.user_metadata?.full_name || user.email}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </div>
                    </div>

                    <div className="border-t border-border/30 p-2">
                      <button
                        onClick={() => {
                          router.push('/library');
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                      >
                        <Library className="w-4 h-4" />
                        <span>Library</span>
                      </button>
                      <button
                        onClick={() => {
                          setSignOutDialogOpen(true);
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
              <Tooltip content="👤 Sign In" position="right">
                <Button
                  onClick={() => setIsAuthModalOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg text-muted-foreground"
                >
                  <User className="h-5 w-5" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

      {/* Sign Out Confirmation Dialog */}
      <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? You&apos;ll need to sign in again to access your music library and generate new tracks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign Out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
};
