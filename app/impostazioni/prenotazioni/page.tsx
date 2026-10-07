"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

type TipoChiusura = "giornata" | "pranzo" | "cena";

type Chiusura = {
  id: string;
  dataInizio: string;
  dataFine: string;
  tipo: TipoChiusura;
  motivo: string;
};

const giorniDefault: GiornoSettimana[] = [
  {
    id: 1,
    nome: "Lunedì",
    pranzo: { attivo: false, dalle: "12:00", alle: "14:30" },
    cena: { attivo: false, dalle: "19:00", alle: "22:30" },
  },
  {
    id: 2,
    nome: "Martedì",
    pranzo: { attivo: false, dalle: "12:00", alle: "14:30" },
    cena: { attivo: true, dalle: "19:00", alle: "22:30" },
  },
  {
    id: 3,
    nome: "Mercoledì",
    pranzo: { attivo: false, dalle: "12:00", alle: "14:30" },
    cena: { attivo: true, dalle: "19:00", alle: "22:30" },
  },
  {
    id: 4,
    nome: "Giovedì",
    pranzo: { attivo: false, dalle: "12:00", alle: "14:30" },
    cena: { attivo: true, dalle: "19:00", alle: "22:30" },
  },
  {
    id: 5,
    nome: "Venerdì",
    pranzo: { attivo: false, dalle: "12:00", alle: "14:30" },
    cena: { attivo: true, dalle: "19:00", alle: "22:30" },
  },
  {
    id: 6,
    nome: "Sabato",
    pranzo: { attivo: false, dalle: "12:00", alle: "14:30" },
    cena: { attivo: true, dalle: "19:00", alle: "22:30" },
  },
  {
    id: 0,
    nome: "Domenica",
    pranzo: { attivo: false, dalle: "12:00", alle: "14:30" },
    cena: { attivo: false, dalle: "19:00", alle: "22:30" },
  },
];

