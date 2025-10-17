"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Music } from "lucide-react";
import { useCredits } from "@/contexts/CreditsContext";

export default function PaymentSuccess() {
  const router = useRouter();
  const { refreshCredits } = useCredits();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 刷新积分余额
    refreshCredits();
    
    // 延迟一下再显示内容，让用户感觉处理完成
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [refreshCredits]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Processing your payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Success Icon */}
        <div className="flex justify-center">
          <CheckCircle className="h-20 w-20 text-green-500" />
        </div>
        
        {/* Main Content */}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-foreground">Payment Successful!</h1>
          <p className="text-lg text-muted-foreground">
            Thank you for your purchase! Your credits are now ready to use.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-6">
          <Button 
            className="w-full" 
            onClick={() => router.push('/studio')}
          >
            <Music className="h-4 w-4 mr-2" />
            Start Creating Music
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => router.push('/')}
          >
            Back to Home
          </Button>
        </div>

        {/* Support Text */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Need help? <a href="mailto:support@makernb.com" className="text-primary hover:underline">Contact our support team</a>
          </p>
        </div>
      </div>
    </div>
  );
}
