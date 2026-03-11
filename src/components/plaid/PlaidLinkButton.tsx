"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export default function PlaidLinkButton({
  onSuccess,
  className,
  style,
  children,
}: PlaidLinkButtonProps) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stap 1: Link token ophalen van onze backend
  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.link_token) {
        throw new Error(data.error ?? "Kon geen verbinding starten");
      }

      setLinkToken(data.link_token);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      setLoading(true);
      setError(null);

      try {
        const exchangeRes = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        const exchangeData = await exchangeRes.json();

        if (!exchangeRes.ok || !exchangeData.ok) {
          throw new Error(exchangeData.error ?? "Bankkoppeling opslaan mislukt");
        }

        // Harde redirect — geen React state issues
        window.location.href = "/sync?provider=plaid";
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    },
    []
  );

  const handleExit = useCallback(() => {
    setLoading(false);
    setLinkToken(null);
  }, []);

  // Plaid Link hook — alleen actief als we een linkToken hebben
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
  });

  // Open Plaid Link zodra token beschikbaar is
  if (linkToken && ready) {
    // Auto-open bij eerste keer
    if (loading) {
      open();
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={linkToken ? () => open() : fetchLinkToken}
        disabled={loading}
        style={style}
        className={
            className ??
            "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        }
        >
        {loading ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Verbinden...
          </>
        ) : (
          children ?? "Bank koppelen"
        )}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}