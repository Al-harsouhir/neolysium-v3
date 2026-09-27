export default {
  async fetch(request, env) {
    // Gestion des requêtes préliminaires CORS (preflight OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Méthode non autorisée", { status: 405 });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    };

    try {
      const body = await request.json();
      const {
        name,           // Pseudo Discord du client
        email,          // Adresse e-mail du client
        message,        // Cahier des charges / description
        turnstileToken, // Token Cloudflare Turnstile
        serviceType,    // Ex: "Création complète", "Refonte", "Bots & Sécurité"
        theme,          // Ex: "Gaming", "Communautaire", "Streamer", etc.
        delay,          // Ex: "Standard (24h à 72h)", "Express", etc.
        bots            // Tableau ou texte des bots/modules sélectionnés
      } = body;

      // Validation des champs obligatoires
      if (!name || !email || !message || !turnstileToken) {
        return new Response(
          JSON.stringify({ error: "Champs obligatoires manquants" }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Vérifier le token Turnstile auprès de l'API Cloudflare
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
        }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.success) {
        return new Response(
          JSON.stringify({ error: "Captcha ou vérification invalide" }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Génération d'un identifiant de commande unique (ex: CMD-K9X2A-B7F3)
      const orderNumber = "CMD-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();

      // Mise en forme des modules et bots demandés
      let formattedBots = "• Aucun bot spécifique coché (recommandation Néolysium)";
      if (Array.isArray(bots) && bots.length > 0) {
        formattedBots = bots.map((b) => `• ${b}`).join("\n");
      } else if (typeof bots === "string" && bots.trim()) {
        formattedBots = bots;
      }

      // Tronquer le message si nécessaire pour respecter la limite Discord Embed (1024 caractères max par field)
      const sanitizedMessage = message.length > 1020 
        ? message.substring(0, 1017) + "..." 
        : message;

      // Construction de l'embed Discord Cyberpunk
      const discordPayload = {
        username: "Néolysium Relay",
        avatar_url: "https://neolysium.eu/images/neolysium-preview.png",
        embeds: [
          {
            title: "⚡ NOUVELLE COMMANDE REÇUE // NÉOLYSIUM",
            url: "https://neolysium.eu",
            description: "Un nouveau projet Discord a été soumis via le terminal web de **neolysium.eu**.",
            color: 62463, // 0x00F3FF en décimal (Cyan Néolysium)
            thumbnail: {
              url: "https://neolysium.eu/images/neolysium-preview.png"
            },
            fields: [
              {
                name: "🆔 N° de commande",
                value: `\`${orderNumber}\``,
                inline: true
              },
              {
                name: "👤 Client Discord",
                value: `**${name}**`,
                inline: true
              },
              {
                name: "📧 E-mail de contact",
                value: `[${email}](mailto:${email})`,
                inline: true
              },
              {
                name: "🛠️ Type de prestation",
                value: serviceType || "Création complète",
                inline: true
              },
              {
                name: "🏷️ Thématique",
                value: theme || "Gaming / Multi-gaming",
                inline: true
              },
              {
                name: "⏱️ Délai souhaité",
                value: delay || "Standard (24h à 72h)",
                inline: true
              },
              {
                name: "🤖 Modules & Bots sélectionnés",
                value: formattedBots,
                inline: false
              },
              {
                name: "📝 Cahier des charges & Précisions",
                value: sanitizedMessage,
                inline: false
              }
            ],
            footer: {
              text: "Néolysium System Relay • Transmission chiffrée",
              icon_url: "https://neolysium.eu/images/neolysium-preview.png"
            },
            timestamp: new Date().toISOString()
          }
        ]
      };

      // Transmission au webhook Discord
      const discordRes = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });

      return new Response(
        JSON.stringify({ ok: discordRes.ok, orderNumber }),
        {
          status: discordRes.ok ? 200 : 500,
          headers: corsHeaders,
        }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Erreur interne du serveur" }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
