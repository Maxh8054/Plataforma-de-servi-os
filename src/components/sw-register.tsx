"use client";

import { useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

/**
 * Registra o Service Worker automaticamente.
 * Usa ?v=X como cache-buster — a cada deploy com novo número,
 * o browser trata como um SW novo e limpa o cache antigo.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    async function register() {
      try {
        const swUrl = `/sw.js?v=${APP_VERSION}`;
        const registration = await navigator.serviceWorker.register(swUrl, {
          scope: "/",
        });

        console.log(
          `[SW] Registrado v${APP_VERSION}, scope:`,
          registration.scope
        );

        // Escuta atualizações
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log("[SW] Nova versao disponivel");
            }
          });
        });
      } catch (error) {
        console.warn("[SW] Falha ao registrar:", error);
      }
    }

    register();
  }, []);

  return null;
}
