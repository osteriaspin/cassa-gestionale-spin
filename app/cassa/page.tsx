"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Articolo = {
  id: number;
  nome: string;
  categoria: string;
  prezzo: number;
  iva?: number;
};

type RigaConto = {
  id: number;
  rigaId: number;
  nome: string;
  prezzo: number;
  quantita: number;
  sconto: number;
  iva: number;
};

type ContoTavolo = {
  id: number;
  tavoloId: number;
  tavoloNome: string;
  articoli: RigaConto[];
  totale: number;
  dataInvio: string;
};

type Tavolo = {
  id: number;
  nome: string;
  occupato: boolean;
  totale: number;
  articoli: RigaConto[];
};

type MetodoPagamento =
  | "contanti"
  | "carta";

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

const categorie = [
  "Tutti",
  "Bibite",
  "Vini",
  "Menu",
  "Dessert",
  "Aperitivi",
];

export default function CassaPage() {
  const [ristoranteId, setRistoranteId] = useState<string | null>(null);
  const [stampaFiscaleInCorso, setStampaFiscaleInCorso] = useState(false);
  const [categoriaAttiva, setCategoriaAttiva] =
    useState("Tutti");

  const [articoli, setArticoli] =
    useState<Articolo[]>([]);

  const [contoDiretto, setContoDiretto] =
    useState<RigaConto[]>([]);

  const [contiTavoli, setContiTavoli] =
    useState<ContoTavolo[]>([]);

  const [
    contoTavoloSelezionatoId,
    setContoTavoloSelezionatoId,
  ] = useState<number | null>(null);

  /*
   * PAGAMENTO
   */
  const [
    mostraPagamento,
    setMostraPagamento,
  ] = useState(false);

  const [
    metodoPagamento,
    setMetodoPagamento,
  ] =
    useState<MetodoPagamento | null>(
      null
    );

  const [
    contantiRicevuti,
    setContantiRicevuti,
  ] = useState("");

  /*
   * CONTO TAVOLO SELEZIONATO
   */
  const contoTavoloSelezionato =
    contoTavoloSelezionatoId === null
      ? null
      : contiTavoli.find(
          (conto) =>
            conto.id ===
            contoTavoloSelezionatoId
        ) || null;

  /*
   * RISTORANTE / CODA FISCALE
   */
  useEffect(() => {
    async function caricaRistorante() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const { data } = await supabase
        .from("utenti_ristoranti")
        .select("ristorante_id")
        .eq("user_id", authData.user.id)
        .limit(1)
        .maybeSingle();

      if (data?.ristorante_id) {
        setRistoranteId(data.ristorante_id);
      }
    }

    caricaRistorante();
  }, []);

  async function stampaDocumentoFiscale(
    receiptId: string,
    righe: RigaConto[],
    totale: number,
    metodo: MetodoPagamento
  ) {
    if (metodo !== "contanti") {
      throw new Error(
        "La stampa fiscale con carta non è ancora abilitata: usa CONTANTI finché non viene configurato il codice pagamento carta sulla KUBE."
      );
    }

    if (!ristoranteId) {
      throw new Error("Ristorante non identificato. Ricarica la pagina e riprova.");
    }

    const payload = {
      payment: "CONTANTI",
      totalCents: Math.round(totale * 100),
      items: righe.map((riga) => ({
        description: riga.nome,
        vat: riga.iva,
        lineCents: Math.round(calcolaTotaleRiga(riga) * 100),
      })),
    };

    const { data: job, error: insertError } = await supabase
      .from("fiscal_jobs")
      .insert({
        ristorante_id: ristoranteId,
        receipt_id: receiptId,
        payload,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !job) {
      throw new Error(
        "Impossibile mettere lo scontrino in coda: " +
          (insertError?.message || "errore sconosciuto")
      );
    }

    const scadenza = Date.now() + 60000;

    while (Date.now() < scadenza) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { data, error } = await supabase
        .from("fiscal_jobs")
        .select("status,error")
        .eq("id", job.id)
        .single();

      if (error) {
        throw new Error("Errore controllo stampa fiscale: " + error.message);
      }

      if (data.status === "printed") return;

      if (data.status === "error") {
        throw new Error(
          data.error ||
            "La KUBE non ha confermato la stampa. Non ripetere automaticamente."
        );
      }
    }

    throw new Error(
      "La stampa non è stata confermata entro 60 secondi. Non ripetere il pagamento: controlla la KUBE e la coda fiscale."
    );
  }

  /*
   * CARICAMENTO
   */
  useEffect(() => {
    try {
      const articoliSalvati =
        localStorage.getItem("articoli");

      if (articoliSalvati) {
        const dati =
          JSON.parse(articoliSalvati);

        if (Array.isArray(dati)) {
          setArticoli(dati);
        }
      }

      const contiSalvati =
        localStorage.getItem(
          "contiCassa"
        );

      if (contiSalvati) {
        const dati =
          JSON.parse(contiSalvati);

        if (Array.isArray(dati)) {
          const corretti =
            dati.map(
              (conto: ContoTavolo) => ({
                ...conto,

                articoli:
                  Array.isArray(
                    conto.articoli
                  )
                    ? conto.articoli.map(
                        (
                          riga: RigaConto
                        ) => ({
                          ...riga,

                          iva:
                            riga.iva ??
                            10,

                          sconto:
                            riga.sconto ??
                            0,
                        })
                      )
                    : [],
              })
            );

          setContiTavoli(corretti);
        }
      }
    } catch (errore) {
      console.error(
        "Errore caricamento Cassa:",
        errore
      );
    }
  }, []);

  function formattaEuro(
    valore: number
  ) {
    return valore
      .toFixed(2)
      .replace(".", ",");
  }

  function calcolaTotaleRiga(
    riga: RigaConto
  ) {
    const lordo =
      riga.prezzo *
      riga.quantita;

    const sconto =
      lordo *
      (riga.sconto / 100);

    return lordo - sconto;
  }

  const totaleDiretto =
    contoDiretto.reduce(
      (somma, riga) =>
        somma +
        calcolaTotaleRiga(riga),
      0
    );

  const articoliFiltrati =
    categoriaAttiva === "Tutti"
      ? articoli
      : articoli.filter(
          (articolo) =>
            articolo.categoria ===
            categoriaAttiva
        );

  /*
   * ARTICOLI VENDITA DIRETTA
   */
  function aggiungiArticolo(
    articolo: Articolo
  ) {
    if (contoTavoloSelezionato) {
      return;
    }

    setContoDiretto(
      (precedente) => {
        const esistente =
          precedente.find(
            (riga) =>
              riga.id ===
                articolo.id &&
              riga.sconto === 0
          );

        if (esistente) {
          return precedente.map(
            (riga) =>
              riga.rigaId ===
              esistente.rigaId
                ? {
                    ...riga,
                    quantita:
                      riga.quantita +
                      1,
                  }
                : riga
          );
        }

        return [
          ...precedente,

          {
            id: articolo.id,

            rigaId:
              Date.now() +
              Math.floor(
                Math.random() *
                  1000
              ),

            nome: articolo.nome,

            prezzo:
              articolo.prezzo,

            quantita: 1,

            sconto: 0,

            iva:
              articolo.iva ?? 10,
          },
        ];
      }
    );
  }

  function aumentaQuantita(
    rigaId: number
  ) {
    setContoDiretto(
      (precedente) =>
        precedente.map(
          (riga) =>
            riga.rigaId === rigaId
              ? {
                  ...riga,
                  quantita:
                    riga.quantita +
                    1,
                }
              : riga
        )
    );
  }

  function diminuisciQuantita(
    rigaId: number
  ) {
    setContoDiretto(
      (precedente) =>
        precedente
          .map(
            (riga) =>
              riga.rigaId ===
              rigaId
                ? {
                    ...riga,

                    quantita:
                      riga.quantita -
                      1,
                  }
                : riga
          )
          .filter(
            (riga) =>
              riga.quantita > 0
          )
    );
  }

  function eliminaRigaDiretta(
    rigaId: number
  ) {
    setContoDiretto(
      (precedente) =>
        precedente.filter(
          (riga) =>
            riga.rigaId !==
            rigaId
        )
    );
  }

  /*
   * TAVOLI
   */
  function selezionaContoTavolo(
    conto: ContoTavolo
  ) {
    setContoTavoloSelezionatoId(
      conto.id
    );

    chiudiPagamento();
  }

  function tornaVenditaDiretta() {
    setContoTavoloSelezionatoId(
      null
    );

    chiudiPagamento();
  }

  /*
   * STORICO VENDITE
   */
  function salvaVendita(
    vendita: Vendita
  ) {
    try {
      const salvate =
        localStorage.getItem(
          "vendite"
        );

      let vendite: Vendita[] = [];

      if (salvate) {
        const dati =
          JSON.parse(salvate);

        if (Array.isArray(dati)) {
          vendite = dati;
        }
      }

      localStorage.setItem(
        "vendite",
        JSON.stringify([
          ...vendite,
          vendita,
        ])
      );
    } catch (errore) {
      console.error(
        "Errore salvataggio vendita:",
        errore
      );
    }
  }

  /*
   * PAGAMENTO
   */
  function apriPagamento() {
    if (
      righeVisualizzate.length ===
      0
    ) {
      alert("Il conto è vuoto.");
      return;
    }

    setMetodoPagamento(null);

    setContantiRicevuti("");

    setMostraPagamento(true);
  }

  function chiudiPagamento() {
    setMostraPagamento(false);

    setMetodoPagamento(null);

    setContantiRicevuti("");
  }

  async function confermaPagamento() {
    if (!metodoPagamento) {
      alert(
        "Seleziona il metodo di pagamento."
      );

      return;
    }

    if (
      metodoPagamento ===
      "contanti"
    ) {
      if (
        contantiRicevuti.trim() ===
          "" ||
        Number.isNaN(
          contantiNumero
        )
      ) {
        alert(
          "Inserisci l'importo ricevuto."
        );

        return;
      }

      if (
        contantiNumero <
        totaleVisualizzato
      ) {
        alert(
          "L'importo ricevuto è inferiore al totale."
        );

        return;
      }
    }

    const righeDaStampare = contoTavoloSelezionato
      ? contoTavoloSelezionato.articoli
      : contoDiretto;

    const totaleDaStampare = contoTavoloSelezionato
      ? contoTavoloSelezionato.totale
      : totaleDiretto;

    const receiptId =
      "CASSA-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);

    try {
      setStampaFiscaleInCorso(true);
      await stampaDocumentoFiscale(
        receiptId,
        righeDaStampare,
        totaleDaStampare,
        metodoPagamento
      );
    } catch (errore) {
      alert(
        errore instanceof Error
          ? errore.message
          : "Errore durante la stampa fiscale."
      );
      return;
    } finally {
      setStampaFiscaleInCorso(false);
    }

    /*
     * VENDITA TAVOLO
     */
    if (
      contoTavoloSelezionato
    ) {
      const vendita: Vendita = {
        id:
          Date.now() +
          Math.floor(
            Math.random() * 1000
          ),

        origine: "tavolo",

        tavoloNome:
          contoTavoloSelezionato.tavoloNome,

        articoli:
          contoTavoloSelezionato.articoli,

        totale:
          contoTavoloSelezionato.totale,

        data:
          new Date().toISOString(),

        metodoPagamento,

        ...(metodoPagamento ===
        "contanti"
          ? {
              contantiRicevuti:
                contantiNumero,

              resto,
            }
          : {}),
      };

      salvaVendita(vendita);

      /*
       * LIBERA TAVOLO
       */
      try {
        const tavoliSalvati =
          localStorage.getItem(
            "tavoli"
          );

        if (tavoliSalvati) {
          const dati =
            JSON.parse(
              tavoliSalvati
            );

          if (
            Array.isArray(dati)
          ) {
            const aggiornati =
              dati.map(
                (
                  tavolo: Tavolo
                ) =>
                  tavolo.id ===
                  contoTavoloSelezionato.tavoloId
                    ? {
                        ...tavolo,

                        occupato:
                          false,

                        totale: 0,

                        articoli:
                          [],
                      }
                    : tavolo
              );

            localStorage.setItem(
              "tavoli",

              JSON.stringify(
                aggiornati
              )
            );
          }
        }
      } catch (errore) {
        console.error(
          "Errore liberazione tavolo:",
          errore
        );
      }

      /*
       * RIMUOVE DALLA CASSA
       */
      const nuoviConti =
        contiTavoli.filter(
          (conto) =>
            conto.id !==
            contoTavoloSelezionato.id
        );

      localStorage.setItem(
        "contiCassa",

        JSON.stringify(
          nuoviConti
        )
      );

      setContiTavoli(
        nuoviConti
      );

      const nome =
        contoTavoloSelezionato.tavoloNome;

      const totale =
        contoTavoloSelezionato.totale;

      setContoTavoloSelezionatoId(
        null
      );

      chiudiPagamento();

      if (
        metodoPagamento ===
        "contanti"
      ) {
        alert(
          `Pagamento ${nome} registrato.\n\nTotale: € ${formattaEuro(
            totale
          )}\nRicevuti: € ${formattaEuro(
            contantiNumero
          )}\nResto: € ${formattaEuro(
            resto
          )}`
        );
      } else {
        alert(
          `Pagamento ${nome} con carta registrato.\n\nTotale: € ${formattaEuro(
            totale
          )}`
        );
      }

      return;
    }

    /*
     * VENDITA DIRETTA
     */
    const vendita: Vendita = {
      id:
        Date.now() +
        Math.floor(
          Math.random() * 1000
        ),

      origine: "diretta",

      articoli:
        contoDiretto,

      totale:
        totaleDiretto,

      data:
        new Date().toISOString(),

      metodoPagamento,

      ...(metodoPagamento ===
      "contanti"
        ? {
            contantiRicevuti:
              contantiNumero,

            resto,
          }
        : {}),
    };

    salvaVendita(vendita);

    const totale =
      totaleDiretto;

    setContoDiretto([]);

    chiudiPagamento();

    if (
      metodoPagamento ===
      "contanti"
    ) {
      alert(
        `Pagamento registrato.\n\nTotale: € ${formattaEuro(
          totale
        )}\nRicevuti: € ${formattaEuro(
          contantiNumero
        )}\nResto: € ${formattaEuro(
          resto
        )}`
      );
    } else {
      alert(
        `Pagamento con carta registrato.\n\nTotale: € ${formattaEuro(
          totale
        )}`
      );
    }
  }

  /*
   * DATI VISUALIZZATI
   */
  const righeVisualizzate =
    contoTavoloSelezionato
      ? contoTavoloSelezionato.articoli
      : contoDiretto;

  const totaleVisualizzato =
    contoTavoloSelezionato
      ? contoTavoloSelezionato.totale
      : totaleDiretto;
