// Supabase Edge Function - Vérification et envoi automatique des questionnaires à froid
// Se déclenche chaque jour à 9h via cron
// Déployer avec : supabase functions deploy check-questionnaires-froid

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "NJM Conseil <onboarding@resend.dev>";

serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Récupérer les formations terminées depuis 6 mois sans questionnaire envoyé
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: formations, error } = await supabase
      .from("formations")
      .select("*")
      .eq("status", "completed")
      .eq("questionnaire_froid_sent", false)
      .lte("end_date", sixMonthsAgo.toISOString());

    if (error) throw error;

    if (!formations || formations.length === 0) {
      return new Response(JSON.stringify({ message: "Aucun questionnaire à envoyer", count: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let errors = 0;

    for (const formation of formations) {
      if (!formation.client_email || !RESEND_API_KEY) continue;

      const directorName = formation.company_director_name || "";
      const companyName = formation.company_name || formation.client_name || "";
      const formationName = formation.formation_name || "Formation";

      // Email au dirigeant
      const emailBody = `Bonjour${directorName ? " " + directorName : ""},

J'espère que vous allez bien.

Il y a maintenant 6 mois que la formation "${formationName}" s'est terminée. Dans le cadre de la démarche qualité Qualiopi, je souhaiterais recueillir votre retour sur l'impact de cette formation.

Pourriez-vous prendre quelques minutes pour compléter le questionnaire ci-dessous ?
Et pourriez-vous également transmettre le questionnaire apprenant à chaque personne ayant participé à la formation ?

Ce retour est précieux pour améliorer continuellement la qualité de mes formations.

En vous remerciant par avance.

Nathalie Joulié-Morand`;

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [formation.client_email],
            subject: `Questionnaire à froid - Formation "${formationName}" - ${companyName}`,
            text: emailBody,
          }),
        });

        if (resendResponse.ok) {
          // Marquer comme envoyé
          await supabase
            .from("formations")
            .update({ questionnaire_froid_sent: true })
            .eq("id", formation.id);
          sent++;
        } else {
          errors++;
        }
      } catch (e) {
        console.error(`Erreur envoi pour formation ${formation.id}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ message: `Questionnaires à froid: ${sent} envoyés, ${errors} erreurs`, sent, errors }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
