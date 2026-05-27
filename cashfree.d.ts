declare module "@cashfreepayments/cashfree-js" {
  export function load(opts: {
    mode: "production" | "sandbox";
  }): Promise<{
    checkout: (opts: {
      paymentSessionId: string;
      redirectTarget: "_modal" | "_self" | "_blank";
    }) => Promise<{
      error?: { message?: string; type?: string };
      paymentDetails?: unknown;
    }>;
  } | null>;
}
