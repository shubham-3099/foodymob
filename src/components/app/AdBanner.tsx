import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
type Consent = {
  eventStatus?: string;
  gdprApplies?: boolean;
  purpose?: { consents?: Record<string, boolean> };
  vendor?: { consents?: Record<string, boolean> };
  listenerId?: number;
};
type AdWindow = Window & {
  adsbygoogle?: unknown[];
  __tcfapi?: (
    command: string,
    version: number,
    callback: (data: Consent, success: boolean) => void,
    id?: number,
  ) => void;
};
export function AdBanner({ placement = "home" }: { placement?: "home" | "profile" | "vlogger" }) {
  const s = useStore(),
    ref = useRef<HTMLModElement>(null),
    [consent, setConsent] = useState(false);
  const premium = s.hasPlan("member") || s.hasPlan("creator"),
    slot = s.ads[`${placement}Slot` as "homeSlot" | "profileSlot" | "vloggerSlot"];
  useEffect(() => {
    const w = window as AdWindow;
    let id: number | undefined;
    if (!s.ads.enabled || !s.ads.consentConfigured || premium) return;
    w.__tcfapi?.("addEventListener", 2, (data, success) => {
      if (!success) return;
      id = data.listenerId;
      const ready = ["tcloaded", "useractioncomplete"].includes(data.eventStatus ?? "");
      setConsent(
        ready &&
          (data.gdprApplies === false ||
            (data.purpose?.consents?.["1"] === true && data.vendor?.consents?.["755"] === true)),
      );
    });
    return () => {
      if (id !== undefined) w.__tcfapi?.("removeEventListener", 2, () => {}, id);
    };
  }, [s.ads.enabled, s.ads.consentConfigured, premium]);
  useEffect(() => {
    if (
      !s.ads.enabled ||
      premium ||
      !consent ||
      !slot ||
      !/^ca-pub-\d{16}$/.test(s.ads.publisherId)
    )
      return;
    let cancelled = false;
    const w = window as AdWindow;
    const push = () => {
      if (!cancelled && ref.current && !ref.current.hasAttribute("data-adsbygoogle-status")) {
        try {
          (w.adsbygoogle = w.adsbygoogle || []).push({});
        } catch {}
      }
    };
    let script = document.querySelector<HTMLScriptElement>("script[data-dish-adsense]");
    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset["dishAdsense"] = "true";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${s.ads.publisherId}`;
      script.addEventListener("load", push, { once: true });
      document.head.appendChild(script);
    } else if (w.adsbygoogle) push();
    else script.addEventListener("load", push, { once: true });
    return () => {
      cancelled = true;
    };
  }, [s.ads.enabled, s.ads.publisherId, slot, premium, consent]);
  if (premium) return null;
  if (!s.ads.enabled || !consent || !slot)
    return (
      <aside
        className="mt-2 flex min-h-32 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground"
        aria-label="Advertising placement"
      >
        Advertisement space
      </aside>
    );
  return (
    <aside className="min-h-32 overflow-hidden" aria-label="Advertisement">
      <p className="mb-1 text-xs text-muted-foreground">Advertisement</p>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={s.ads.publisherId}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
