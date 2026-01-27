import { supabase } from "@/lib/supabase";

type CheckoutPayload = {
  productId: string;
  userId: string;
  userEmail: string;
  creditsAmount: number;
};

const getAccessTokenOrThrow = async () => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error("Authentication failed");
  }

  return session.access_token;
};

export const createCheckoutSession = async (payload: CheckoutPayload) => {
  const accessToken = await getAccessTokenOrThrow();
  const response = await fetch("/api/creem-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create checkout session");
  }

  const { checkout_url } = await response.json();
  if (!checkout_url) {
    throw new Error("Missing checkout url");
  }

  return checkout_url as string;
};

export const createBillingPortalLink = async () => {
  const accessToken = await getAccessTokenOrThrow();
  const response = await fetch("/api/billing-portal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to open billing portal");
  }

  const { url } = await response.json();
  if (!url) {
    throw new Error("Missing billing portal url");
  }

  return url as string;
};

export const switchSubscription = async (productId: string) => {
  const accessToken = await getAccessTokenOrThrow();
  const response = await fetch("/api/switch-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ productId }),
  });

  if (!response.ok) {
    throw new Error("Failed to switch subscription");
  }
};

export const scheduleCancellation = async () => {
  const accessToken = await getAccessTokenOrThrow();
  const response = await fetch("/api/cancel-subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to schedule cancellation");
  }
};
