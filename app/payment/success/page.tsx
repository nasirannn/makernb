"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-bold">Payment Successful!</CardTitle>
          <CardDescription>
            Your credits have been added to your account
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Thank you for your purchase! Your credits are now available and ready to use.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              className="w-full" 
              onClick={() => router.push('/studio')}
            >
              <Music className="h-4 w-4 mr-2" />
              Start Creating Music
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push('/')}
            >
              Back to Home
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Need help? Contact our support team
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
