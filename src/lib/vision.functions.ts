import { createServerFn } from "@tanstack/react-start";

type AnalyzeResult = {
  name?: string;
  category?: string;
  colors?: string[];
  description?: string;
  suggestedPrice?: number;
};

export const analyzeProductImage = createServerFn({ method: "POST" })
  .inputValidator((data: { imageUrl: string }) => {
    if (!data?.imageUrl || typeof data.imageUrl !== "string") {
      throw new Error("imageUrl requis");
    }
    return data;
  })
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY non configuré");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Tu es un expert en lingerie et vêtements féminins. Réponds UNIQUEMENT en JSON valide, sans texte autour, sans markdown.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  'Analyse cette image de produit (lingerie/vêtement) et retourne uniquement ce JSON: {"name": string, "category": "Lingerie"|"Pyjama"|"Robe"|"Soutien-gorge"|autre, "colors": string[], "description": string court en français, "suggestedPrice": number en TND}',
              },
              { type: "image_url", image_url: { url: data.imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Trop de requêtes, réessayez dans un instant");
      if (res.status === 402) throw new Error("Crédits IA épuisés, contactez l'administrateur");
      throw new Error(`Erreur IA (${res.status}): ${txt.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    const cleaned = content
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Réponse IA invalide");
    try {
      return JSON.parse(match[0]) as AnalyzeResult;
    } catch {
      throw new Error("JSON IA invalide");
    }
  });
