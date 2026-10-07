"use client";

import { useEffect, useMemo, useState } from "react";

type RigaConto = {
  id: number;
  rigaId: number;
  nome: string;
  prezzo: number;
  quantita: number;
  sconto: number;
  iva: number;
};

type MetodoPagamento = "contanti" | "carta";

type Vendita = {
  id: number;
  origine: "tavolo" | "diretta";
  tavoloNome?: string;
  articoli: RigaConto[];
  totale: number;
  data: string;
  metodoPagamento: MetodoPagamento;
  contantiRicevuti?: number;
  resto?: number;
};

export default function StoricoPage() {
  const [vendite, setVendite] = useState<Vendita[]>([]);
  const [dataSelezionata, setDataSelezionata] = useState("");
  const [venditaAperta, setVenditaAperta] = useState<number | null>(null);

  /*
   * CARICAMENTO VENDITE
   */
  useEffect(() => {
    try {
      const salvate = localStorage.getItem("vendite");

      if (salvate) {
        const dati = JSON.parse(salvate);

        if (Array.isArray(dati)) {
          setVendite(dati);
        }
      }
    } catch (errore) {
      console.error("Errore caricamento storico:", errore);
    }
  }, []);

  /*
   * FORMATO EURO
   */
  function formattaEuro(valore: number) {
    return valore.toFixed(2).replace(".", ",");
  }

  /*
   * DATA LOCALE YYYY-MM-DD
   */
  function dataLocale(dataIso: string) {
    const data = new Date(dataIso);

    const anno = data.getFullYear();
    const mese = String(data.getMonth() + 1).padStart(2, "0");
    const giorno = String(data.getDate()).padStart(2, "0");

    return `${anno}-${mese}-${giorno}`;
  }

  /*
   * DATA VISIBILE
   */
  function formattaData(dataIso: string) {
    return new Date(dataIso).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  /*
   * ORA VISIBILE
   */
  function formattaOra(dataIso: string) {
    return new Date(dataIso).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /*
   * DATE DISPONIBILI
   */
  const dateDisponibili = useMemo(() => {
    const date = vendite.map((vendita) => dataLocale(vendita.data));

    return Array.from(new Set(date)).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [vendite]);

  /*
   * IMPOSTA AUTOMATICAMENTE
   * L'ULTIMA GIORNATA DISPONIBILE
   */
  useEffect(() => {
    if (!dataSelezionata && dateDisponibili.length > 0) {
      setDataSelezionata(dateDisponibili[0]);
    }
  }, [dateDisponibili, dataSelezionata]);

  /*
   * VENDITE DEL GIORNO
   */
  const venditeGiorno = useMemo(() => {
    if (!dataSelezionata) {
      return [];
    }

    return vendite
      .filter((vendita) => dataLocale(vendita.data) === dataSelezionata)
      .sort(
        (a, b) =>
          new Date(b.data).getTime() -
          new Date(a.data).getTime()
      );
  }, [vendite, dataSelezionata]);

  /*
   * TOTALI
   */
  const totaleGiorno = venditeGiorno.reduce(
    (somma, vendita) => somma + vendita.totale,
    0
  );

  const totaleContanti = venditeGiorno
    .filter((vendita) => vendita.metodoPagamento === "contanti")
    .reduce((somma, vendita) => somma + vendita.totale, 0);

  const totaleCarta = venditeGiorno
    .filter((vendita) => vendita.metodoPagamento === "carta")
    .reduce((somma, vendita) => somma + vendita.totale, 0);

  const numeroContanti = venditeGiorno.filter(
    (vendita) => vendita.metodoPagamento === "contanti"
  ).length;

  const numeroCarta = venditeGiorno.filter(
    (vendita) => vendita.metodoPagamento === "carta"
  ).length;

  /*
   * TOTALE SCONTI DEL GIORNO
   */
  const totaleSconti = venditeGiorno.reduce((totale, vendita) => {
    const scontiVendita = vendita.articoli.reduce((somma, riga) => {
      const lordo = riga.prezzo * riga.quantita;
      const sconto = lordo * ((riga.sconto || 0) / 100);

      return somma + sconto;
    }, 0);

    return totale + scontiVendita;
  }, 0);

  /*
   * IMPONIBILE / IVA
   *
   * Il prezzo degli articoli viene considerato
   * IVA inclusa.
   */
  const riepilogoIva = useMemo(() => {
    const riepilogo: Record<
      number,
      {
        aliquota: number;
        lordo: number;
        imponibile: number;
        iva: number;
      }
    > = {};

    venditeGiorno.forEach((vendita) => {
      vendita.articoli.forEach((riga) => {
        const aliquota = riga.iva ?? 10;

        const lordoOriginale = riga.prezzo * riga.quantita;

        const lordo =
          lordoOriginale -
          lordoOriginale * ((riga.sconto || 0) / 100);

        const imponibile = lordo / (1 + aliquota / 100);

        const iva = lordo - imponibile;

        if (!riepilogo[aliquota]) {
          riepilogo[aliquota] = {
            aliquota,
            lordo: 0,
            imponibile: 0,
            iva: 0,
          };
        }

        riepilogo[aliquota].lordo += lordo;
        riepilogo[aliquota].imponibile += imponibile;
        riepilogo[aliquota].iva += iva;
      });
    });

    return Object.values(riepilogo).sort(
      (a, b) => a.aliquota - b.aliquota
    );
  }, [venditeGiorno]);

  /*
   * CANCELLA TUTTO LO STORICO
   *
   * Utile in questa fase di sviluppo.
   */
  function cancellaStorico() {
    if (vendite.length === 0) {
      return;
    }

    const conferma = window.confirm(
      "Vuoi cancellare tutto lo storico delle vendite?\n\nQuesta operazione non può essere annullata."
    );

    if (!conferma) {
      return;
    }

    localStorage.removeItem("vendite");

    setVendite([]);
    setDataSelezionata("");
    setVenditaAperta(null);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-black">
      <div className="mx-auto max-w-7xl">
        {/* TITOLO */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold">
              Storico vendite
            </h1>

            <p className="mt-1 text-gray-500">
              Incassi e riepilogo giornaliero
            </p>
          </div>

          {vendite.length > 0 && (
            <button
              onClick={cancellaStorico}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Cancella storico
            </button>
          )}
        </div>

        {/* NESSUNA VENDITA */}
        {vendite.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow">
            <p className="text-xl font-semibold">
              Nessuna vendita registrata
            </p>

            <p className="mt-2 text-gray-500">
              Le vendite incassate dalla Cassa appariranno qui.
            </p>
          </div>
        ) : (
          <>
            {/* SELEZIONE DATA */}
            <div className="mb-6 rounded-xl bg-white p-5 shadow">
              <label className="mb-2 block font-semibold">
                Giornata
              </label>

              <select
                value={dataSelezionata}
                onChange={(e) => {
                  setDataSelezionata(e.target.value);
                  setVenditaAperta(null);
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-lg sm:w-auto"
              >
                {dateDisponibili.map((data) => (
                  <option key={data} value={data}>
                    {new Date(`${data}T12:00:00`).toLocaleDateString(
                      "it-IT",
                      {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      }
                    )}
                  </option>
                ))}
              </select>
            </div>

            {/* RIEPILOGO */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-white p-5 shadow">
                <p className="text-sm font-medium text-gray-500">
                  Incasso totale
                </p>

                <p className="mt-2 text-3xl font-bold">
                  € {formattaEuro(totaleGiorno)}
                </p>
              </div>

              <div className="rounded-xl bg-white p-5 shadow">
                <p className="text-sm font-medium text-gray-500">
                  Contanti
                </p>

                <p className="mt-2 text-3xl font-bold">
                  € {formattaEuro(totaleContanti)}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {numeroContanti} pagamenti
                </p>
              </div>

              <div className="rounded-xl bg-white p-5 shadow">
                <p className="text-sm font-medium text-gray-500">
                  Carta
                </p>

                <p className="mt-2 text-3xl font-bold">
                  € {formattaEuro(totaleCarta)}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {numeroCarta} pagamenti
                </p>
              </div>

              <div className="rounded-xl bg-white p-5 shadow">
                <p className="text-sm font-medium text-gray-500">
                  Vendite
                </p>

                <p className="mt-2 text-3xl font-bold">
                  {venditeGiorno.length}
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Sconti € {formattaEuro(totaleSconti)}
                </p>
              </div>
            </div>

            {/* RIEPILOGO IVA */}
            <div className="mb-6 rounded-xl bg-white p-5 shadow">
              <h2 className="mb-4 text-2xl font-bold">
                Riepilogo IVA
              </h2>

              {riepilogoIva.length === 0 ? (
                <p className="text-gray-500">
                  Nessun dato IVA disponibile.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-sm text-gray-500">
                        <th className="pb-3">
                          Aliquota
                        </th>

                        <th className="pb-3 text-right">
                          Imponibile
                        </th>

                        <th className="pb-3 text-right">
                          IVA
                        </th>

                        <th className="pb-3 text-right">
                          Totale
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {riepilogoIva.map((riga) => (
                        <tr
                          key={riga.aliquota}
                          className="border-b last:border-b-0"
                        >
                          <td className="py-4 font-bold">
                            IVA {riga.aliquota}%
                          </td>

                          <td className="py-4 text-right">
                            € {formattaEuro(riga.imponibile)}
                          </td>

                          <td className="py-4 text-right">
                            € {formattaEuro(riga.iva)}
                          </td>

                          <td className="py-4 text-right font-bold">
                            € {formattaEuro(riga.lordo)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ELENCO VENDITE */}
            <div className="rounded-xl bg-white p-5 shadow">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  Vendite della giornata
                </h2>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold">
                  {venditeGiorno.length}
                </span>
              </div>

              {venditeGiorno.length === 0 ? (
                <p className="text-gray-500">
                  Nessuna vendita per questa giornata.
                </p>
              ) : (
                <div className="space-y-3">
                  {venditeGiorno.map((vendita) => {
                    const aperta =
                      venditaAperta === vendita.id;

                    return (
                      <div
                        key={vendita.id}
                        className="overflow-hidden rounded-xl border border-gray-200"
                      >
                        {/* TESTATA VENDITA */}
                        <button
                          onClick={() =>
                            setVenditaAperta(
                              aperta ? null : vendita.id
                            )
                          }
                          className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-gray-50"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold">
                                {vendita.origine === "tavolo"
                                  ? vendita.tavoloNome || "Tavolo"
                                  : "Vendita diretta"}
                              </p>

                              <span
                                className={`rounded-full px-2 py-1 text-xs font-bold ${
                                  vendita.metodoPagamento === "contanti"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {vendita.metodoPagamento === "contanti"
                                  ? "CONTANTI"
                                  : "CARTA"}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-gray-500">
                              {formattaData(vendita.data)} ·{" "}
                              {formattaOra(vendita.data)}
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <p className="text-xl font-bold">
                              € {formattaEuro(vendita.totale)}
                            </p>

                            <span className="text-xl">
                              {aperta ? "▲" : "▼"}
                            </span>
                          </div>
                        </button>

                        {/* DETTAGLIO */}
                        {aperta && (
                          <div className="border-t bg-gray-50 p-4">
                            <div className="space-y-3">
                              {vendita.articoli.map((riga) => {
                                const lordo =
                                  riga.prezzo * riga.quantita;

                                const valoreSconto =
                                  lordo *
                                  ((riga.sconto || 0) / 100);

                                const totaleRiga =
                                  lordo - valoreSconto;

                                return (
                                  <div
                                    key={riga.rigaId}
                                    className="rounded-lg bg-white p-3"
                                  >
                                    <div className="flex justify-between gap-4">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-semibold">
                                            {riga.nome}
                                          </p>

                                          {riga.sconto > 0 && (
                                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                                              Sconto {riga.sconto}%
                                            </span>
                                          )}
                                        </div>

                                        <p className="mt-1 text-sm text-gray-500">
                                          {riga.quantita} × €{" "}
                                          {formattaEuro(riga.prezzo)}
                                        </p>

                                        <p className="text-xs text-gray-400">
                                          IVA {riga.iva ?? 10}%
                                        </p>

                                        {riga.sconto > 0 && (
                                          <p className="mt-1 text-sm text-green-700">
                                            Sconto: - €{" "}
                                            {formattaEuro(valoreSconto)}
                                          </p>
                                        )}
                                      </div>

                                      <p className="font-bold">
                                        € {formattaEuro(totaleRiga)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* DATI PAGAMENTO */}
                            <div className="mt-4 border-t pt-4">
                              <div className="flex justify-between">
                                <span className="text-gray-500">
                                  Metodo
                                </span>

                                <span className="font-semibold">
                                  {vendita.metodoPagamento === "contanti"
                                    ? "Contanti"
                                    : "Carta"}
                                </span>
                              </div>

                              {vendita.metodoPagamento === "contanti" &&
                                vendita.contantiRicevuti !== undefined && (
                                  <>
                                    <div className="mt-2 flex justify-between">
                                      <span className="text-gray-500">
                                        Ricevuti
                                      </span>

                                      <span>
                                        €{" "}
                                        {formattaEuro(
                                          vendita.contantiRicevuti
                                        )}
                                      </span>
                                    </div>

                                    <div className="mt-2 flex justify-between">
                                      <span className="text-gray-500">
                                        Resto
                                      </span>

                                      <span>
                                        €{" "}
                                        {formattaEuro(
                                          vendita.resto ?? 0
                                        )}
                                      </span>
                                    </div>
                                  </>
                                )}

                              <div className="mt-4 flex justify-between border-t pt-4 text-xl font-bold">
                                <span>Totale</span>

                                <span>
                                  € {formattaEuro(vendita.totale)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}