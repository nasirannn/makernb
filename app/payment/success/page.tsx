"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, Music, AlertCircle } from "lucide-react";
import { useCredits } from "@/contexts/CreditsContext";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshCredits } = useCredits();
  const [isLoading, setIsLoading] = useState(true);
  const [isValidPayment, setIsValidPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 检查URL参数中是否有支付验证信息
    const sessionId = searchParams.get('session_id');
    const paymentId = searchParams.get('payment_id');
    
    if (!sessionId && !paymentId) {
      // 没有支付验证信息，重定向到首页
      setError('Invalid payment session');
      setIsLoading(false);
      return;
    }

    // 验证支付状态
    const verifyPayment = async () => {
      try {
        // 这里可以添加API调用来验证支付状态
        // const response = await fetch(`/api/verify-payment?session_id=${sessionId}`);
        // const data = await response.json();
        
        // 暂时模拟验证成功（实际应该调用支付验证API）
        setIsValidPayment(true);
        refreshCredits();
        
        // 延迟显示成功页面
        setTimeout(() => {
          setIsLoading(false);
        }, 1500);
      } catch (err) {
        setError('Payment verification failed');
        setIsLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams, refreshCredits]);

  // 如果有错误，显示错误页面并重定向
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <AlertCircle className="h-16 w-16 text-red-500" />
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Invalid Payment Session</h1>
            <p className="text-muted-foreground">
              This page can only be accessed after a successful payment.
            </p>
          </div>
          <Button 
            className="w-full" 
            onClick={() => router.push('/')}
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

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

export default function PaymentSuccess() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
