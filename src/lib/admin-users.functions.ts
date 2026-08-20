import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RoleSchema = z.enum(["admin", "manager", "vendeur"]);

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès refusé : administrateurs uniquement.");
}

async function setUserRole(userId: string, role: "admin" | "manager" | "vendeur") {
  const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  if (del.error) throw new Error(del.error.message);
  const ins = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
  if (ins.error) throw new Error(ins.error.message);
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, created_at");
    if (pErr) throw new Error(pErr.message);
    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);
    const roleMap = new Map<string, "admin" | "manager" | "vendeur">();
    (roles ?? []).forEach((r: any) => {
      const existing = roleMap.get(r.user_id);
      // admin > manager > vendeur priority
      const rank = (x: string) => (x === "admin" ? 3 : x === "manager" ? 2 : 1);
      if (!existing || rank(r.role) > rank(existing)) roleMap.set(r.user_id, r.role);
    });
    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      created_at: p.created_at,
      role: roleMap.get(p.id) ?? "vendeur",
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(72),
        display_name: z.string().trim().min(1).max(120),
        role: RoleSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (error) throw new Error(error.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("Création de l'utilisateur échouée.");
    // handle_new_user trigger insère un profil + rôle 'vendeur' par défaut.
    // Mettre à jour le profil et forcer le bon rôle.
    await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.display_name, email: data.email })
      .eq("id", newId);
    await setUserRole(newId, data.role);
    return { id: newId };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        email: z.string().email().max(255).optional(),
        display_name: z.string().trim().min(1).max(120).optional(),
        role: RoleSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        email: data.email,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
    }
    const profileUpdate: { email?: string; display_name?: string } = {};
    if (data.email) profileUpdate.email = data.email;
    if (data.display_name) profileUpdate.display_name = data.display_name;
    if (Object.keys(profileUpdate).length) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }
    if (data.role) await setUserRole(data.user_id, data.role);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        new_password: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const transferAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ to_user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.to_user_id === context.userId) {
      throw new Error("Le destinataire est déjà vous-même.");
    }
    // Vérifier que la cible existe
    const { data: target, error: tErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", data.to_user_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target) throw new Error("Utilisateur cible introuvable.");

    await setUserRole(data.to_user_id, "admin");
    await setUserRole(context.userId, "manager");
    return { ok: true };
  });
