const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = "https://us.i.posthog.com";
const POSTHOG_ASSETS_HOST = "https://us-assets.i.posthog.com";

declare global {
  interface Window {
    posthog?: any;
  }
}

let bootstrapped = false;

function bootstrap() {
  if (bootstrapped || !POSTHOG_KEY) return;
  bootstrapped = true;

  // Set up the posthog queue stub so calls before the script loads are buffered.
  const w = window as any;
  if (!w.posthog || !w.posthog.__SV) {
    const ph: any = (w.posthog = w.posthog || []);
    ph.__SV = 1.1;
    ph._i = [];
    // Add stubs for every method we call, so they enqueue if called before load.
    for (const fn of [
      "capture", "reset", "identify", "set", "setOnce", "unset",
      "register", "unregister", "opt_in_capturing", "opt_out_capturing",
      "has_opted_in_capturing", "has_opted_out_capturing", "capture_exception",
      "debug", "init",
    ]) {
      ph[fn] = function (...args: unknown[]) {
        ph._i.push([fn, args]);
      };
    }

    // Load the PostHog bundle from CDN.
    const s = document.createElement("script");
    s.type = "text/javascript";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `${POSTHOG_ASSETS_HOST}/static/array.js`;
    s.onload = () => {
      // Once the real library is loaded, re-initialize properly.
      w.posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: false,
        loaded: (ph: any) => {
          // Replay any buffered calls now that the real library is ready.
          const queued = ph._i || [];
          ph._i = [];
          for (const [fn, args] of queued) {
            if (fn !== "init" && typeof ph[fn] === "function") {
              ph[fn](...args);
            }
          }
        },
      });
    };
    document.head.appendChild(s);
  }
}

export const analytics = {
  identify(userId: string, props: { email: string; name: string }) {
    bootstrap();
    window.posthog?.identify(userId, props);
  },

  reset() {
    bootstrap();
    window.posthog?.reset();
  },

  page(path: string) {
    bootstrap();
    window.posthog?.capture("$pageview", {
      $current_url: window.location.origin + path,
    });
  },

  capture(event: string, properties?: Record<string, unknown>) {
    bootstrap();
    window.posthog?.capture(event, properties);
  },
};
