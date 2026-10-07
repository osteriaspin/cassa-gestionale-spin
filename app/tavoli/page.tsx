"use client";

import { useEffect, useState } from "react";

type RigaConto = {
  id: number;
  rigaId: number;
  nome: string;
  prezzo: number;
  quantita: number;
  sconto: number;
  iva: number;
};

type Articolo = {
  id: number;
  nome: string;
  categoria: string;
  prezzo: number;
  iva?: number;
};

type Tavolo = {
  id: number;
  nome: string;
  occupato: boolean;
  totale: number;
  articoli: RigaConto[];
};

type ContoCassa = {
  id: number;
  tavoloId: number;
  tavoloNome: string;
  articoli: RigaConto[];
  totale: number;
  dataInvio: string;
};

const tavoliIniziali: Tavolo[] = [
  {
    id: 1,
    nome: "T1",
    occupato: false,
    totale: 0,
    articoli: [],
  },
  {
    id: 2,
    nome: "T2",
    occupato: false,
    totale: 0,
    articoli: [],
  },
  {
    id: 3,
    nome: "T3",
    occupato: false,
    totale: 0,
    articoli: [],
  },
  {
    id: 4,
    nome: "T4",
    occupato: false,
    totale: 0,
    articoli: [],
  },
  {
    id: 5,
    nome: "T5",
    occupato: false,
    totale: 0,
    articoli: [],
  },
  {
    id: 6,
    nome: "T6",
    occupato: false,
    totale: 0,
    articoli: [],
  },
];

