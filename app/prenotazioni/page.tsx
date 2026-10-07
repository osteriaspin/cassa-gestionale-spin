"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StatoPrenotazione =
  | "attesa"
  | "confermata"
  | "annullata"
  | "completata"
  | "no-show";

type TipoServizio = "pranzo" | "cena";

type Prenotazione = {
  id: string;
  ristorante_id: string;
  data_prenotazione: string;
  orario: string;
  coperti: number;
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  note: string;
  stato: StatoPrenotazione;
  origine: "gestionale" | "widget";
  created_at: string;
};

type Servizio = {
  attivo: boolean;
  dalle: string;
  alle: string;
};

type GiornoSettimana = {
  id: number;
  nome: string;
  pranzo: Servizio;
  cena: Servizio;
};

type Chiusura = {
  id: string;
  dataInizio: string;
  dataFine: string;
  tipo: "giornata" | "pranzo" | "cena";
  motivo: string;
};

type FormPrenotazione = {
  data_prenotazione: string;
  orario: string;
  coperti: string;
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  note: string;
};

const NOMI_GIORNI: Record<number, string> = {
  0: "Domenica",
  1: "Lunedì",
  2: "Martedì",
  3: "Mercoledì",
  4: "Giovedì",
  5: "Venerdì",
  6: "Sabato",
};

const giorniDefault: GiornoSettimana[] = [1, 2, 3, 4, 5, 6, 0].map(
  (id) => ({
    id,
    nome: NOMI_GIORNI[id],
    pranzo: {
      attivo: false,
      dalle: "12:00",
      alle: "14:30",
    },
    cena: {
      attivo: id >= 2 && id <= 6,
      dalle: "19:00",
      alle: "22:30",
    },
  })
);

function oggiISO() {
  const oggi = new Date();

  return [
    oggi.getFullYear(),
    String(oggi.getMonth() + 1).padStart(2, "0"),
    String(oggi.getDate()).padStart(2, "0"),
  ].join("-");
}

function formattaData(data: string) {
  if (!data) return "";

  const [anno, mese, giorno] = data.split("-").map(Number);

  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(anno, mese - 1, giorno));
}

