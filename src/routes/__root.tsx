import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";

const APP_MODE = (import.meta.env.VITE_APP_MODE || "client") as
  | "client"
  | "admin";
const IS_ADMIN_MODE = APP_MODE === "admin";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: IS_ADMIN_MODE
          ? "Vendly Admin — Gestion de stock & ventes"
          : "Vendly Store — Boutique mode",
      },
      {
        name: "description",
        content: IS_ADMIN_MODE
          ? "Administration Vendly : gestion de stock, ventes, réservations et équipe"
          : "Vendly Store : boutique de mode, découverte de nos collections",
      },
      { name: "theme-color", content: "#5C2D91" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "manifest",
        href: IS_ADMIN_MODE ? "/manifest-admin.json" : "/manifest.json",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/" className="mt-6 inline-block text-accent underline">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  ),
});

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-accent">404</p>
        <h1 className="mt-4 font-display text-5xl">Page introuvable</h1>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-full bg-foreground px-6 py-3 text-sm text-background hover:opacity-90"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
        {/* Service Worker temporairement désactivé pour corriger les erreurs de chargement */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Service Worker temporairement désactivé
              // if ('serviceWorker' in navigator) {
              //   window.addEventListener('load', () => {
              //     navigator.serviceWorker.register('/sw.js')
              //       .then(reg => console.log('PWA active : Service Worker enregistré !'))
              //       .catch(err => console.log('Erreur PWA Service Worker:', err));
              //   });
              // }

              // Désenregistrer les service workers existants pour éviter les conflits
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) {
                    registration.unregister();
                    console.log('Service Worker désenregistré:', registration);
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