export default function TavoliPage() {
  const [tavoli, setTavoli] =
    useState<Tavolo[]>(tavoliIniziali);

  const [
    tavoloSelezionatoId,
    setTavoloSelezionatoId,
  ] = useState<number | null>(null);

  const [mostraArticoli, setMostraArticoli] =
    useState(false);

  const [articoli, setArticoli] =
    useState<Articolo[]>([]);

  const [caricato, setCaricato] =
    useState(false);

  const [rigaSconto, setRigaSconto] =
    useState<RigaConto | null>(null);

  const [
    percentualeSconto,
    setPercentualeSconto,
  ] = useState("10");

  const [
    quantitaSconto,
    setQuantitaSconto,
  ] = useState("1");

  const tavoloSelezionato =
    tavoloSelezionatoId === null
      ? null
      : tavoli.find(
          (tavolo) =>
            tavolo.id === tavoloSelezionatoId
        ) || null;

  /*
   * CARICAMENTO INIZIALE
   */
  useEffect(() => {
    try {
      const articoliSalvati =
        localStorage.getItem("articoli");

      if (articoliSalvati) {
        const datiArticoli =
          JSON.parse(articoliSalvati);

        if (Array.isArray(datiArticoli)) {
          setArticoli(datiArticoli);
        }
      }

      const tavoliSalvati =
        localStorage.getItem("tavoli");

      if (tavoliSalvati) {
        const datiTavoli =
          JSON.parse(tavoliSalvati);

        if (Array.isArray(datiTavoli)) {
          /*
           * Compatibilità con eventuali righe
           * salvate prima dell'aggiunta dell'IVA.
           */
          const tavoliCorretti =
            datiTavoli.map((tavolo: Tavolo) => ({
              ...tavolo,
              articoli: Array.isArray(
                tavolo.articoli
              )
                ? tavolo.articoli.map(
                    (riga: RigaConto) => ({
                      ...riga,
                      iva: riga.iva ?? 10,
                    })
                  )
                : [],
            }));

          setTavoli(tavoliCorretti);
        }
      }
    } catch (errore) {
      console.error(
        "Errore nel caricamento dei dati:",
        errore
      );
    } finally {
      setCaricato(true);
    }
  }, []);

  /*
   * SALVATAGGIO TAVOLI
   */
  useEffect(() => {
    if (!caricato) return;

    localStorage.setItem(
      "tavoli",
      JSON.stringify(tavoli)
    );
  }, [tavoli, caricato]);

  function formattaEuro(valore: number) {
    return valore
      .toFixed(2)
      .replace(".", ",");
  }

  function calcolaTotaleRiga(
    riga: RigaConto
  ) {
    const totaleLordo =
      riga.prezzo * riga.quantita;

    const valoreSconto =
      totaleLordo * (riga.sconto / 100);

    return totaleLordo - valoreSconto;
  }

  function calcolaTotaleTavolo(
    righe: RigaConto[]
  ) {
    return righe.reduce(
      (somma, riga) =>
        somma + calcolaTotaleRiga(riga),
      0
    );
  }

  function aggiornaTavolo(
    tavoloId: number,
    nuoveRighe: RigaConto[]
  ) {
    setTavoli((precedenti) =>
      precedenti.map((tavolo) => {
        if (tavolo.id !== tavoloId) {
          return tavolo;
        }

        return {
          ...tavolo,
          articoli: nuoveRighe,
          occupato: nuoveRighe.length > 0,
          totale:
            calcolaTotaleTavolo(nuoveRighe),
        };
      })
    );
  }

  /*
   * AGGIUNGI ARTICOLO
   */
  function aggiungiArticoloAlTavolo(
    articolo: Articolo
  ) {
    if (!tavoloSelezionato) return;

    const rigaEsistente =
      tavoloSelezionato.articoli.find(
        (riga) =>
          riga.id === articolo.id &&
          riga.sconto === 0
      );

    let nuoveRighe: RigaConto[];

    if (rigaEsistente) {
      nuoveRighe =
        tavoloSelezionato.articoli.map(
          (riga) =>
            riga.rigaId ===
            rigaEsistente.rigaId
              ? {
                  ...riga,
                  quantita:
                    riga.quantita + 1,
                }
              : riga
        );
    } else {
      nuoveRighe = [
        ...tavoloSelezionato.articoli,
        {
          id: articolo.id,
          rigaId:
            Date.now() +
            Math.floor(
              Math.random() * 1000
            ),
          nome: articolo.nome,
          prezzo: articolo.prezzo,
          quantita: 1,
          sconto: 0,
          iva: articolo.iva ?? 10,
        },
      ];
    }

    aggiornaTavolo(
      tavoloSelezionato.id,
      nuoveRighe
    );
  }

  /*
   * AUMENTA QUANTITÀ
   */
  function aumentaQuantita(
    rigaId: number
  ) {
    if (!tavoloSelezionato) return;

    const nuoveRighe =
      tavoloSelezionato.articoli.map(
        (riga) =>
          riga.rigaId === rigaId
            ? {
                ...riga,
                quantita:
                  riga.quantita + 1,
              }
            : riga
      );

    aggiornaTavolo(
      tavoloSelezionato.id,
      nuoveRighe
    );
  }

  /*
   * DIMINUISCE QUANTITÀ
   */
  function diminuisciQuantita(
    rigaId: number
  ) {
    if (!tavoloSelezionato) return;

    const riga =
      tavoloSelezionato.articoli.find(
        (articolo) =>
          articolo.rigaId === rigaId
      );

    if (!riga) return;

    let nuoveRighe: RigaConto[];

    if (riga.quantita <= 1) {
      nuoveRighe =
        tavoloSelezionato.articoli.filter(
          (articolo) =>
            articolo.rigaId !== rigaId
        );
    } else {
      nuoveRighe =
        tavoloSelezionato.articoli.map(
          (articolo) =>
            articolo.rigaId === rigaId
              ? {
                  ...articolo,
                  quantita:
                    articolo.quantita - 1,
                }
              : articolo
        );
    }

    aggiornaTavolo(
      tavoloSelezionato.id,
      nuoveRighe
    );
  }

  /*
   * ELIMINA RIGA
   */
  function eliminaRiga(
    rigaId: number
  ) {
    if (!tavoloSelezionato) return;

    const conferma = window.confirm(
      "Vuoi eliminare questa riga dal conto?"
    );

    if (!conferma) return;

    const nuoveRighe =
      tavoloSelezionato.articoli.filter(
        (riga) =>
          riga.rigaId !== rigaId
      );

    aggiornaTavolo(
      tavoloSelezionato.id,
      nuoveRighe
    );
  }

  /*
   * APRE MODALE SCONTO
   */
  function apriSconto(
    riga: RigaConto
  ) {
    setRigaSconto(riga);

    setPercentualeSconto(
      riga.sconto > 0
        ? riga.sconto.toString()
        : "10"
    );

    setQuantitaSconto("1");
  }

  /*
   * APPLICA SCONTO
   */
  function applicaSconto() {
    if (
      !tavoloSelezionato ||
      !rigaSconto
    ) {
      return;
    }

    const percentuale =
      Number(percentualeSconto);

    const quantitaDaScontare =
      Number(quantitaSconto);

    if (
      Number.isNaN(percentuale) ||
      percentuale < 0 ||
      percentuale > 100
    ) {
      alert(
        "Inserisci uno sconto tra 0 e 100%."
      );
      return;
    }

    if (
      Number.isNaN(quantitaDaScontare) ||
      quantitaDaScontare < 1 ||
      quantitaDaScontare >
        rigaSconto.quantita
    ) {
      alert(
        "La quantità da scontare non è valida."
      );
      return;
    }

    /*
     * Se viene scelta tutta la quantità,
     * modifichiamo direttamente la riga.
     */
    if (
      quantitaDaScontare ===
      rigaSconto.quantita
    ) {
      const nuoveRighe =
        tavoloSelezionato.articoli.map(
          (riga) =>
            riga.rigaId ===
            rigaSconto.rigaId
              ? {
                  ...riga,
                  sconto: percentuale,
                }
              : riga
        );

      aggiornaTavolo(
        tavoloSelezionato.id,
        nuoveRighe
      );

      setRigaSconto(null);
      return;
    }

    /*
     * Se viene scontata solo una parte
     * della quantità, dividiamo la riga.
     */
    const nuoveRighe =
      tavoloSelezionato.articoli.flatMap(
        (riga) => {
          if (
            riga.rigaId !==
            rigaSconto.rigaId
          ) {
            return [riga];
          }

          const parteRimanente: RigaConto =
            {
              ...riga,
              quantita:
                riga.quantita -
                quantitaDaScontare,
            };

          const parteScontata: RigaConto =
            {
              ...riga,
              rigaId:
                Date.now() +
                Math.floor(
                  Math.random() * 1000
                ),
              quantita:
                quantitaDaScontare,
              sconto: percentuale,
            };

          return [
            parteRimanente,
            parteScontata,
          ];
        }
      );

    aggiornaTavolo(
      tavoloSelezionato.id,
      nuoveRighe
    );

    setRigaSconto(null);
  }

  /*
   * RIMUOVE SCONTO
   */
  function rimuoviSconto(
    rigaId: number
  ) {
    if (!tavoloSelezionato) return;

    const nuoveRighe =
      tavoloSelezionato.articoli.map(
        (riga) =>
          riga.rigaId === rigaId
            ? {
                ...riga,
                sconto: 0,
              }
            : riga
      );

    aggiornaTavolo(
      tavoloSelezionato.id,
      nuoveRighe
    );
  }

  /*
   * INVIA IL CONTO IN CASSA
   */
  function inviaInCassa() {
    if (!tavoloSelezionato) return;

    if (
      tavoloSelezionato.articoli.length ===
      0
    ) {
      alert(
        "Il tavolo non contiene articoli."
      );
      return;
    }

    let contiCassa: ContoCassa[] = [];

    try {
      const contiSalvati =
        localStorage.getItem("contiCassa");

      if (contiSalvati) {
        const dati =
          JSON.parse(contiSalvati);

        if (Array.isArray(dati)) {
          contiCassa = dati;
        }
      }
    } catch (errore) {
      console.error(
        "Errore lettura conti Cassa:",
        errore
      );

      contiCassa = [];
    }

    const giaPresente =
      contiCassa.some(
        (conto) =>
          conto.tavoloId ===
          tavoloSelezionato.id
      );

    if (giaPresente) {
      alert(
        `${tavoloSelezionato.nome} è già stato inviato in Cassa.`
      );
      return;
    }

    const conferma =
      window.confirm(
        `Inviare ${tavoloSelezionato.nome} in Cassa per € ${formattaEuro(
          tavoloSelezionato.totale
        )}?`
      );

    if (!conferma) return;

    const nuovoConto: ContoCassa = {
      id:
        Date.now() +
        Math.floor(
          Math.random() * 1000
        ),
      tavoloId:
        tavoloSelezionato.id,
      tavoloNome:
        tavoloSelezionato.nome,
      articoli:
        tavoloSelezionato.articoli,
      totale:
        tavoloSelezionato.totale,
      dataInvio:
        new Date().toISOString(),
    };

    localStorage.setItem(
      "contiCassa",
      JSON.stringify([
        ...contiCassa,
        nuovoConto,
      ])
    );

    setMostraArticoli(false);

    alert(
      `${tavoloSelezionato.nome} inviato in Cassa.`
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-black">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-4xl font-bold">
          Tavoli
        </h1>

        {/* TAVOLI */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {tavoli.map((tavolo) => (
            <button
              key={tavolo.id}
              onClick={() => {
                setTavoloSelezionatoId(
                  tavolo.id
                );

                setMostraArticoli(false);
              }}
              className={`rounded-xl border bg-white p-6 text-center shadow transition hover:scale-105 ${
                tavoloSelezionatoId ===
                tavolo.id
                  ? "border-black ring-2 ring-black"
                  : "border-gray-300"
              }`}
            >
              <h2 className="text-2xl font-bold">
                {tavolo.nome}
              </h2>

              <p
                className={`mt-2 font-semibold ${
                  tavolo.occupato
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {tavolo.occupato
                  ? "Occupato"
                  : "Libero"}
              </p>

              <p className="mt-3 text-lg font-bold">
                € {formattaEuro(tavolo.totale)}
              </p>
            </button>
          ))}
        </div>

        {/* DETTAGLIO TAVOLO */}
        {tavoloSelezionato && (
          <div className="mt-8 rounded-xl bg-white p-6 shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {tavoloSelezionato.nome}
                </h2>

                <p className="mt-2">
                  Stato:{" "}
                  <strong
                    className={
                      tavoloSelezionato.occupato
                        ? "text-red-600"
                        : "text-green-600"
                    }
                  >
                    {tavoloSelezionato.occupato
                      ? "Occupato"
                      : "Libero"}
                  </strong>
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-sm text-gray-500">
                  Totale tavolo
                </p>

                <p className="text-3xl font-bold">
                  €{" "}
                  {formattaEuro(
                    tavoloSelezionato.totale
                  )}
                </p>
              </div>
            </div>

            {/* PULSANTI */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() =>
                  setMostraArticoli(
                    !mostraArticoli
                  )
                }
                className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
              >
                {mostraArticoli
                  ? "Chiudi Articoli"
                  : "+ Aggiungi Articolo"}
              </button>

              <button
                onClick={inviaInCassa}
                disabled={
                  tavoloSelezionato.articoli
                    .length === 0
                }
                className="rounded-lg border border-green-600 px-4 py-2 font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Invia in Cassa
              </button>
            </div>

            {/* ARTICOLI DISPONIBILI */}
            {mostraArticoli && (
              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 font-bold">
                  Articoli
                </h3>

                {articoli.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nessun articolo disponibile.
                    Crealo da Impostazioni →
                    Articoli.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {articoli.map(
                      (articolo) => (
                        <button
                          key={articolo.id}
                          onClick={() =>
                            aggiungiArticoloAlTavolo(
                              articolo
                            )
                          }
                          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-left hover:bg-gray-100"
                        >
                          <div>
                            <p className="font-medium">
                              {
                                articolo.nome
                              }
                            </p>

                            <p className="text-xs text-gray-500">
                              {
                                articolo.categoria
                              }
                              {" · IVA "}
                              {articolo.iva ??
                                10}
                              %
                            </p>
                          </div>

                          <span className="font-semibold">
                            €{" "}
                            {formattaEuro(
                              articolo.prezzo
                            )}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CONTO TAVOLO */}
            {tavoloSelezionato.articoli
              .length > 0 && (
              <div className="mt-6 border-t pt-5">
                <h3 className="mb-4 text-xl font-bold">
                  Conto Tavolo
                </h3>

                <div className="space-y-3">
                  {tavoloSelezionato.articoli.map(
                    (riga) => {
                      const lordo =
                        riga.prezzo *
                        riga.quantita;

                      const valoreSconto =
                        lordo *
                        (riga.sconto /
                          100);

                      const totale =
                        calcolaTotaleRiga(
                          riga
                        );

                      return (
                        <div
                          key={riga.rigaId}
                          className="rounded-xl border border-gray-200 p-4"
                        >
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            {/* DESCRIZIONE */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-lg font-bold">
                                  {riga.nome}
                                </h4>

                                {riga.sconto >
                                  0 && (
                                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                                    Sconto{" "}
                                    {
                                      riga.sconto
                                    }
                                    %
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 text-sm text-gray-500">
                                €{" "}
                                {formattaEuro(
                                  riga.prezzo
                                )}{" "}
                                cad.
                              </p>

                              <p className="text-xs text-gray-400">
                                IVA{" "}
                                {riga.iva ??
                                  10}
                                %
                              </p>

                              {riga.sconto >
                                0 && (
                                <div className="mt-2 text-sm">
                                  <p className="text-gray-500">
                                    Prezzo
                                    originale: €{" "}
                                    {formattaEuro(
                                      lordo
                                    )}
                                  </p>

                                  <p className="font-medium text-green-700">
                                    Sconto: - €{" "}
                                    {formattaEuro(
                                      valoreSconto
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* QUANTITÀ */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  diminuisciQuantita(
                                    riga.rigaId
                                  )
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-xl hover:bg-gray-100"
                              >
                                −
                              </button>

                              <span className="min-w-8 text-center text-lg font-bold">
                                {
                                  riga.quantita
                                }
                              </span>

                              <button
                                onClick={() =>
                                  aumentaQuantita(
                                    riga.rigaId
                                  )
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-xl hover:bg-gray-100"
                              >
                                +
                              </button>
                            </div>

                            {/* TOTALE RIGA */}
                            <div className="min-w-28 md:text-right">
                              <p className="text-xs text-gray-500">
                                Totale
                              </p>

                              <p className="text-xl font-bold">
                                €{" "}
                                {formattaEuro(
                                  totale
                                )}
                              </p>
                            </div>

                            {/* AZIONI */}
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() =>
                                  apriSconto(
                                    riga
                                  )
                                }
                                className="rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                              >
                                Sconto
                              </button>

                              {riga.sconto >
                                0 && (
                                <button
                                  onClick={() =>
                                    rimuoviSconto(
                                      riga.rigaId
                                    )
                                  }
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                  Togli sconto
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  eliminaRiga(
                                    riga.rigaId
                                  )
                                }
                                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                Elimina
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                {/* TOTALE FINALE */}
                <div className="mt-6 flex items-center justify-between border-t pt-5">
                  <span className="text-xl font-bold">
                    TOTALE
                  </span>

                  <span className="text-3xl font-bold">
                    €{" "}
                    {formattaEuro(
                      tavoloSelezionato.totale
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALE SCONTO */}
      {rigaSconto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Applica sconto
                </h2>

                <p className="mt-1 text-gray-500">
                  {rigaSconto.nome}
                </p>
              </div>

              <button
                onClick={() =>
                  setRigaSconto(null)
                }
                className="text-2xl text-gray-400 hover:text-black"
              >
                ×
              </button>
            </div>

            {/* QUANTITÀ DA SCONTARE */}
            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium">
                Quantità da scontare
              </label>

              <select
                value={quantitaSconto}
                onChange={(e) =>
                  setQuantitaSconto(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              >
                {Array.from(
                  {
                    length:
                      rigaSconto.quantita,
                  },
                  (_, indice) =>
                    indice + 1
                ).map((numero) => (
                  <option
                    key={numero}
                    value={numero}
                  >
                    {numero} unità
                  </option>
                ))}
              </select>
            </div>

            {/* PERCENTUALE */}
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium">
                Sconto %
              </label>

              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={
                  percentualeSconto
                }
                onChange={(e) =>
                  setPercentualeSconto(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              />
            </div>

            {/* ANTEPRIMA */}
            <div className="mt-6 rounded-lg bg-gray-100 p-4">
              <p className="text-sm text-gray-500">
                Anteprima
              </p>

              <p className="mt-1 font-medium">
                {quantitaSconto} ×{" "}
                {rigaSconto.nome} con
                sconto{" "}
                {percentualeSconto || 0}%
              </p>
            </div>

            {/* PULSANTI MODALE */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() =>
                  setRigaSconto(null)
                }
                className="rounded-lg border border-gray-300 px-4 py-3 font-medium hover:bg-gray-50"
              >
                Annulla
              </button>

              <button
                onClick={applicaSconto}
                className="rounded-lg bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800"
              >
                Applica sconto
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}