const contantiNumero =
    Number(
      contantiRicevuti.replace(
        ",",
        "."
      )
    );

  const resto =
    metodoPagamento ===
      "contanti" &&
    !Number.isNaN(contantiNumero)
      ? Math.max(
          0,
          contantiNumero -
            totaleVisualizzato
        )
      : 0;
  return (
    <main className="min-h-screen bg-slate-100 p-6 text-black">
      <div className="mx-auto max-w-7xl">
        {/* TITOLO */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold">
              Cassa
            </h1>

            <p className="mt-1 text-gray-500">
              Vendite dirette e conti
              tavoli
            </p>
          </div>

          {contoTavoloSelezionato && (
            <button
              onClick={
                tornaVenditaDiretta
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium hover:bg-gray-50"
            >
              ← Vendita diretta
            </button>
          )}
        </div>

        {/* TAVOLI DA INCASSARE */}
        {contiTavoli.length > 0 && (
          <div className="mb-6 rounded-xl bg-white p-5 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Tavoli da incassare
              </h2>

              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
                {contiTavoli.length}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contiTavoli.map(
                (conto) => (
                  <button
                    key={conto.id}
                    onClick={() =>
                      selezionaContoTavolo(
                        conto
                      )
                    }
                    className={`rounded-xl border p-4 text-left transition hover:bg-gray-50 ${
                      contoTavoloSelezionatoId ===
                      conto.id
                        ? "border-black ring-2 ring-black"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xl font-bold">
                        {
                          conto.tavoloNome
                        }
                      </span>

                      <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">
                        DA INCASSARE
                      </span>
                    </div>

                    <p className="mt-3 text-2xl font-bold">
                      €{" "}
                      {formattaEuro(
                        conto.totale
                      )}
                    </p>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* ARTICOLI */}
          <div className="rounded-xl bg-white p-5 shadow">
            <h2 className="mb-4 text-2xl font-semibold">
              Articoli
            </h2>

            {contoTavoloSelezionato && (
              <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                Stai incassando{" "}
                <strong>
                  {
                    contoTavoloSelezionato.tavoloNome
                  }
                </strong>
                .
              </div>
            )}

            {/* CATEGORIE */}
            <div className="mb-4 flex flex-wrap gap-2">
              {categorie.map(
                (categoria) => (
                  <button
                    key={categoria}
                    disabled={
                      !!contoTavoloSelezionato
                    }
                    onClick={() =>
                      setCategoriaAttiva(
                        categoria
                      )
                    }
                    className={`rounded-lg px-4 py-2 font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      categoriaAttiva ===
                      categoria
                        ? "bg-black text-white"
                        : "bg-gray-200 text-black"
                    }`}
                  >
                    {categoria}
                  </button>
                )
              )}
            </div>

            {/* LISTA ARTICOLI */}
            {articoli.length === 0 ? (
              <p className="text-gray-500">
                Nessun articolo trovato.
              </p>
            ) : (
              <div className="space-y-3">
                {articoliFiltrati.map(
                  (articolo) => (
                    <button
                      key={articolo.id}
                      disabled={
                        !!contoTavoloSelezionato
                      }
                      onClick={() =>
                        aggiungiArticolo(
                          articolo
                        )
                      }
                      className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white p-4 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <div className="text-left">
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

                      <span className="font-bold">
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

          {/* CONTO */}
          <div className="rounded-xl bg-white p-5 shadow">
            <h2 className="mb-4 text-2xl font-semibold">
              {contoTavoloSelezionato
                ? `Conto ${contoTavoloSelezionato.tavoloNome}`
                : "Conto"}
            </h2>

            {righeVisualizzate.length ===
            0 ? (
              <p className="text-gray-500">
                Nessun articolo
                selezionato
              </p>
            ) : (
              <div className="space-y-3">
                {righeVisualizzate.map(
                  (riga) => {
                    const lordo =
                      riga.prezzo *
                      riga.quantita;

                    const valoreSconto =
                      lordo *
                      (riga.sconto /
                        100);

                    const totaleRiga =
                      calcolaTotaleRiga(
                        riga
                      );

                    return (
                      <div
                        key={riga.rigaId}
                        className="rounded-xl border border-gray-200 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold">
                                {
                                  riga.nome
                                }
                              </p>

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
                              {
                                riga.quantita
                              }{" "}
                              × €{" "}
                              {formattaEuro(
                                riga.prezzo
                              )}
                            </p>

                            <p className="text-xs text-gray-400">
                              IVA{" "}
                              {riga.iva ??
                                10}
                              %
                            </p>

                            {riga.sconto >
                              0 && (
                              <>
                                <p className="mt-2 text-sm text-gray-500">
                                  Prezzo
                                  originale: €{" "}
                                  {formattaEuro(
                                    lordo
                                  )}
                                </p>

                                <p className="text-sm font-medium text-green-700">
                                  Sconto: - €{" "}
                                  {formattaEuro(
                                    valoreSconto
                                  )}
                                </p>
                              </>
                            )}
                          </div>

                          {!contoTavoloSelezionato && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  diminuisciQuantita(
                                    riga.rigaId
                                  )
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-xl"
                              >
                                −
                              </button>

                              <span className="min-w-8 text-center font-bold">
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
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-xl"
                              >
                                +
                              </button>
                            </div>
                          )}

                          <div className="min-w-24 sm:text-right">
                            <p className="text-xs text-gray-500">
                              Totale
                            </p>

                            <p className="text-xl font-bold">
                              €{" "}
                              {formattaEuro(
                                totaleRiga
                              )}
                            </p>
                          </div>

                          {!contoTavoloSelezionato && (
                            <button
                              onClick={() =>
                                eliminaRigaDiretta(
                                  riga.rigaId
                                )
                              }
                              className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600"
                            >
                              Elimina
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            {/* TOTALE */}
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between text-2xl font-bold">
                <span>Totale</span>

                <span>
                  €{" "}
                  {formattaEuro(
                    totaleVisualizzato
                  )}
                </span>
              </div>

              <button
                onClick={apriPagamento}
                disabled={
                  righeVisualizzate.length ===
                  0
                }
                className="mt-6 w-full rounded-lg bg-black py-4 text-lg font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pagamento
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODALE PAGAMENTO */}
      {mostraPagamento && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Pagamento
                </h2>

                <p className="mt-1 text-gray-500">
                  Totale da pagare
                </p>

                <p className="mt-1 text-4xl font-bold">
                  €{" "}
                  {formattaEuro(
                    totaleVisualizzato
                  )}
                </p>
              </div>

              <button
                onClick={
                  chiudiPagamento
                }
                className="text-3xl text-gray-400 hover:text-black"
              >
                ×
              </button>
            </div>

            {/* METODO */}
            <div className="mt-7">
              <p className="mb-3 font-semibold">
                Metodo di pagamento
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setMetodoPagamento(
                      "contanti"
                    );

                    setContantiRicevuti(
                      ""
                    );
                  }}
                  className={`rounded-xl border p-5 text-lg font-bold ${
                    metodoPagamento ===
                    "contanti"
                      ? "border-black bg-black text-white"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  💶 Contanti
                </button>

                <button
                  onClick={() => {
                    setMetodoPagamento(
                      "carta"
                    );

                    setContantiRicevuti(
                      ""
                    );
                  }}
                  className={`rounded-xl border p-5 text-lg font-bold ${
                    metodoPagamento ===
                    "carta"
                      ? "border-black bg-black text-white"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  💳 Carta
                </button>
              </div>
            </div>

            {/* CONTANTI */}
            {metodoPagamento ===
              "contanti" && (
              <div className="mt-6">
                <label className="mb-2 block font-semibold">
                  Contanti ricevuti
                </label>

                <div className="flex items-center rounded-xl border border-gray-300 bg-white px-4">
                  <span className="text-xl font-bold">
                    €
                  </span>

                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={
                      contantiRicevuti
                    }
                    onChange={(e) =>
                      setContantiRicevuti(
                        e.target.value
                      )
                    }
                    className="w-full px-3 py-4 text-2xl font-bold outline-none"
                  />
                </div>

                {contantiRicevuti !==
                  "" &&
                  !Number.isNaN(
                    contantiNumero
                  ) && (
                    <div className="mt-4 rounded-xl bg-gray-100 p-4">
                      {contantiNumero >=
                      totaleVisualizzato ? (
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            Resto
                          </span>

                          <span className="text-3xl font-bold text-green-700">
                            €{" "}
                            {formattaEuro(
                              resto
                            )}
                          </span>
                        </div>
                      ) : (
                        <p className="font-medium text-red-600">
                          Mancano €{" "}
                          {formattaEuro(
                            totaleVisualizzato -
                              contantiNumero
                          )}
                        </p>
                      )}
                    </div>
                  )}
              </div>
            )}

            {/* CARTA */}
            {metodoPagamento ===
              "carta" && (
              <div className="mt-6 rounded-xl bg-gray-100 p-4">
                <p className="font-medium">
                  Pagamento con carta
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Importo: €{" "}
                  {formattaEuro(
                    totaleVisualizzato
                  )}
                </p>
              </div>
            )}

            {/* CONFERMA */}
            <button
              onClick={
                confermaPagamento
              }
              disabled={
                stampaFiscaleInCorso ||
                !metodoPagamento ||
                (metodoPagamento ===
                  "contanti" &&
                  (contantiRicevuti.trim() ===
                    "" ||
                    Number.isNaN(
                      contantiNumero
                    ) ||
                    contantiNumero <
                      totaleVisualizzato))
              }
              className="mt-7 w-full rounded-xl bg-green-700 py-4 text-lg font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {stampaFiscaleInCorso
                ? "Stampa fiscale in corso..."
                : "Conferma pagamento"}
            </button>

            <button
              onClick={
                chiudiPagamento
              }
              className="mt-3 w-full rounded-xl border border-gray-300 py-3 font-medium hover:bg-gray-50"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </main>
  );
}