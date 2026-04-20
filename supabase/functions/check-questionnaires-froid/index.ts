// Supabase Edge Function - Vérification et envoi automatique des questionnaires à froid
// Se déclenche chaque jour à 9h via cron : 0 9 * * *
// Envoie 3 mois après la fin de la formation
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

    // Récupérer les formations terminées depuis 3 mois sans questionnaire à froid envoyé
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data: formations, error } = await supabase
      .from("formations")
      .select("*")
      .eq("status", "completed")
      .eq("questionnaire_froid_sent", false)
      .lte("end_date", threeMonthsAgo.toISOString());

    if (error) throw error;

    if (!formations || formations.length === 0) {
      return new Response(JSON.stringify({ message: "Aucun questionnaire à froid à envoyer", count: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Charger les questionnaires à froid depuis la table questionnaires
    const { data: questionnaires } = await supabase
      .from("questionnaires")
      .select("*")
      .in("category", ["froid_dirigeant", "froid_apprenant"])
      .eq("active", true);

    const questDirigeant = questionnaires?.find((q: any) => q.category === "froid_dirigeant");
    const questApprenant = questionnaires?.find((q: any) => q.category === "froid_apprenant");

    const lienDirigeant = questDirigeant?.url || "";
    const lienApprenant = questApprenant?.url || "";

    let sent = 0;
    let errors = 0;

    for (const formation of formations) {
      if (!formation.client_email || !RESEND_API_KEY) continue;

      const directorName = formation.company_director_name || "";
      const companyName = formation.company_name || formation.client_name || "";
      const formationName = formation.formation_name || "Formation";

      // Construire les blocs de liens questionnaires
      const lienDirigeantBlock = lienDirigeant
        ? `\nQuestionnaire dirigeant : ${lienDirigeant}`
        : "";
      const lienApprenantBlock = lienApprenant
        ? `\nQuestionnaire apprenant (à transmettre à chaque participant) : ${lienApprenant}`
        : "";

      const emailBody = `Bonjour${directorName ? " " + directorName : ""},

J'espère que vous allez bien.

Il y a maintenant 3 mois que la formation "${formationName}" s'est terminée. Dans le cadre de la démarche qualité Qualiopi, je souhaiterais recueillir votre retour sur l'impact de cette formation.

Pourriez-vous prendre quelques minutes pour compléter le(s) questionnaire(s) ci-dessous ?${lienDirigeantBlock}${lienApprenantBlock}

Ce retour est précieux pour améliorer continuellement la qualité de mes formations.

En vous remerciant par avance.

Nathalie JOULIÉ MORAND
NJM Conseil`;

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
          await supabase
            .from("formations")
            .update({ questionnaire_froid_sent: true })
            .eq("id", formation.id);
          sent++;
        } else {
          const errText = await resendResponse.text();
          console.error(`Erreur Resend pour formation ${formation.id}:`, errText);
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
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
