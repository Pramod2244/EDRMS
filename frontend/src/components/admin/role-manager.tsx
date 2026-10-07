"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

type Role = { id: string; name: string; description: string; system: boolean; permissions: string[]; menus: string[] };
const actions = ["VIEW", "UPLOAD", "DOWNLOAD", "DELETE", "SHARE", "PRINT", "MANAGE_PERMISSIONS", "AUDIT_READ"];
const menus = ["/documents", "/search", "/audit", "/admin"];
const blank = { name: "", description: "", permissions: ["VIEW"], menus: ["/documents", "/search"] };
function headers() {
  const token = useAuthStore.getState().token || localStorage.getItem("edrms_access_token");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
export default function RoleManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(blank);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/roles", { headers: headers() });
      if (!response.ok) throw new Error((await response.json()).message || "Unable to load roles");
      setRoles(await response.json());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load roles"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const toggle = (field: "permissions" | "menus", value: string) => setDraft((previous) => ({ ...previous,
    [field]: previous[field].includes(value) ? previous[field].filter((entry) => entry !== value) : [...previous[field], value] }));
  return <section className="min-h-0 flex-1 overflow-y-auto">
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Roles</h2>
        <p className="text-sm text-slate-500">Built-in roles stay protected. Custom roles provide reusable defaults for new assignments.</p>
        {roles.map((role) => <article key={role.id} className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold break-words">{role.name.replaceAll("_", " ")}</h3>
            {role.system ? <span className="text-xs text-slate-500 shrink-0">Built-in</span> :
              <button className="text-orange-700 text-sm" onClick={() => { setEditing(role.id); setDraft(role); setError(""); }}>Edit</button>}
          </div>
          <p className="text-sm text-slate-500 mt-1">{role.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">{role.permissions.map((action) => <span key={action} className="text-xs px-2 py-1 rounded-md bg-slate-50 border">{action.replaceAll("_", " ")}</span>)}</div>
          {!role.permissions.length && <p className="text-xs text-slate-500 mt-2">No actions granted</p>}
        </article>)}
      </div>
      <form className="self-start rounded-xl border bg-white p-5 space-y-5" onSubmit={async (event) => {
        event.preventDefault(); setSaving(true); setError("");
        try {
          const response = await fetch(editing ? `/api/roles/${editing}` : "/api/roles", {
            method: editing ? "PUT" : "POST", headers: headers(), body: JSON.stringify(draft) });
          if (!response.ok) throw new Error((await response.json()).message || "Unable to save role");
          setDraft(blank); setEditing(null); await load();
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save role"); }
        finally { setSaving(false); }
      }}>
        <h2 className="text-lg font-semibold">{editing ? "Edit role" : "Create a role"}</h2>
        {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 p-3 rounded-lg">{error}</p>}
        <label className="block text-sm font-medium">Role name
          <input required disabled={!!editing} maxLength={50} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value.toUpperCase().replaceAll(" ", "_") })}
            placeholder="ACCOUNTS_ASSISTANT" className="mt-2 w-full rounded-lg border p-2.5 disabled:bg-slate-50" />
        </label>
        <label className="block text-sm font-medium">Description
          <input maxLength={255} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-2 w-full rounded-lg border p-2.5" />
        </label>
        <fieldset><legend className="font-medium text-sm mb-3">Allowed actions</legend><div className="grid sm:grid-cols-2 gap-2">
          {actions.map((action) => <label key={action} className="flex items-center gap-2 border rounded-lg p-3 text-sm">
            <input type="checkbox" checked={draft.permissions.includes(action)} onChange={() => toggle("permissions", action)} />{action.replaceAll("_", " ")}
          </label>)}
        </div></fieldset>
        <fieldset><legend className="font-medium text-sm mb-3">Workspace menus</legend><div className="grid sm:grid-cols-2 gap-2">
          {menus.map((menu) => <label key={menu} className="flex items-center gap-2 border rounded-lg p-3 text-sm">
            <input type="checkbox" checked={draft.menus.includes(menu)} onChange={() => toggle("menus", menu)} />{{ "/documents": "Repository", "/search": "Search", "/audit": "Audit", "/admin": "Administration" }[menu]}
          </label>)}
        </div></fieldset>
        <p className="text-xs text-slate-500">Saving a role does not replace existing users’ individual permissions. Select the role in a user form to apply its defaults.</p>
        <div className="flex flex-wrap gap-3 justify-end">
          {editing && <button type="button" className="rounded-lg border px-4 py-2" onClick={() => { setEditing(null); setDraft(blank); }}>Cancel</button>}
          <button disabled={saving} className="rounded-lg bg-orange-500 text-white px-4 py-2 disabled:opacity-50">{saving ? "Saving…" : editing ? "Save role" : "Create role"}</button>
        </div>
      </form>
    </div>
  </section>;
}
