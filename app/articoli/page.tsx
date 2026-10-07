"use client";

import { useEffect, useState } from "react";

type Categoria = "Bibite" | "Vini" | "Menu" | "Dessert" | "Aperitivi";

type Articolo = {
  id: number;
  nome: string;
  categoria: Categoria;
  prezzo: number;
  iva: number;
  descrizione?: string;
};

const categorie: Categoria[] = [
  "Bibite",
  "Vini",
  "Menu",
  "Dessert",
  "Aperitivi",
];


export default function ArticoliPage() {
const [articoli, setArticoli] =
  useState<Articolo[]>([]);

  const [cerca, setCerca] = useState("");
  
  const [categoriaFiltro, setCategoriaFiltro] = useState("Tutte");

  const [mostraForm, setMostraForm] = useState(false);
  const [articoloModifica, setArticoloModifica] = useState<Articolo | null>(
    null
  );

const [nome, setNome] = useState("");
const [categoria, setCategoria] = useState<Categoria>("Bibite");
const [prezzo, setPrezzo] = useState("");
const [iva, setIva] = useState("10");
const [descrizione, setDescrizione] = useState("");

useEffect(() => {
  const salvati = localStorage.getItem("articoli");

  if (salvati) {
    try {
      setArticoli(JSON.parse(salvati));
    } catch {
      setArticoli(articoli);
    }
  } else {
    setArticoli(articoli);
  }
}, []);

useEffect(() => {
  if (articoli.length > 0) {
    localStorage.setItem(
      "articoli",
      JSON.stringify(articoli)
    );
  }
}, [articoli]);


const articoliFiltrati = articoli.filter((articolo) => {
  const corrispondeRicerca = articolo.nome
    .toLowerCase()
    .includes(cerca.toLowerCase());

  const corrispondeCategoria =
    categoriaFiltro === "Tutte" ||
    articolo.categoria === categoriaFiltro;

  return corrispondeRicerca && corrispondeCategoria;
});

  function apriNuovoArticolo() {
    setArticoloModifica(null);
    setNome("");
    setCategoria("Bibite");
    setPrezzo("");
    setIva("10");
    setDescrizione("");
    setMostraForm(true);
  }

  function apriModifica(articolo: Articolo) {
    setArticoloModifica(articolo);
    setNome(articolo.nome);
    setCategoria(articolo.categoria);
    setPrezzo(articolo.prezzo.toString());
    setIva(articolo.iva.toString());
    setDescrizione(articolo.descrizione || "");
    setMostraForm(true);
  }

  function salvaArticolo(e: React.FormEvent) {
  e.preventDefault();

  if (!nome.trim() || !prezzo) {
    alert("Inserisci almeno nome e prezzo.");
    return;
  }

  const nuovoArticolo: Articolo = {
    id: articoloModifica?.id || Date.now(),
    nome: nome.trim(),
    categoria,
    prezzo: Number(prezzo),
    iva: Number(iva),
    descrizione: descrizione.trim(),
  };

  let nuoviArticoli: Articolo[];

  if (articoloModifica) {
    nuoviArticoli = articoli.map((articolo) =>
      articolo.id === articoloModifica.id
        ? nuovoArticolo
        : articolo
    );
  } else {
    nuoviArticoli = [...articoli, nuovoArticolo];
  }

  setArticoli(nuoviArticoli);

  localStorage.setItem(
    "articoli",
    JSON.stringify(nuoviArticoli)
  );

  setMostraForm(false);
}
  function eliminaArticolo(id: number) {
    const conferma = window.confirm(
      "Sei sicuro di voler eliminare questo articolo?"
    );

    if (!conferma) return;

    setArticoli((articoliPrecedenti) =>
      articoliPrecedenti.filter((articolo) => articolo.id !== id)
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Titolo */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Articoli</h1>
            <p className="mt-1 text-gray-500">
              Gestisci i prodotti della tua attività
            </p>
          </div>

          <button
            onClick={apriNuovoArticolo}
            className="rounded-lg bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800"
          >
            + Nuovo Articolo
          </button>
        </div>

        {/* Ricerca e filtro */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Cerca articolo
              </label>

              <input
                type="text"
                value={cerca}
                onChange={(e) => setCerca(e.target.value)}
                placeholder="Es. Spritz, Tiramisù..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Categoria
              </label>

              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="Tutte">Tutte</option>

                {categorie.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lista articoli */}
        <div className="space-y-4">
          {articoliFiltrati.length === 0 ? (
            <div className="rounded-xl bg-white p-10 text-center shadow-sm">
              <p className="text-gray-500">
                Nessun articolo trovato.
              </p>
            </div>
          ) : (
            articoliFiltrati.map((articolo) => (
              <div
                key={articolo.id}
                className="rounded-xl bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {articolo.nome}
                    </h2>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                        {articolo.categoria}
                      </span>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                        IVA {articolo.iva}%
                      </span>
                    </div>

                    {articolo.descrizione && (
                      <p className="mt-3 text-sm text-gray-500">
                        {articolo.descrizione}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        € {articolo.prezzo.toFixed(2).replace(".", ",")}
                      </p>
                    </div>

                    <button
                      onClick={() => apriModifica(articolo)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Modifica
                    </button>

                    <button
                      onClick={() => eliminaArticolo(articolo.id)}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Finestra nuovo/modifica articolo */}
      {mostraForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {articoloModifica
                    ? "Modifica articolo"
                    : "Nuovo articolo"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Inserisci i dati dell'articolo
                </p>
              </div>

              <button
                onClick={() => setMostraForm(false)}
                className="text-2xl text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={salvaArticolo} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Nome articolo
                </label>

                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Es. Spritz"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  required
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Categoria
                </label>

                <select
                  value={categoria}
                  onChange={(e) =>
                    setCategoria(e.target.value as Categoria)
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                >
                  {categorie.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prezzo e IVA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Prezzo (€)
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prezzo}
                    onChange={(e) => setPrezzo(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    IVA
                  </label>

                  <select
                    value={iva}
                    onChange={(e) => setIva(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  >
                    <option value="4">4%</option>
                    <option value="5">5%</option>
                    <option value="10">10%</option>
                    <option value="22">22%</option>
                  </select>
                </div>
              </div>

              {/* Descrizione */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Descrizione
                </label>

                <textarea
                  value={descrizione}
                  onChange={(e) => setDescrizione(e.target.value)}
                  placeholder="Descrizione facoltativa..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* Pulsanti */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMostraForm(false)}
                  className="rounded-lg border border-gray-300 px-5 py-3 font-medium hover:bg-gray-50"
                >
                  Annulla
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800"
                >
                  {articoloModifica
                    ? "Salva modifiche"
                    : "Crea articolo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}