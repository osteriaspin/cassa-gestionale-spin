"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "../styles/spin-booking.css";

const mesi = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

type ServizioPrenotazione = {
  giorno_settimana: number | string;
  servizio: "pranzo" | "cena";
  attivo: boolean | string | number;
  dalle: string;
  alle: string;
};

export default function SpinBookingWidget() {
  const oggi = new Date();

  const [mese, setMese] = useState(oggi.getMonth());
  const [anno, setAnno] = useState(oggi.getFullYear());

  const [giorno, setGiorno] = useState("");
  const [coperti, setCoperti] = useState<number | null>(null);
  const [orario, setOrario] = useState("");
  const [step, setStep] = useState(1);

  const [chiusure, setChiusure] = useState<string[]>([]);
  const [servizi, setServizi] = useState<ServizioPrenotazione[]>([]);

  const [caricamento, setCaricamento] = useState(true);
  const [erroreCaricamento, setErroreCaricamento] = useState("");

  const [inviata, setInviata] = useState(false);
  const [invioInCorso, setInvioInCorso] = useState(false);

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const ristoranteId =
    "8e83495c-69c2-4f30-9267-15f8bca501df";

  function servizioAttivo(valore: boolean | string | number) {
    return (
      valore === true ||
      valore === "true" ||
      valore === 1 ||
      valore === "1"
    );
  }

  const formattaData = (data: string) => {
    const giorni = [
      "Domenica",
      "Lunedì",
      "Martedì",
      "Mercoledì",
      "Giovedì",
      "Venerdì",
      "Sabato",
    ];

    const mesiItaliani = [
      "Gennaio",
      "Febbraio",
      "Marzo",
      "Aprile",
      "Maggio",
      "Giugno",
      "Luglio",
      "Agosto",
      "Settembre",
      "Ottobre",
      "Novembre",
      "Dicembre",
    ];

    const parti = data.split("-");

    const dataObj = new Date(
      Number(parti[0]),
      Number(parti[1]) - 1,
      Number(parti[2])
    );

    return (
      `${giorni[dataObj.getDay()]} ` +
      `${dataObj.getDate()} ` +
      `${mesiItaliani[dataObj.getMonth()]} ` +
      `${dataObj.getFullYear()}`
    );
  };

  const generaOrari = (dalle: string, alle: string) => {
    const risultato: string[] = [];

    const [oraInizio, minutiInizio] =
      dalle.slice(0, 5).split(":").map(Number);

    const [oraFine, minutiFine] =
      alle.slice(0, 5).split(":").map(Number);

    let minuti = oraInizio * 60 + minutiInizio;
    const fine = oraFine * 60 + minutiFine;

    while (minuti <= fine) {
      const ore = Math.floor(minuti / 60);
      const min = minuti % 60;

      risultato.push(
        `${String(ore).padStart(2, "0")}:${String(min).padStart(
          2,
          "0"
        )}`
      );

      minuti += 15;
    }

    return risultato;
  };

useEffect(() => {
  let componenteAttivo = true;

  async function caricaDati() {
    setCaricamento(true);
    setErroreCaricamento("");

    try {
      const [chiusureResult, serviziResult] =
        await Promise.all([
          supabase
            .from("chiusure_prenotazioni")
            .select("data_inizio")
            .eq("ristorante_id", ristoranteId),

          supabase
            .from("servizi_prenotazioni")
            .select(
              "giorno_settimana, servizio, attivo, dalle, alle"
            )
            .eq("ristorante_id", ristoranteId),
        ]);

      if (!componenteAttivo) return;

      if (chiusureResult.error) {
        throw chiusureResult.error;
      }

      if (serviziResult.error) {
        throw serviziResult.error;
      }

      setChiusure(
        (chiusureResult.data ?? [])
          .map((item) => String(item.data_inizio))
          .filter(Boolean)
      );

      setServizi(
        (serviziResult.data ?? []) as ServizioPrenotazione[]
      );
    } catch (errore) {
      if (!componenteAttivo) return;

      console.error(
        "Errore caricamento calendario:",
        errore
      );

      setServizi([]);
      setChiusure([]);

      setErroreCaricamento(
        "Impossibile caricare le disponibilità. Riprova tra qualche secondo."
      );
    } finally {
      if (componenteAttivo) {
        setCaricamento(false);
      }
    }
  }

  caricaDati();

  return () => {
    componenteAttivo = false;
  };
}, []);

  const serviziSelezionati = giorno
    ? servizi.filter((s) => {
        const [annoG, meseG, giornoG] =
          giorno.split("-").map(Number);

        const giornoSettimana = new Date(
          annoG,
          meseG - 1,
          giornoG
        ).getDay();

        return (
          Number(s.giorno_settimana) === giornoSettimana &&
          servizioAttivo(s.attivo)
        );
      })
    : [];

  const servizioPranzo = serviziSelezionati.find(
    (s) => s.servizio === "pranzo"
  );

  const servizioCena = serviziSelezionati.find(
    (s) => s.servizio === "cena"
  );

  const orariPranzo = servizioPranzo
    ? generaOrari(
        String(servizioPranzo.dalle),
        String(servizioPranzo.alle)
      )
    : [];

  const orariCena = servizioCena
    ? generaOrari(
        String(servizioCena.dalle),
        String(servizioCena.alle)
      )
    : [];

  const giorniMese = new Date(
    anno,
    mese + 1,
    0
  ).getDate();

  const oggiString =
    `${oggi.getFullYear()}-` +
    `${String(oggi.getMonth() + 1).padStart(2, "0")}-` +
    `${String(oggi.getDate()).padStart(2, "0")}`;

  if (inviata) {
    return (
      <div className="spin-booking-calendar">
        <div className="spin-confirmation">
          <div className="spin-check">✓</div>

          <h2>Richiesta inviata</h2>

          <p>
            Grazie {nome} {cognome}
          </p>

          <div className="spin-summary">
            <p>📅 {formattaData(giorno)}</p>
            <p>🕒 {orario}</p>
            <p>👥 {coperti} persone</p>
          </div>

          <p className="spin-message">
            Ti confermeremo la disponibilità appena possibile.
          </p>

          <div className="spin-restaurant-info">
            <div className="spin-restaurant-name">
              Osteria Spin
            </div>

            <p>Strada di San Pelajo, 108</p>
            <p>31100 Treviso</p>
            <p>Tel. 0422 302208</p>
          </div>
        </div>
      </div>
    );
  }

  if (caricamento) {
    return (
      <div className="spin-booking-calendar">
        <div
          style={{
            padding: "30px 15px",
            textAlign: "center",
            color: "#555",
          }}
        >
          Caricamento disponibilità...
        </div>
      </div>
    );
  }

  if (erroreCaricamento) {
    return (
      <div className="spin-booking-calendar">
        <div
          style={{
            padding: "30px 15px",
            textAlign: "center",
            color: "#b45d5d",
          }}
        >
          <p>{erroreCaricamento}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "15px",
              padding: "12px 20px",
              border: "none",
              borderRadius: "8px",
              background: "#c8b07d",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="spin-booking-calendar">
      {/* STEP 1 - CALENDARIO */}

      {step === 1 && (
        <div className="spin-screen active">
          <div className="spin-calendar-header">
            <button
              type="button"
              className="spin-nav"
              onClick={() => {
                if (mese === 0) {
                  setMese(11);
                  setAnno(anno - 1);
                } else {
                  setMese(mese - 1);
                }
              }}
            >
              ‹
            </button>

            <h3>
              {mesi[mese]} {anno}
            </h3>

            <button
              type="button"
              className="spin-nav"
              onClick={() => {
                if (mese === 11) {
                  setMese(0);
                  setAnno(anno + 1);
                } else {
                  setMese(mese + 1);
                }
              }}
            >
              ›
            </button>
          </div>

          <div className="spin-weekdays">
            <span>LUN</span>
            <span>MAR</span>
            <span>MER</span>
            <span>GIO</span>
            <span>VEN</span>
            <span>SAB</span>
            <span>DOM</span>
          </div>

          <div className="spin-days">
            {Array.from({
              length:
                (new Date(anno, mese, 1).getDay() + 6) % 7,
            }).map((_, i) => (
              <div
                key={`vuoto-${i}`}
                className="spin-empty-day"
              />
            ))}

            {Array.from({
              length: giorniMese,
            }).map((_, i) => {
              const numero = i + 1;

              const data =
                `${anno}-` +
                `${String(mese + 1).padStart(2, "0")}-` +
                `${String(numero).padStart(2, "0")}`;

              const dataObj = new Date(
                anno,
                mese,
                numero
              );

              const giornoSettimana =
                dataObj.getDay();

              const serviziDelGiorno =
                servizi.filter((s) => {
                  return (
                    Number(s.giorno_settimana) ===
                      giornoSettimana &&
                    servizioAttivo(s.attivo)
                  );
                });

              const chiuso =
                serviziDelGiorno.length === 0;

              const passato =
                data < oggiString;

              const chiusuraStraordinaria =
                chiusure.includes(data);

              const disabilitato =
                chiuso ||
                passato ||
                chiusuraStraordinaria;

              return (
                <button
                  type="button"
                  key={data}
                  disabled={disabilitato}
                  className={
                    disabilitato
                      ? "day disabled"
                      : giorno === data
                      ? "day active"
                      : "day"
                  }
                  onClick={() => {
                    if (disabilitato) return;

                    setGiorno(data);
                    setCoperti(null);
                    setOrario("");
                    setStep(2);
                  }}
                >
                  {numero}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2 - PERSONE E ORARI */}

      {step === 2 && (
        <div className="spin-screen active">
          <h3 className="spin-section-title">
            Quante persone?
          </h3>

          <div className="spin-guests">
            {Array.from({
              length: 8,
            }).map((_, i) => {
              const numero = i + 1;

              return (
                <button
                  type="button"
                  key={numero}
                  className={
                    coperti === numero
                      ? "spin-guest-btn active"
                      : "spin-guest-btn"
                  }
                  onClick={() =>
                    setCoperti(numero)
                  }
                >
                  {numero}
                </button>
              );
            })}
          </div>

          <h3 className="spin-section-title">
            Scegli l&apos;orario
          </h3>

          <div className="spin-times">
            {orariPranzo.length > 0 && (
              <div className="spin-service-group">
                <div className="spin-service-title">
                  Pranzo
                </div>

                <div className="spin-service-times">
                  {orariPranzo.map((ora) => (
                    <button
                      type="button"
                      key={`pranzo-${ora}`}
                      className={
                        orario === ora
                          ? "spin-time-btn active"
                          : "spin-time-btn"
                      }
                      onClick={() =>
                        setOrario(ora)
                      }
                    >
                      {ora}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {orariCena.length > 0 && (
              <div className="spin-service-group">
                <div className="spin-service-title">
                  Cena
                </div>

                <div className="spin-service-times">
                  {orariCena.map((ora) => (
                    <button
                      type="button"
                      key={`cena-${ora}`}
                      className={
                        orario === ora
                          ? "spin-time-btn active"
                          : "spin-time-btn"
                      }
                      onClick={() =>
                        setOrario(ora)
                      }
                    >
                      {ora}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            id="next-step"
            disabled={!coperti || !orario}
            onClick={() => setStep(3)}
          >
            Continua
          </button>
        </div>
      )}

      {/* STEP 3 - DATI CLIENTE */}

      {step === 3 && (
        <div className="spin-screen active">
          <div className="spin-row">
            <div className="spin-col">
              <input
                type="text"
                placeholder="Nome"
                value={nome}
                onChange={(e) =>
                  setNome(e.target.value)
                }
              />
            </div>

            <div className="spin-col">
              <input
                type="text"
                placeholder="Cognome"
                value={cognome}
                onChange={(e) =>
                  setCognome(e.target.value)
                }
              />
            </div>
          </div>

          <div className="spin-row">
            <div className="spin-col">
              <input
                type="tel"
                placeholder="Telefono"
                value={telefono}
                onChange={(e) =>
                  setTelefono(e.target.value)
                }
              />
            </div>

            <div className="spin-col">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />
            </div>
          </div>

          <textarea
            placeholder="Note o richieste particolari"
            value={note}
            onChange={(e) =>
              setNote(e.target.value)
            }
          />

          <button
            type="button"
            id="spin-prenota"
            disabled={invioInCorso}
            onClick={async () => {
              if (
                !nome.trim() ||
                !cognome.trim() ||
                !telefono.trim() ||
                !email.trim()
              ) {
                alert(
                  "Inserisci nome, cognome, telefono ed email."
                );
                return;
              }

              if (
                !giorno ||
                !orario ||
                !coperti
              ) {
                alert(
                  "Completa i dati della prenotazione."
                );
                return;
              }

              if (invioInCorso) return;

              setInvioInCorso(true);

              try {
                const { error } =
                  await supabase
                    .from("prenotazioni")
                    .insert({
                      ristorante_id:
                        ristoranteId,
                      data_prenotazione:
                        giorno,
                      orario,
                      coperti,
                      nome: nome.trim(),
                      cognome:
                        cognome.trim(),
                      telefono:
                        telefono.trim(),
                      email: email.trim(),
                      note: note.trim(),
                      stato: "attesa",
                      origine: "widget",
                    });

                if (error) {
                  throw error;
                }

                const { error: emailError } =
                  await supabase.functions.invoke(
                    "invia-email-prenotazione",
                    {
                      body: {
                        tipo: "richiesta",
                        nome: nome.trim(),
                        cognome:
                          cognome.trim(),
                        email: email.trim(),
                        data: giorno,
                        orario,
                        coperti,
                        note: note.trim(),
                      },
                    }
                  );

                if (emailError) {
                  console.error(
                    "Errore invio email:",
                    emailError
                  );
                }

                setInviata(true);
              } catch (errore) {
                console.error(
                  "Errore salvataggio prenotazione:",
                  errore
                );

                alert(
                  "Errore durante l'invio della prenotazione."
                );
              } finally {
                setInvioInCorso(false);
              }
            }}
          >
            {invioInCorso
              ? "Invio..."
              : "Invia richiesta"}
          </button>
        </div>
      )}
    </div>
  );
}