function formattaData(data: string) {
  if (!data) return "";

  const [anno, mese, giorno] = data.split("-").map(Number);
  const d = new Date(anno, mese - 1, giorno);

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function etichettaTipo(tipo: TipoChiusura) {
  if (tipo === "giornata") return "Giornata intera";
  if (tipo === "pranzo") return "Solo pranzo";
  return "Solo cena";
}

export default function ImpostazioniPrenotazioniPage() {
  const router = useRouter();

  const [ristoranteId, setRistoranteId] = useState<string | null>(null);

  const [giorni, setGiorni] =
    useState<GiornoSettimana[]>(giorniDefault);

  const [chiusure, setChiusure] = useState<Chiusura[]>([]);

  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errorePagina, setErrorePagina] = useState("");

  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");

  const [tipoChiusura, setTipoChiusura] =
    useState<TipoChiusura>("giornata");

  const [motivo, setMotivo] = useState("");

  const [messaggioSalvataggio, setMessaggioSalvataggio] =
    useState("");

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

      if (associazioneError || !associazione) {
        setErrorePagina(
          "Questo account non è associato a nessun ristorante."
        );
        setCaricamento(false);
        return;
      }

      const rid = associazione.ristorante_id as string;

      setRistoranteId(rid);

      const [serviziResult, chiusureResult] = await Promise.all([
        supabase
          .from("servizi_prenotazioni")
          .select("*")
          .eq("ristorante_id", rid),

        supabase
          .from("chiusure_prenotazioni")
          .select("*")
          .eq("ristorante_id", rid)
          .order("data_inizio", { ascending: true }),
      ]);

      if (serviziResult.error) {
        setErrorePagina(
          `Errore caricamento servizi: ${serviziResult.error.message}`
        );
        setCaricamento(false);
        return;
      }

      if (chiusureResult.error) {
        setErrorePagina(
          `Errore caricamento chiusure: ${chiusureResult.error.message}`
        );
        setCaricamento(false);
        return;
      }

      const nuoviGiorni = giorniDefault.map((giorno) => ({
        ...giorno,
        pranzo: { ...giorno.pranzo },
        cena: { ...giorno.cena },
      }));

      for (const servizio of serviziResult.data ?? []) {
        const giorno = nuoviGiorni.find(
          (item) => item.id === servizio.giorno_settimana
        );

        if (!giorno) continue;

        const tipo = servizio.servizio as "pranzo" | "cena";

        giorno[tipo] = {
          attivo:
  servizio.attivo === true ||
  servizio.attivo === "true" ||
  servizio.attivo === 1 ||
  servizio.attivo === "1",
          dalle: String(servizio.dalle).slice(0, 5),
          alle: String(servizio.alle).slice(0, 5),
        };
      }

      setGiorni(nuoviGiorni);

      setChiusure(
        (chiusureResult.data ?? []).map((chiusura) => ({
          id: chiusura.id,
          dataInizio: chiusura.data_inizio,
          dataFine: chiusura.data_fine,
          tipo: chiusura.tipo as TipoChiusura,
          motivo: chiusura.motivo ?? "",
        }))
      );

      setCaricamento(false);
    }

    void caricaDati();
  }, [router]);

  function mostraMessaggio(testo: string) {
    setMessaggioSalvataggio(testo);

    window.setTimeout(() => {
      setMessaggioSalvataggio("");
    }, 2500);
  }

  function aggiornaServizio(
    giornoId: number,
    tipo: "pranzo" | "cena",
    campo: "attivo" | "dalle" | "alle",
    valore: boolean | string
  ) {
    setGiorni((precedenti) =>
      precedenti.map((giorno) => {
        if (giorno.id !== giornoId) {
          return giorno;
        }

        return {
          ...giorno,
          [tipo]: {
            ...giorno[tipo],
            [campo]: valore,
          },
        };
      })
    );
  }

  function validaOrari() {
    for (const giorno of giorni) {
      for (const tipo of ["pranzo", "cena"] as const) {
        const servizio = giorno[tipo];

        if (servizio.alle <= servizio.dalle) {
          alert(
            `${giorno.nome} - ${
              tipo === "pranzo" ? "Pranzo" : "Cena"
            }: l'orario finale deve essere successivo all'orario iniziale.`
          );

          return false;
        }
      }
    }

    return true;
  }

  async function salvaImpostazioni() {
    if (!ristoranteId || salvataggio) return;

    if (!validaOrari()) return;

    setSalvataggio(true);

    try {
      for (const giorno of giorni) {
        const servizi = [
          {
            tipo: "pranzo" as const,
            dati: giorno.pranzo,
          },
          {
            tipo: "cena" as const,
            dati: giorno.cena,
          },
        ];

        for (const servizio of servizi) {
          const { error } = await supabase
            .from("servizi_prenotazioni")
            .update({
              attivo: servizio.dati.attivo,
              dalle: servizio.dati.dalle,
              alle: servizio.dati.alle,
            })
            .eq("ristorante_id", ristoranteId)
            .eq("giorno_settimana", giorno.id)
            .eq("servizio", servizio.tipo);

          if (error) {
            throw error;
          }
        }
      }

      mostraMessaggio("Impostazioni salvate");
    } catch (errore) {
      console.error("Errore salvataggio impostazioni:", errore);

      alert(
        errore instanceof Error
          ? errore.message
          : "Impossibile salvare le impostazioni."
      );
    } finally {
      setSalvataggio(false);
    }
  }

  async function ripristinaConfigurazione() {
    if (!ristoranteId || salvataggio) return;

    const conferma = window.confirm(
      "Vuoi ripristinare la configurazione iniziale? Lunedì e domenica chiusi, tutti i pranzi chiusi e cena aperta da martedì a sabato."
    );

    if (!conferma) return;

    setSalvataggio(true);

    try {
      for (const giorno of giorniDefault) {
        const servizi = [
          {
            tipo: "pranzo" as const,
            dati: giorno.pranzo,
          },
          {
            tipo: "cena" as const,
            dati: giorno.cena,
          },
        ];

        for (const servizio of servizi) {
          const { error } = await supabase
            .from("servizi_prenotazioni")
            .update({
              attivo: servizio.dati.attivo,
              dalle: servizio.dati.dalle,
              alle: servizio.dati.alle,
            })
            .eq("ristorante_id", ristoranteId)
            .eq("giorno_settimana", giorno.id)
            .eq("servizio", servizio.tipo);

          if (error) {
            throw error;
          }
        }
      }

      setGiorni(
        giorniDefault.map((giorno) => ({
          ...giorno,
          pranzo: { ...giorno.pranzo },
          cena: { ...giorno.cena },
        }))
      );

      mostraMessaggio("Configurazione iniziale ripristinata");
    } catch (errore) {
      console.error("Errore ripristino configurazione:", errore);

      alert(
        errore instanceof Error
          ? errore.message
          : "Impossibile ripristinare la configurazione."
      );
    } finally {
      setSalvataggio(false);
    }
  }

  async function aggiungiChiusura() {
    if (!ristoranteId || salvataggio) return;

    if (!dataInizio) {
      alert("Inserisci la data di inizio.");
      return;
    }

    const fine = dataFine || dataInizio;

    if (fine < dataInizio) {
      alert(
        "La data finale non può essere precedente alla data iniziale."
      );
      return;
    }

    setSalvataggio(true);

    try {
      const { data, error } = await supabase
        .from("chiusure_prenotazioni")
        .insert({
          ristorante_id: ristoranteId,
          data_inizio: dataInizio,
          data_fine: fine,
          tipo: tipoChiusura,
          motivo: motivo.trim() || null,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const nuovaChiusura: Chiusura = {
        id: data.id,
        dataInizio: data.data_inizio,
        dataFine: data.data_fine,
        tipo: data.tipo as TipoChiusura,
        motivo: data.motivo ?? "",
      };

      setChiusure((precedenti) =>
        [...precedenti, nuovaChiusura].sort((a, b) =>
          a.dataInizio.localeCompare(b.dataInizio)
        )
      );

      setDataInizio("");
      setDataFine("");
      setTipoChiusura("giornata");
      setMotivo("");

      mostraMessaggio("Chiusura aggiunta");
    } catch (errore) {
      console.error("Errore aggiunta chiusura:", errore);

      alert(
        errore instanceof Error
          ? errore.message
          : "Impossibile aggiungere la chiusura."
      );
    } finally {
      setSalvataggio(false);
    }
  }

  async function eliminaChiusura(id: string) {
    if (!ristoranteId || salvataggio) return;

    const conferma = window.confirm(
      "Vuoi eliminare questa chiusura?"
    );

    if (!conferma) return;

    setSalvataggio(true);

    try {
      const { error } = await supabase
        .from("chiusure_prenotazioni")
        .delete()
        .eq("id", id)
        .eq("ristorante_id", ristoranteId);

      if (error) {
        throw error;
      }

      setChiusure((precedenti) =>
        precedenti.filter((chiusura) => chiusura.id !== id)
      );

      mostraMessaggio("Chiusura eliminata");
    } catch (errore) {
      console.error("Errore eliminazione chiusura:", errore);

      alert(
        errore instanceof Error
          ? errore.message
          : "Impossibile eliminare la chiusura."
      );
    } finally {
      setSalvataggio(false);
    }
  }

  if (caricamento) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-8">
            Caricamento impostazioni...
          </div>
        </div>
      </main>
    );
  }

  if (errorePagina) {
    return (
      <main className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <div className="font-semibold">Errore</div>

            <div className="mt-1 text-sm">
              {errorePagina}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Impostazioni prenotazioni
            </h1>

            <p className="mt-1 text-gray-500">
              Configura giorni, servizi, orari e chiusure.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {messaggioSalvataggio && (
              <span className="text-sm font-medium text-green-700">
                {messaggioSalvataggio}
              </span>
            )}

            <button
              type="button"
              onClick={salvaImpostazioni}
              disabled={salvataggio}
              className="rounded-xl bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {salvataggio
                ? "Salvataggio..."
                : "Salva impostazioni"}
            </button>
          </div>
        </div>

        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Servizi settimanali
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Attiva o disattiva pranzo e cena per ogni giorno e
              imposta gli orari prenotabili.
            </p>
          </div>

          <div className="space-y-4">
            {giorni.map((giorno) => {
              const chiuso =
                !giorno.pranzo.attivo &&
                !giorno.cena.attivo;

              return (
                <div
                  key={giorno.id}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {giorno.nome}
                    </h3>

                    {chiuso && (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                        Chiuso
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div
                      className={`rounded-xl border p-4 ${
                        giorno.pranzo.attivo
                          ? "border-green-200 bg-green-50/40"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <div className="font-semibold">
                            Pranzo
                          </div>

                          <div className="text-sm text-gray-500">
                            {giorno.pranzo.attivo
                              ? "Servizio attivo"
                              : "Servizio chiuso"}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={salvataggio}
                          onClick={() =>
                            aggiornaServizio(
                              giorno.id,
                              "pranzo",
                              "attivo",
                              !giorno.pranzo.attivo
                            )
                          }
                          className={`relative h-7 w-12 rounded-full transition ${
                            giorno.pranzo.attivo
                              ? "bg-green-600"
                              : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                              giorno.pranzo.attivo
                                ? "left-6"
                                : "left-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="mb-1 block text-xs text-gray-500">
                            Dalle
                          </span>

                          <input
                            type="time"
                            disabled={!giorno.pranzo.attivo}
                            value={giorno.pranzo.dalle}
                            onChange={(e) =>
                              aggiornaServizio(
                                giorno.id,
                                "pranzo",
                                "dalle",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
                          />
                        </label>

                        <label>
                          <span className="mb-1 block text-xs text-gray-500">
                            Alle
                          </span>

                          <input
                            type="time"
                            disabled={!giorno.pranzo.attivo}
                            value={giorno.pranzo.alle}
                            onChange={(e) =>
                              aggiornaServizio(
                                giorno.id,
                                "pranzo",
                                "alle",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
                          />
                        </label>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl border p-4 ${
                        giorno.cena.attivo
                          ? "border-green-200 bg-green-50/40"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <div className="font-semibold">
                            Cena
                          </div>

                          <div className="text-sm text-gray-500">
                            {giorno.cena.attivo
                              ? "Servizio attivo"
                              : "Servizio chiuso"}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={salvataggio}
                          onClick={() =>
                            aggiornaServizio(
                              giorno.id,
                              "cena",
                              "attivo",
                              !giorno.cena.attivo
                            )
                          }
                          className={`relative h-7 w-12 rounded-full transition ${
                            giorno.cena.attivo
                              ? "bg-green-600"
                              : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                              giorno.cena.attivo
                                ? "left-6"
                                : "left-1"
                            }`}
                          />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="mb-1 block text-xs text-gray-500">
                            Dalle
                          </span>

                          <input
                            type="time"
                            disabled={!giorno.cena.attivo}
                            value={giorno.cena.dalle}
                            onChange={(e) =>
                              aggiornaServizio(
                                giorno.id,
                                "cena",
                                "dalle",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
                          />
                        </label>

                        <label>
                          <span className="mb-1 block text-xs text-gray-500">
                            Alle
                          </span>

                          <input
                            type="time"
                            disabled={!giorno.cena.attivo}
                            value={giorno.cena.alle}
                            onChange={(e) =>
                              aggiornaServizio(
                                giorno.id,
                                "cena",
                                "alle",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold">
              Chiusure straordinarie
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Inserisci ferie, festività, eventi privati o altre
              chiusure.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-sm font-medium">
                    Dal *
                  </span>

                  <input
                    type="date"
                    value={dataInizio}
                    onChange={(e) =>
                      setDataInizio(e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-medium">
                    Al
                  </span>

                  <input
                    type="date"
                    value={dataFine}
                    onChange={(e) =>
                      setDataFine(e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">
                    Servizio
                  </span>

                  <select
                    value={tipoChiusura}
                    onChange={(e) =>
                      setTipoChiusura(
                        e.target.value as TipoChiusura
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                  >
                    <option value="giornata">
                      Giornata intera
                    </option>

                    <option value="pranzo">
                      Solo pranzo
                    </option>

                    <option value="cena">
                      Solo cena
                    </option>
                  </select>
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-sm font-medium">
                    Motivo
                  </span>

                  <input
                    type="text"
                    value={motivo}
                    onChange={(e) =>
                      setMotivo(e.target.value)
                    }
                    placeholder="Es. Ferie, festività, evento privato..."
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={salvataggio}
                onClick={aggiungiChiusura}
                className="mt-4 w-full rounded-xl bg-black px-4 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {salvataggio
                  ? "Attendere..."
                  : "+ Aggiungi chiusura"}
              </button>
            </div>

            <div>
              {chiusure.length === 0 ? (
                <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-400">
                  Nessuna chiusura straordinaria inserita
                </div>
              ) : (
                <div className="space-y-3">
                  {chiusure.map((chiusura) => (
                    <div
                      key={chiusura.id}
                      className="rounded-xl border border-gray-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">
                            {formattaData(
                              chiusura.dataInizio
                            )}

                            {chiusura.dataFine !==
                              chiusura.dataInizio && (
                              <>
                                {" "}
                                →{" "}
                                {formattaData(
                                  chiusura.dataFine
                                )}
                              </>
                            )}
                          </div>

                          <div className="mt-2">
                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                              {etichettaTipo(
                                chiusura.tipo
                              )}
                            </span>
                          </div>

                          {chiusura.motivo && (
                            <div className="mt-3 text-sm text-gray-600">
                              {chiusura.motivo}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={salvataggio}
                          onClick={() =>
                            eliminaChiusura(
                              chiusura.id
                            )
                          }
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">
              Configurazione iniziale
            </div>

            <div className="mt-1 text-sm text-gray-500">
              Lunedì e domenica chiusi, tutti i pranzi chiusi e
              cena aperta da martedì a sabato.
            </div>
          </div>

          <button
            type="button"
            disabled={salvataggio}
            onClick={ripristinaConfigurazione}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Ripristina configurazione iniziale
          </button>
        </div>
      </div>
    </main>
  );
}