import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ristoranteId =
  "8e83495c-69c2-4f30-9267-15f8bca501df";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

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

    if (chiusureResult.error) {
      throw chiusureResult.error;
    }

    if (serviziResult.error) {
      throw serviziResult.error;
    }

    return NextResponse.json(
      {
        chiusure: chiusureResult.data ?? [],
        servizi: serviziResult.data ?? [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Errore API disponibilità:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossibile caricare le disponibilità.",
      },
      {
        status: 500,
      }
    );
  }
}