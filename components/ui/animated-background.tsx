"use client";

interface AnimatedBackgroundProps {
  children: React.ReactNode;
}

export const AnimatedBackground = ({ children }: AnimatedBackgroundProps) => {
  return (
    <div className="absolute inset-0 z-0">
      {/* Background Image */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-purple-600/20 animate-pulse"></div>
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-20 w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
          <div className="absolute top-40 right-32 w-3 h-3 bg-purple-400/50 rounded-full animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
          <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-blue-400/40 rounded-full animate-bounce" style={{ animationDelay: '2s', animationDuration: '3.5s' }}></div>
          <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '2.5s' }}></div>
        </div>
        
        {/* Subtle moving gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-pulse" style={{ animationDuration: '8s' }}></div>
        
        {/* Shooting stars */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/3 w-1 h-1 bg-white rounded-full animate-shooting-star" style={{ animationDelay: '0s', animationDuration: '4s' }}></div>
          <div className="absolute top-0 right-1/3 w-1 h-1 bg-primary rounded-full animate-shooting-star" style={{ animationDelay: '3s', animationDuration: '5s' }}></div>
        </div>
      </div>
      
      {/* Render children */}
      {children}
    </div>
  );
};
