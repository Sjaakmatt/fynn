"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";

const BANK_CONNECT_ENABLED = process.env.NEXT_PUBLIC_BANK_CONNECT_ENABLED === 'true'

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

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
  });

  if (linkToken && ready) {
    if (loading) {
      open();
      setLoading(false);
    }
  }

  if (!BANK_CONNECT_ENABLED) {
    return (
      <div className="space-y-3">
        <button
          disabled
          className={className}
          style={{
            ...style,
            opacity: 0.6,
            cursor: 'not-allowed',
            backgroundColor: 'var(--tab-bg)',
            color: 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Bank koppelen — binnenkort
        </button>
        <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <p className="text-xs" style={{ color: '#F59E0B' }}>
            Automatisch koppelen wordt binnenkort geactiveerd. Upload in de tussentijd je transacties als CSV.
          </p>
        </div>
      </div>
    );
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
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Verbinden...
          </>
        ) : (
          children ?? "Bank koppelen"
        )}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}