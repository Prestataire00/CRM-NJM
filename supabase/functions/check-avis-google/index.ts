// Supabase Edge Function - Envoi automatique des mails d'avis Google
// Se déclenche chaque jour à 9h via cron : 0 9 * * *
// Envoie 3 jours après l'envoi des questionnaires fin de formation
// Déployer avec : supabase functions deploy check-avis-google

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "NJM Conseil <onboarding@resend.dev>";

serve(async (req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Trouver les formations dont les questionnaires ont été envoyés il y a 3+ jours
    // et dont l'avis Google n'a pas encore été envoyé
    const { data: fqRows, error: fqError } = await supabase
      .from("formation_questionnaires")
      .select("formation_id")
      .eq("sent_to_learners", true)
      .lte("sent_at", threeDaysAgo.toISOString());

    if (fqError) throw fqError;

    if (!fqRows || fqRows.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucun avis Google à envoyer", count: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Déduplication des formation_ids
    const formationIds = [...new Set(fqRows.map((r) => r.formation_id))];

    // Récupérer les formations éligibles (pas encore envoyé)
    const { data: formations, error: fError } = await supabase
      .from("formations")
      .select("*")
      .in("id", formationIds)
      .eq("avis_google_sent", false);

    if (fError) throw fError;
    if (!formations || formations.length === 0) {
      return new Response(
        JSON.stringify({ message: "Toutes les formations ont déjà reçu l'avis Google", count: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Charger les templates
    const { data: templates } = await supabase
      .from("email_templates")
      .select("*")
      .in("id", ["avis_google_sous_traitant", "avis_google_direct"]);

    const templateMap: Record<string, { subject: string; body: string }> = {};
    (templates || []).forEach((t: any) => {
      templateMap[t.id] = { subject: t.subject, body: t.body };
    });

    let sent = 0;
    let errors = 0;

    for (const formation of formations) {
      if (!RESEND_API_KEY) continue;

      const isSousTraitant = formation.collaboration_mode === "sous-traitant";
      const templateId = isSousTraitant ? "avis_google_sous_traitant" : "avis_google_direct";
      const template = templateMap[templateId];

      if (!template) {
        console.error(`Template ${templateId} introuvable`);
        errors++;
        continue;
      }

      const formationName = formation.formation_name || "Formation";
      const formateurName = isSousTraitant
        ? `${formation.subcontractor_first_name || ""} ${formation.subcontractor_last_name || ""}`.trim()
        : "Nathalie JOULIÉ MORAND";

      const subject = template.subject
        .replace(/\{\{formation\}\}/g, formationName)
        .replace(/\{\{formateur\}\}/g, formateurName);

      const body = template.body
        .replace(/\{\{formation\}\}/g, formationName)
        .replace(/\{\{formateur\}\}/g, formateurName);

      // Collecter les destinataires : client_email + apprenants avec email
      const recipients: string[] = [];
      if (formation.client_email) recipients.push(formation.client_email);

      try {
        const learnersData = typeof formation.learners_data === "string"
          ? JSON.parse(formation.learners_data || "[]")
          : formation.learners_data || [];

        learnersData.forEach((l: any) => {
          if (l.email && !recipients.includes(l.email)) {
            recipients.push(l.email);
          }
        });
      } catch (e) {
        console.warn(`Erreur parsing learners pour formation ${formation.id}:`, e);
      }

      if (recipients.length === 0) {
        console.log(`Aucun destinataire pour formation ${formation.id}`);
        continue;
      }

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: recipients,
            subject,
            text: body,
          }),
        });

        if (resendResponse.ok) {
          await supabase
            .from("formations")
            .update({ avis_google_sent: true, avis_google_sent_at: new Date().toISOString() })
            .eq("id", formation.id);
          sent++;
        } else {
          const errBody = await resendResponse.text();
          console.error(`Erreur Resend pour formation ${formation.id}:`, errBody);
          errors++;
        }
      } catch (e) {
        console.error(`Erreur envoi avis Google pour formation ${formation.id}:`, e);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ message: `Avis Google: ${sent} envoyés, ${errors} erreurs`, sent, errors }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
