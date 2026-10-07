import React from 'react';

export default function ScontrinoProva() {
  const gestisciStampa = () => {
    window.print();
  };

  return (
    <div className="p-4">
      {/* Area dello Scontrino - visibile a schermo e ottimizzata per la stampa */}
      <div id="sezione-scontrino" className="scontrino-termico bg-white p-4 text-black font-mono text-sm max-w-[80mm] mx-auto border border-dashed border-gray-400">
        <div className="text-center font-bold text-lg mb-2">OSTERIA SPIN</div>
        <div className="text-center text-xs mb-4">Via dell'Osteria, 1 - Treviso</div>
        <hr className="border-t border-dashed my-2" />
        
        {/* Corpo dello Scontrino */}
        <div className="flex justify-between my-1">
          <span>1x Primo del Giorno</span>
          <span>€ 12,00</span>
        </div>
        <div className="flex justify-between my-1">
          <span>1x Acqua Minerale</span>
          <span>€ 2,50</span>
        </div>
        <div className="flex justify-between my-1">
          <span>1x Caffè</span>
          <span>€ 1,50</span>
        </div>
        
        <hr className="border-t border-dashed my-2" />
        <div className="flex justify-between font-bold text-base my-2">
          <span>TOTALE</span>
          <span>€ 16,00</span>
        </div>
        <hr className="border-t border-dashed my-2" />
        
        <div className="text-center text-xs mt-4">Grazie e Arrivederci!</div>
        <div className="text-center text-[10px] text-gray-500 mt-1">Scontrino di Prova Tecnica</div>
      </div>

      {/* Pulsante per avviare la stampa */}
      <div className="text-center mt-4 print:hidden">
        <button 
          onClick={gestisciStampa}
          className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition"
        >
          Stampa Scontrino di Prova
        </button>
      </div>
    </div>
  );
}
