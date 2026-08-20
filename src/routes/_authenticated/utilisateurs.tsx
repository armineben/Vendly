import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
  Trash2,
  Pencil,
  KeyRound,
  Crown,
  Briefcase,
  Eye,
} from "lucide-react";
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  transferAdmin,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/utilisateurs")({
  component: UtilisateursPage,
});

type Row = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "admin" | "manager" | "vendeur";
};

type AppRole = "admin" | "manager" | "vendeur";

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrateur",
  manager: "Manager",
  vendeur: "Vendeur",
};

function RoleBadge({ role }: { role: AppRole }) {
  const Icon = role === "admin" ? ShieldCheck : role === "manager" ? Briefcase : UserIcon;
  const cls =
    role === "admin"
      ? "bg-accent-soft text-accent"
      : role === "manager"
        ? "bg-primary/10 text-primary"
        : "bg-secondary text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {ROLE_LABEL[role]}
    </span>
  );
}

function UtilisateursPage() {
  const { isAdmin, user: currentUser, signOut, setImpersonatedUser } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Form state
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ display_name: "", email: "", password: "", role: "vendeur" as AppRole });
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ display_name: "", email: "", role: "vendeur" as AppRole });
  const [saving, setSaving] = useState(false);

  // Password reset
  const [pwdTarget, setPwdTarget] = useState<Row | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  // Transfer admin
  const [transferTarget, setTransferTarget] = useState<Row | null>(null);
  const [transferring, setTransferring] = useState(false);

  const fnList = useServerFn(listUsers);
  const fnCreate = useServerFn(createUser);
  const fnUpdate = useServerFn(updateUser);
  const fnReset = useServerFn(resetUserPassword);
  const fnDelete = useServerFn(deleteUser);
  const fnTransfer = useServerFn(transferAdmin);

  async function load() {
    setLoading(true);
    try {
      const data = await fnList();
      const list = (data as Row[]).slice().sort((a, b) => {
        const rank = (r: AppRole) => (r === "admin" ? 0 : r === "manager" ? 1 : 2);
        return rank(a.role) - rank(b.role) || (a.email ?? "").localeCompare(b.email ?? "");
      });
      setRows(list);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de chargement");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Accès réservé aux administrateurs.</div>;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await fnCreate({ data: form });
      toast.success(`Compte créé pour ${form.email}`);
      setCreateOpen(false);
      setForm({ display_name: "", email: "", password: "", role: "vendeur" });
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
    setCreating(false);
  }

  function openEdit(r: Row) {
    setEditTarget(r);
    setEditForm({ display_name: r.display_name ?? "", email: r.email ?? "", role: r.role });
  }

  async function handleEditSave() {
    if (!editTarget) return;
    setSaving(true);
    try {
      await fnUpdate({
        data: {
          user_id: editTarget.id,
          display_name: editForm.display_name,
          email: editForm.email,
          role: editForm.role,
        },
      });
      toast.success("Utilisateur mis à jour");
      setEditTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
    setSaving(false);
  }

  async function handlePwdReset() {
    if (!pwdTarget) return;
    if (pwdValue.length < 8) {
      toast.error("Mot de passe : 8 caractères minimum");
      return;
    }
    setPwdSaving(true);
    try {
      await fnReset({ data: { user_id: pwdTarget.id, new_password: pwdValue } });
      toast.success("Mot de passe réinitialisé");
      setPwdTarget(null);
      setPwdValue("");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
    setPwdSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await fnDelete({ data: { user_id: deleteTarget.id } });
      toast.success("Compte supprimé");
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
    setBusyId(null);
  }

  async function handleTransfer() {
    if (!transferTarget) return;
    setTransferring(true);
    try {
      await fnTransfer({ data: { to_user_id: transferTarget.id } });
      toast.success(`Droits transférés à ${transferTarget.email}. Reconnectez-vous.`);
      setTransferTarget(null);
      await signOut();
      navigate({ to: "/login" });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
      setTransferring(false);
    }
  }

  const admins = rows.filter((r) => r.role === "admin");
  const managers = rows.filter((r) => r.role === "manager");

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Accès</p>
          <h1 className="font-display text-3xl lg:text-4xl">Gestion des utilisateurs</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Créez, modifiez ou supprimez les comptes. Attribuez les rôles : Administrateur (accès complet),
            Manager (gestion étendue) ou Vendeur (catalogue uniquement).
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          <UserPlus className="h-4 w-4" />
          Nouveau compte
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Administrateurs" value={admins.length} />
        <Stat label="Managers" value={managers.length} />
        <Stat label="Vendeurs" value={rows.length - admins.length - managers.length} />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const isSelf = r.id === currentUser?.id;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={r.role} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <IconBtn title="Modifier" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" /> Modifier
                        </IconBtn>
                        <IconBtn title="Réinitialiser MDP" onClick={() => setPwdTarget(r)}>
                          <KeyRound className="h-3.5 w-3.5" /> MDP
                        </IconBtn>
                        {!isSelf && (r.role === "manager" || r.role === "vendeur") && (
                          <>
                            <IconBtn
                              title="Voir en tant que"
                              onClick={() => setImpersonatedUser(r.id)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Voir en tant que
                            </IconBtn>
                            <IconBtn
                              title="Transférer les droits admin"
                              onClick={() => setTransferTarget(r)}
                            >
                              <Crown className="h-3.5 w-3.5" /> Transférer admin
                            </IconBtn>
                          </>
                        )}
                        {isSelf ? (
                          <span className="px-2 py-1 text-[11px] text-muted-foreground">Vous-même</span>
                        ) : busyId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      {createOpen && (
        <Modal title="Nouveau compte" onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <Field label="Nom complet">
              <input
                required
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Mot de passe (8+ caractères)">
              <input
                required
                type="text"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Rôle">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
                className="input"
              >
                <option value="admin">Administrateur</option>
                <option value="manager">Manager</option>
                <option value="vendeur">Vendeur</option>
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Créer le compte
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT MODAL */}
      {editTarget && (
        <Modal title={`Modifier ${editTarget.email}`} onClose={() => setEditTarget(null)}>
          <div className="space-y-3">
            <Field label="Nom complet">
              <input
                value={editForm.display_name}
                onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Rôle">
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as AppRole })}
                className="input"
                disabled={editTarget.id === currentUser?.id}
              >
                <option value="admin">Administrateur</option>
                <option value="manager">Manager</option>
                <option value="vendeur">Vendeur</option>
              </select>
              {editTarget.id === currentUser?.id && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Pour vous retirer le rôle admin, utilisez "Transférer admin".
                </p>
              )}
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditTarget(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* PASSWORD RESET MODAL */}
      {pwdTarget && (
        <Modal title={`Réinitialiser le mot de passe`} onClose={() => setPwdTarget(null)}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Compte : <strong className="text-foreground">{pwdTarget.email}</strong>
            </p>
            <Field label="Nouveau mot de passe (8+ caractères)">
              <input
                type="text"
                minLength={8}
                value={pwdValue}
                onChange={(e) => setPwdValue(e.target.value)}
                className="input"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPwdTarget(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handlePwdReset}
                disabled={pwdSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
              >
                {pwdSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Réinitialiser
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <Modal title="Confirmer la suppression" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm">
            Êtes-vous sûr de vouloir supprimer le compte{" "}
            <strong>{deleteTarget.email}</strong> ? Cette action est irréversible.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer définitivement
            </button>
          </div>
        </Modal>
      )}

      {/* TRANSFER ADMIN CONFIRM */}
      {transferTarget && (
        <Modal title="Transfert des droits administrateur" onClose={() => setTransferTarget(null)}>
          <p className="text-sm">
            Vous êtes sur le point de transférer les droits administrateur à{" "}
            <strong>{transferTarget.display_name ?? transferTarget.email}</strong>. Vous serez automatiquement
            rétrogradé en <strong>Manager</strong> et déconnecté. Confirmer ?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setTransferTarget(null)}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              onClick={handleTransfer}
              disabled={transferring}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
            >
              {transferring && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Crown className="h-3.5 w-3.5" /> Confirmer le transfert
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] hover:bg-secondary"
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-display text-lg">{title}</h2>
        {children}
      </div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:0.5rem 0.75rem;border-radius:0.5rem;font-size:0.875rem;outline:none}.input:focus{border-color:hsl(var(--accent))}`}</style>
    </div>
  );
}

// Suppress unused supabase import warning (kept for future realtime needs)
void supabase;