function cambiaGiorno(data: string, giorni: number) {
  const [anno, mese, giorno] = data.split("-").map(Number);
  const d = new Date(anno, mese - 1, giorno);

  d.setDate(d.getDate() + giorni);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function numeroGiornoSettimana(data: string) {
  const [anno, mese, giorno] = data.split("-").map(Number);

  return new Date(anno, mese - 1, giorno).getDay();
}

function statoLabel(stato: StatoPrenotazione) {
  switch (stato) {
    case "attesa":
      return "In attesa";
    case "confermata":
      return "Confermata";
    case "annullata":
      return "Annullata";
    case "completata":
      return "Completata";
    case "no-show":
      return "No show";
  }
}

function statoClasse(stato: StatoPrenotazione) {
  switch (stato) {
    case "confermata":
      return "bg-green-100 text-green-800";
    case "attesa":
      return "bg-amber-100 text-amber-800";
    case "annullata":
      return "bg-red-100 text-red-800";
    case "completata":
      return "bg-blue-100 text-blue-800";
    case "no-show":
      return "bg-gray-200 text-gray-700";
  }
}

function formVuoto(data: string): FormPrenotazione {
  return {
    data_prenotazione: data,
    orario: "",
    coperti: "2",
    nome: "",
    cognome: "",
    telefono: "",
    email: "",
    note: "",
  };
}

function normalizzaPrenotazione(row: any): Prenotazione {
  return {
    ...row,
    orario: String(row.orario).slice(0, 5),
    note: row.note ?? "",
  };
}

export default function PrenotazioniPage() {
  const router = useRouter();
  const oggi = oggiISO();

  const [dataSelezionata, setDataSelezionata] = useState(oggi);

  const [ristoranteId, setRistoranteId] =
    useState<string | null>(null);

  const [prenotazioni, setPrenotazioni] =
    useState<Prenotazione[]>([]);

  const [giorni, setGiorni] =
    useState<GiornoSettimana[]>(giorniDefault);

  const [chiusure, setChiusure] =
    useState<Chiusura[]>([]);

  const [caricamento, setCaricamento] =
    useState(true);

  const [errorePagina, setErrorePagina] =
    useState("");

  const [modaleAperta, setModaleAperta] =
    useState(false);

  const [
    prenotazioneInModifica,
    setPrenotazioneInModifica,
  ] = useState<Prenotazione | null>(null);

  const [form, setForm] =
    useState<FormPrenotazione>(
      formVuoto(oggi)
    );

  const [invioInCorso, setInvioInCorso] =
    useState(false);

  useEffect(() => {
    async function caricaDati() {
      setCaricamento(true);
      setErrorePagina("");

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const {
        data: associazione,
        error: associazioneError,
      } = await supabase
        .from("utenti_ristoranti")
        .select("ristorante_id")
        .eq("user_id", authData.user.id)
        .limit(1)
        .maybeSingle();

      if (
        associazioneError ||
        !associazione
      ) {
        setErrorePagina(
          "Questo account non è associato a nessun ristorante."
        );
        setCaricamento(false);
        return;
      }

      const rid =
        associazione.ristorante_id as string;

      setRistoranteId(rid);

      const [
        prenotazioniResult,
        serviziResult,
        chiusureResult,
      ] = await Promise.all([
        supabase
          .from("prenotazioni")
          .select("*")
          .eq("ristorante_id", rid)
          .order(
            "data_prenotazione",
            { ascending: true }
          )
          .order(
            "orario",
            { ascending: true }
          ),

        supabase
          .from("servizi_prenotazioni")
          .select("*")
          .eq("ristorante_id", rid),

        supabase
          .from("chiusure_prenotazioni")
          .select("*")
          .eq("ristorante_id", rid)
          .order(
            "data_inizio",
            { ascending: true }
          ),
      ]);

      if (prenotazioniResult.error) {
        setErrorePagina(
          `Errore prenotazioni: ${prenotazioniResult.error.message}`
        );
        setCaricamento(false);
        return;
      }

      if (serviziResult.error) {
        setErrorePagina(
          `Errore servizi: ${serviziResult.error.message}`
        );
        setCaricamento(false);
        return;
      }

      if (chiusureResult.error) {
        setErrorePagina(
          `Errore chiusure: ${chiusureResult.error.message}`
        );
        setCaricamento(false);
        return;
      }

      setPrenotazioni(
        (prenotazioniResult.data ?? []).map(
          normalizzaPrenotazione
        )
      );

      const nuoviGiorni =
        giorniDefault.map(
          (giorno) => ({
            ...giorno,
            pranzo: {
              ...giorno.pranzo,
            },
            cena: {
              ...giorno.cena,
            },
          })
        );

      for (
        const servizio of
        serviziResult.data ?? []
      ) {
        const giorno =
          nuoviGiorni.find(
            (item) =>
              item.id ===
              servizio.giorno_settimana
          );

        if (!giorno) continue;

        giorno[
          servizio.servizio as TipoServizio
        ] = {
          attivo: servizio.attivo,
          dalle: String(
            servizio.dalle
          ).slice(0, 5),
          alle: String(
            servizio.alle
          ).slice(0, 5),
        };
      }

      setGiorni(nuoviGiorni);

      setChiusure(
        (chiusureResult.data ?? []).map(
          (item) => ({
            id: item.id,
            dataInizio:
              item.data_inizio,
            dataFine:
              item.data_fine,
            tipo: item.tipo,
            motivo:
              item.motivo ?? "",
          })
        )
      );

      setCaricamento(false);
    }

    void caricaDati();
  }, [router]);

  function getGiorno(data: string) {
    const numero =
      numeroGiornoSettimana(data);

    return giorni.find(
      (giorno) =>
        giorno.id === numero
    );
  }

  function getChiusureData(
    data: string
  ) {
    return chiusure.filter(
      (chiusura) =>
        data >=
          chiusura.dataInizio &&
        data <=
          chiusura.dataFine
    );
  }

  function servizioDisponibile(
    data: string,
    tipo: TipoServizio
  ) {
    const giorno =
      getGiorno(data);

    if (
      !giorno ||
      !giorno[tipo].attivo
    ) {
      return false;
    }

    return !getChiusureData(
      data
    ).some(
      (chiusura) =>
        chiusura.tipo ===
          "giornata" ||
        chiusura.tipo === tipo
    );
  }

  function motivoChiusura(
    data: string,
    tipo: TipoServizio
  ) {
    const giorno =
      getGiorno(data);

    if (
      !giorno?.[tipo].attivo
    ) {
      return "Servizio non attivo";
    }

    const chiusura =
      getChiusureData(
        data
      ).find(
        (item) =>
          item.tipo ===
            "giornata" ||
          item.tipo === tipo
      );

    return chiusura
      ? chiusura.motivo ||
          "Chiusura straordinaria"
      : "";
  }

  function servizioDaOrario(
    data: string,
    orario: string
  ): TipoServizio | null {
    if (!orario) return null;

    const giorno =
      getGiorno(data);

    if (!giorno) return null;

    if (
      orario >=
        giorno.pranzo.dalle &&
      orario <=
        giorno.pranzo.alle
    ) {
      return "pranzo";
    }

    if (
      orario >=
        giorno.cena.dalle &&
      orario <=
        giorno.cena.alle
    ) {
      return "cena";
    }

    return null;
  }

  function classificaPrenotazione(
    data: string,
    orario: string
  ): TipoServizio {
    const giorno =
      getGiorno(data);

    if (giorno) {
      if (
        orario >=
          giorno.pranzo.dalle &&
        orario <=
          giorno.pranzo.alle
      ) {
        return "pranzo";
      }

      if (
        orario >=
          giorno.cena.dalle &&
        orario <=
          giorno.cena.alle
      ) {
        return "cena";
      }
    }

    return orario < "17:00"
      ? "pranzo"
      : "cena";
  }

  const prenotazioniGiorno =
    useMemo(() => {
      return prenotazioni
        .filter(
          (prenotazione) =>
            prenotazione.data_prenotazione ===
            dataSelezionata
        )
        .sort((a, b) =>
          a.orario.localeCompare(
            b.orario
          )
        );
    }, [
      prenotazioni,
      dataSelezionata,
    ]);

  const prenotazioniPranzo =
    prenotazioniGiorno.filter(
      (prenotazione) =>
        classificaPrenotazione(
          prenotazione.data_prenotazione,
          prenotazione.orario
        ) === "pranzo"
    );

  const prenotazioniCena =
    prenotazioniGiorno.filter(
      (prenotazione) =>
        classificaPrenotazione(
          prenotazione.data_prenotazione,
          prenotazione.orario
        ) === "cena"
    );

  const prenotazioniAttive =
    prenotazioniGiorno.filter(
      (prenotazione) =>
        prenotazione.stato !==
        "annullata"
    );

  const copertiTotali =
    prenotazioniAttive.reduce(
      (totale, prenotazione) =>
        totale +
        prenotazione.coperti,
      0
    );

  const copertiPranzo =
    prenotazioniPranzo
      .filter(
        (prenotazione) =>
          prenotazione.stato !==
          "annullata"
      )
      .reduce(
        (
          totale,
          prenotazione
        ) =>
          totale +
          prenotazione.coperti,
        0
      );

  const copertiCena =
    prenotazioniCena
      .filter(
        (prenotazione) =>
          prenotazione.stato !==
          "annullata"
      )
      .reduce(
        (
          totale,
          prenotazione
        ) =>
          totale +
          prenotazione.coperti,
        0
      );

  const giornoSelezionato =
    getGiorno(
      dataSelezionata
    );

  const pranzoAperto =
    servizioDisponibile(
      dataSelezionata,
      "pranzo"
    );

  const cenaAperta =
    servizioDisponibile(
      dataSelezionata,
      "cena"
    );

  function apriNuovaPrenotazione() {
    if (
      !pranzoAperto &&
      !cenaAperta
    ) {
      alert(
        "Il ristorante è chiuso per tutta la giornata selezionata."
      );
      return;
    }

    setPrenotazioneInModifica(
      null
    );

    setForm(
      formVuoto(
        dataSelezionata
      )
    );

    setModaleAperta(true);
  }

  function apriModifica(
    prenotazione: Prenotazione
  ) {
    setPrenotazioneInModifica(
      prenotazione
    );

    setForm({
      data_prenotazione:
        prenotazione.data_prenotazione,
      orario:
        prenotazione.orario,
      coperti: String(
        prenotazione.coperti
      ),
      nome:
        prenotazione.nome,
      cognome:
        prenotazione.cognome,
      telefono:
        prenotazione.telefono,
      email:
        prenotazione.email,
      note:
        prenotazione.note || "",
    });

    setModaleAperta(true);
  }

  function chiudiModale() {
    if (invioInCorso) return;

    setModaleAperta(false);

    setPrenotazioneInModifica(
      null
    );
  }

  async function salvaPrenotazione(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (
      invioInCorso ||
      !ristoranteId
    ) {
      return;
    }

    const coperti =
      Number(form.coperti);

    if (
      !form.data_prenotazione ||
      !form.orario ||
      !form.nome.trim() ||
      !form.cognome.trim() ||
      !form.telefono.trim() ||
      !form.email.trim() ||
      !Number.isInteger(
        coperti
      ) ||
      coperti < 1
    ) {
      alert(
        "Compila tutti i campi obbligatori: data, orario, coperti, nome, cognome, telefono ed email."
      );
      return;
    }

    const servizio =
      servizioDaOrario(
        form.data_prenotazione,
        form.orario
      );

    if (!servizio) {
      alert(
        "L'orario selezionato non rientra negli orari configurati."
      );
      return;
    }

    if (
      !servizioDisponibile(
        form.data_prenotazione,
        servizio
      )
    ) {
      alert(
        `${
          servizio === "pranzo"
            ? "Pranzo"
            : "Cena"
        } non disponibile. ${motivoChiusura(
          form.data_prenotazione,
          servizio
        )}`
      );

      return;
    }

    const dati = {
      data_prenotazione:
        form.data_prenotazione,
      orario: form.orario,
      coperti,
      nome: form.nome.trim(),
      cognome:
        form.cognome.trim(),
      telefono:
        form.telefono.trim(),
      email: form.email.trim(),
      note:
        form.note.trim() ||
        null,
    };

    setInvioInCorso(true);

    try {
      if (
        prenotazioneInModifica
      ) {
        const {
          data,
          error,
        } = await supabase
          .from("prenotazioni")
          .update(dati)
          .eq(
            "id",
            prenotazioneInModifica.id
          )
          .eq(
            "ristorante_id",
            ristoranteId
          )
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        const aggiornata =
          normalizzaPrenotazione(
            data
          );

        setPrenotazioni(
          (precedenti) =>
            precedenti.map(
              (prenotazione) =>
                prenotazione.id ===
                aggiornata.id
                  ? aggiornata
                  : prenotazione
            )
        );
      } else {
        const {
          data,
          error,
        } = await supabase
          .from("prenotazioni")
          .insert({
            ristorante_id:
              ristoranteId,
            ...dati,
            stato: "attesa",
            origine:
              "gestionale",
          })
          .select("*")
          .single();

        if (error) {
  throw error;
}

// INVIO EMAIL CON RESEND
const { data: emailData, error: emailError } =
  await supabase.functions.invoke(
    "invia-email-prenotazione",
    {
      body: {
        tipo: "richiesta",
        nome: dati.nome,
        cognome: dati.cognome,
        email: dati.email,
        data: dati.data_prenotazione,
        orario: dati.orario,
        coperti: dati.coperti,
        note: dati.note ?? "",
      },
    }
  );

console.log("RISPOSTA EMAIL:", emailData);

if (emailError) {
  console.error(
    "Errore invio email:",
    emailError
  );
}

setPrenotazioni(
  (precedenti) => [
    ...precedenti,
    normalizzaPrenotazione(
      data
    ),
  ]
);
      }

      setDataSelezionata(
        form.data_prenotazione
      );

      setModaleAperta(false);

      setPrenotazioneInModifica(
        null
      );
    } catch (errore) {
      console.error(
        "Errore salvataggio prenotazione:",
        errore
      );

      alert(
        errore instanceof Error
          ? errore.message
          : "Impossibile salvare la prenotazione."
      );
    } finally {
      setInvioInCorso(false);
    }
  }

  async function cambiaStato(
    id: string,
    stato: StatoPrenotazione
  ) {
    if (
      invioInCorso ||
      !ristoranteId
    ) {
      return;
    }

    const prenotazione =
      prenotazioni.find(
        (item) =>
          item.id === id
      );

    if (
      !prenotazione ||
      prenotazione.stato ===
        stato
    ) {
      return;
    }

    setInvioInCorso(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("prenotazioni")
        .update({ stato })
        .eq("id", id)
        .eq(
          "ristorante_id",
          ristoranteId
        )
        .select("*")
        .single();

      if (error) {
  throw error;
}


// INVIO EMAIL CAMBIO STATO
if (
  stato === "confermata" ||
  stato === "annullata"
) {

  const { error: emailError } =
    await supabase.functions.invoke(
      "invia-email-prenotazione",
      {
        body: {
          tipo:
            stato === "confermata"
              ? "conferma"
              : "annulla",

          nome: prenotazione.nome,
          cognome: prenotazione.cognome,
          email: prenotazione.email,
          data:
            prenotazione.data_prenotazione,
          orario:
            prenotazione.orario,
          coperti:
            prenotazione.coperti,
        },
      }
    );

  if (emailError) {
    console.error(
      "Errore invio email stato:",
      emailError
    );
  }
}


const aggiornata =
  normalizzaPrenotazione(
    data
  );

      setPrenotazioni(
        (precedenti) =>
          precedenti.map(
            (item) =>
              item.id === id
                ? aggiornata
                : item
          )
      );
    } catch (errore) {
      console.error(
        "Errore cambio stato:",
        errore
      );

      alert(
        errore instanceof Error
          ? errore.message
          : "Impossibile aggiornare lo stato."
      );
    } finally {
      setInvioInCorso(false);
    }
  }

  async function eliminaPrenotazione(
    id: string
  ) {
    if (
      invioInCorso ||
      !ristoranteId
    ) {
      return;
    }

    const conferma =
      window.confirm(
        "Vuoi eliminare definitivamente questa prenotazione?"
      );

    if (!conferma) return;

    setInvioInCorso(true);

    try {
      const { error } =
        await supabase
          .from("prenotazioni")
          .delete()
          .eq("id", id)
          .eq(
            "ristorante_id",
            ristoranteId
          );

      if (error) {
        throw error;
      }

      setPrenotazioni(
        (precedenti) =>
          precedenti.filter(
            (prenotazione) =>
              prenotazione.id !==
              id
          )
      );
    } catch (errore) {
      console.error(
        "Errore eliminazione:",
        errore
      );

      alert(
        errore instanceof Error
          ? errore.message
          : "Impossibile eliminare la prenotazione."
      );
    } finally {
      setInvioInCorso(false);
    }
  }

  function renderServizio(
    titolo: "Pranzo" | "Cena",
    elenco: Prenotazione[],
    coperti: number,
    aperto: boolean,
    motivo: string,
    servizio?: Servizio
  ) {
    return (
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">
                {titolo}
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  aperto
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {aperto
                  ? "Aperto"
                  : "Chiuso"}
              </span>
            </div>

            {aperto &&
            servizio ? (
              <p className="mt-1 text-sm text-gray-500">
                {servizio.dalle} -{" "}
                {servizio.alle} ·{" "}
                {elenco.length} richieste
              </p>
            ) : (
              <p className="mt-1 text-sm text-red-600">
                {motivo}
              </p>
            )}
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold">
              {coperti}
            </div>

            <div className="text-xs text-gray-500">
              coperti richiesti
            </div>
          </div>
        </div>

        {elenco.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400">
            Nessuna prenotazione
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {elenco.map(
              (prenotazione) => (
                <div
                  key={
                    prenotazione.id
                  }
                  className="p-5 hover:bg-gray-50"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="w-16 shrink-0 text-xl font-bold">
                        {
                          prenotazione.orario
                        }
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              apriModifica(
                                prenotazione
                              )
                            }
                            className="text-left font-semibold hover:underline"
                          >
                            {
                              prenotazione.nome
                            }{" "}
                            {
                              prenotazione.cognome
                            }
                          </button>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statoClasse(
                              prenotazione.stato
                            )}`}
                          >
                            {statoLabel(
                              prenotazione.stato
                            )}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-gray-600">
                          {
                            prenotazione.coperti
                          }{" "}
                          {prenotazione.coperti ===
                          1
                            ? "persona"
                            : "persone"}
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          Tel.{" "}
                          {
                            prenotazione.telefono
                          }
                        </div>

                        <div className="text-sm text-gray-500">
                          {
                            prenotazione.email
                          }
                        </div>

                        {prenotazione.note && (
                          <div className="mt-2 text-sm text-gray-500">
                            Note:{" "}
                            {
                              prenotazione.note
                            }
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {prenotazione.stato ===
                        "attesa" && (
                        <button
                          type="button"
                          disabled={
                            invioInCorso
                          }
                          onClick={() =>
                            cambiaStato(
                              prenotazione.id,
                              "confermata"
                            )
                          }
                          className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Conferma
                        </button>
                      )}

                      <select
                        value={
                          prenotazione.stato
                        }
                        disabled={
                          invioInCorso
                        }
                        onChange={(e) =>
                          cambiaStato(
                            prenotazione.id,
                            e.target
                              .value as StatoPrenotazione
                          )
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
                      >
                        <option value="attesa">
                          In attesa
                        </option>

                        <option value="confermata">
                          Confermata
                        </option>

                        <option value="completata">
                          Completata
                        </option>

                        <option value="no-show">
                          No show
                        </option>

                        <option value="annullata">
                          Annullata
                        </option>
                      </select>

                      <button
                        type="button"
                        disabled={
                          invioInCorso
                        }
                        onClick={() =>
                          apriModifica(
                            prenotazione
                          )
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                      >
                        Modifica
                      </button>

                      <button
                        type="button"
                        disabled={
                          invioInCorso
                        }
                        onClick={() =>
                          eliminaPrenotazione(
                            prenotazione.id
                          )
                        }
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
    );
  }

  if (caricamento) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
        <div className="mx-auto max-w-7xl rounded-2xl border border-gray-200 bg-white p-8">
          Caricamento prenotazioni...
        </div>
      </main>
    );
  }

  if (errorePagina) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <div className="font-semibold">
            Errore
          </div>

          <div className="mt-1 text-sm">
            {errorePagina}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Prenotazioni
            </h1>

            <p className="mt-1 text-gray-500">
              Gestione delle richieste di prenotazione
            </p>
          </div>

          <button
            type="button"
            onClick={
              apriNuovaPrenotazione
            }
            disabled={
              (!pranzoAperto &&
                !cenaAperta) ||
              invioInCorso
            }
            className="rounded-xl bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            + Nuova prenotazione
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDataSelezionata(
                    cambiaGiorno(
                      dataSelezionata,
                      -1
                    )
                  )
                }
                className="h-11 rounded-lg border border-gray-300 px-4 hover:bg-gray-50"
              >
                ←
              </button>

              <button
                type="button"
                onClick={() =>
                  setDataSelezionata(
                    oggi
                  )
                }
                className="h-11 rounded-lg border border-gray-300 px-4 font-medium hover:bg-gray-50"
              >
                Oggi
              </button>

              <button
                type="button"
                onClick={() =>
                  setDataSelezionata(
                    cambiaGiorno(
                      dataSelezionata,
                      1
                    )
                  )
                }
                className="h-11 rounded-lg border border-gray-300 px-4 hover:bg-gray-50"
              >
                →
              </button>

              <input
                type="date"
                value={
                  dataSelezionata
                }
                onChange={(e) =>
                  setDataSelezionata(
                    e.target.value
                  )
                }
                className="h-11 rounded-lg border border-gray-300 bg-white px-3"
              />
            </div>

            <div className="text-lg font-semibold capitalize">
              {formattaData(
                dataSelezionata
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm text-gray-500">
              Richieste
            </div>

            <div className="mt-1 text-3xl font-bold">
              {
                prenotazioniAttive.length
              }
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm text-gray-500">
              Coperti richiesti
            </div>

            <div className="mt-1 text-3xl font-bold">
              {copertiTotali}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm text-gray-500">
              In attesa
            </div>

            <div className="mt-1 text-3xl font-bold">
              {
                prenotazioniGiorno.filter(
                  (
                    prenotazione
                  ) =>
                    prenotazione.stato ===
                    "attesa"
                ).length
              }
            </div>
          </div>
        </div>

        {!pranzoAperto &&
          !cenaAperta && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
              <div className="font-semibold">
                Ristorante chiuso
              </div>

              <div className="mt-1 text-sm">
                Non sono disponibili servizi nella giornata selezionata.
              </div>
            </div>
          )}

        <div className="grid gap-6">
          {renderServizio(
            "Pranzo",
            prenotazioniPranzo,
            copertiPranzo,
            pranzoAperto,
            motivoChiusura(
              dataSelezionata,
              "pranzo"
            ),
            giornoSelezionato?.pranzo
          )}

          {renderServizio(
            "Cena",
            prenotazioniCena,
            copertiCena,
            cenaAperta,
            motivoChiusura(
              dataSelezionata,
              "cena"
            ),
            giornoSelezionato?.cena
          )}
        </div>
      </div>

      {modaleAperta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white text-gray-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">
                  {prenotazioneInModifica
                    ? "Modifica prenotazione"
                    : "Nuova prenotazione"}
                </h2>

                <p className="text-sm text-gray-500">
                  Ogni nuova richiesta viene inserita in attesa.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  invioInCorso
                }
                onClick={
                  chiudiModale
                }
                className="rounded-lg px-3 py-2 text-xl text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                salvaPrenotazione
              }
              className="p-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-sm font-medium">
                    Data *
                  </span>

                  <input
                    type="date"
                    required
                    value={
                      form.data_prenotazione
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        data_prenotazione:
                          e.target
                            .value,
                        orario: "",
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium">
                    Orario *
                  </span>

                  <input
                    type="time"
                    required
                    value={
                      form.orario
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        orario:
                          e.target
                            .value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium">
                    Coperti *
                  </span>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={
                      form.coperti
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        coperti:
                          e.target
                            .value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </label>

                <div />

                <label>
                  <span className="mb-1 block text-sm font-medium">
                    Nome *
                  </span>

                  <input
                    type="text"
                    required
                    value={form.nome}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        nome:
                          e.target
                            .value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium">
                    Cognome *
                  </span>

                  <input
                    type="text"
                    required
                    value={
                      form.cognome
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        cognome:
                          e.target
                            .value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium">
                    Telefono *
                  </span>

                  <input
                    type="tel"
                    required
                    value={
                      form.telefono
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        telefono:
                          e.target
                            .value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium">
                    Email *
                  </span>

                  <input
                    type="email"
                    required
                    value={
                      form.email
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email:
                          e.target
                            .value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">
                    Note
                  </span>

                  <textarea
                    rows={4}
                    value={
                      form.note
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        note:
                          e.target
                            .value,
                      })
                    }
                    placeholder="Allergie, richieste particolari, seggiolone..."
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5"
                  />
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  disabled={
                    invioInCorso
                  }
                  onClick={
                    chiudiModale
                  }
                  className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Annulla
                </button>

                <button
                  type="submit"
                  disabled={
                    invioInCorso
                  }
                  className="rounded-lg bg-black px-5 py-2.5 font-semibold text-white hover:bg-gray-800 disabled:bg-gray-400"
                >
                  {invioInCorso
                    ? "Salvataggio..."
                    : prenotazioneInModifica
                    ? "Salva modifiche"
                    : "Inserisci richiesta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}