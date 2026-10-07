"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function GestionaleHeader() {
  const pathname = usePathname();
  const [impostazioniAperte, setImpostazioniAperte] = useState(false);

  // Non mostrare il menu del gestionale
  // nella pagina pubblica delle prenotazioni
  if (pathname === "/reservation") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center px-6">

        <Link
          href="/"
          className="mr-10 whitespace-nowrap py-4 text-xl font-bold text-gray-900"
        >
          Gestionale
        </Link>

        <nav className="flex items-center gap-2">

          <Link
            href="/prenotazioni"
            className="whitespace-nowrap rounded-lg px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 hover:text-black"
          >
            Prenotazioni
          </Link>

          <Link
            href="/cassa"
            className="whitespace-nowrap rounded-lg px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 hover:text-black"
          >
            Cassa
          </Link>

          <Link
            href="/storico"
            className="whitespace-nowrap rounded-lg px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 hover:text-black"
          >
            Storico
          </Link>

          <Link
            href="/tavoli"
            className="whitespace-nowrap rounded-lg px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 hover:text-black"
          >
            Tavoli
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setImpostazioniAperte(!impostazioniAperte)}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 hover:text-black"
            >
              Impostazioni
              <span className="text-xs">
                {impostazioniAperte ? "▲" : "▼"}
              </span>
            </button>

            {impostazioniAperte && (
              <div className="absolute right-0 top-full z-50 min-w-56 pt-1">
                <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-lg">

                  <Link
                    href="/articoli"
                    onClick={() => setImpostazioniAperte(false)}
                    className="block rounded-lg px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-black"
                  >
                    Articoli
                  </Link>

                  <Link
                    href="/impostazioni/prenotazioni"
                    onClick={() => setImpostazioniAperte(false)}
                    className="block rounded-lg px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-black"
                  >
                    Prenotazioni
                  </Link>

                </div>
              </div>
            )}

          </div>

        </nav>
      </div>
    </header>
  );
}