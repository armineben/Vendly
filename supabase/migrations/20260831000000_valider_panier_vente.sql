-- =====================================================
-- FONCTION RPC : valider_panier_vente
-- Déduit le stock (colonne quantite) et enregistre la vente
-- =====================================================

CREATE OR REPLACE FUNCTION public.valider_panier_vente(
  p_vendeur_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  v_article_id uuid;
  v_variante_id uuid;
  v_quantite integer;
  v_prix_unitaire numeric;
  v_prix_achat_unitaire numeric;
  v_total numeric;
  v_benefice numeric;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_article_id   := NULLIF(item->>'article_id', '')::uuid;
    v_variante_id  := NULLIF(item->>'variante_id', '')::uuid;
    v_quantite     := COALESCE((item->>'quantite')::int, 0);
    v_prix_unitaire := COALESCE((item->>'prix_unitaire')::numeric, 0);
    v_prix_achat_unitaire := COALESCE((item->>'prix_achat_unitaire')::numeric, 0);
    v_total        := COALESCE((item->>'total')::numeric, 0);
    v_benefice     := (v_prix_unitaire - v_prix_achat_unitaire) * v_quantite;

    -- Enregistrer la vente
    INSERT INTO public.sales
      (article_id, quantite, prix_unitaire, prix_achat_unitaire, total, benefice, vendeur_id, vendeur_nom, statut)
    VALUES
      (v_article_id, v_quantite, v_prix_unitaire, v_prix_achat_unitaire, v_total, v_benefice, p_vendeur_id, 'Caisse', 'validee');

    -- Décrémenter le stock article (colonne exacte : quantite)
    IF v_article_id IS NOT NULL THEN
      UPDATE public.articles
      SET quantite = GREATEST(0, COALESCE(quantite, 0) - v_quantite)
      WHERE id = v_article_id;
    END IF;

    -- Décrémenter le stock variante (colonne : stock)
    IF v_variante_id IS NOT NULL THEN
      UPDATE public.variantes
      SET stock = GREATEST(0, COALESCE(stock, 0) - v_quantite)
      WHERE id = v_variante_id;
    END IF;
  END LOOP;
END;
$$;

-- Permissions d'exécution pour les utilisateurs connectés
GRANT EXECUTE ON FUNCTION public.valider_panier_vente(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_panier_vente(uuid, jsonb) TO service_role;

-- Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
