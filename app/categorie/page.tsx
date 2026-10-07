"use client";

import { useState } from "react";

export default function CategoriePage() {
  const [categorie, setCategorie] = useState([
    "Bevande",
    "Vini",
    "Cucina",
    "Dessert",
  ]);

  const [nuovaCategoria, setNuovaCategoria] = useState("");

  const aggiungiCategoria = () => {
    if (!nuovaCategoria.trim()) return;

    setCategorie([...categorie, nuovaCategoria]);
    setNuovaCategoria("");
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>Categorie</h1>

      <input
        type="text"
        placeholder="Nuova categoria"
        value={nuovaCategoria}
        onChange={(e) => setNuovaCategoria(e.target.value)}
      />

      <button onClick={aggiungiCategoria}>
        Aggiungi
      </button>

      <hr />

      {categorie.map((categoria, index) => (
        <div key={index}>{categoria}</div>
      ))}
    </main>
  );
}