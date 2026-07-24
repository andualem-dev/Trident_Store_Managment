"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createOperator,
  resetOperatorPassword,
  updateOperator,
  type ActionResult,
  type OperatorRow,
} from "@/app/admin/operators/actions";

type PanelMode = "create" | "edit" | "password" | null;

type OperatorForm = {
  id?: string;
  name: string;
  password: string;
  isAdmin: boolean;
};

const emptyForm: OperatorForm = {
  name: "",
  password: "",
  isAdmin: false,
};

export function OperatorsAdminPanel({
  operators,
  currentOperatorId,
}: {
  operators: OperatorRow[];
  currentOperatorId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<PanelMode>(null);
  const [form, setForm] = useState<OperatorForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setMode("create");
  }

  function openEdit(row: OperatorRow) {
    setForm({
      id: row.id,
      name: row.name,
      password: "",
      isAdmin: row.isAdmin,
    });
    setError(null);
    setMode("edit");
  }

  function openPasswordReset(row: OperatorRow) {
    setForm({
      id: row.id,
      name: row.name,
      password: "",
      isAdmin: row.isAdmin,
    });
    setError(null);
    setMode("password");
  }

  function closePanel() {
    setMode(null);
    setForm(emptyForm);
    setError(null);
  }

  function runAction(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  function handleCreateOrEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = new FormData();
    payload.set("name", form.name);
    payload.set("isAdmin", form.isAdmin ? "true" : "false");

    if (mode === "edit" && form.id) {
      payload.set("id", form.id);
      runAction(() => updateOperator(payload), closePanel);
      return;
    }

    payload.set("password", form.password);
    runAction(() => createOperator(payload), closePanel);
  }

  function handlePasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.id) {
      return;
    }

    const payload = new FormData();
    payload.set("id", form.id);
    payload.set("password", form.password);
    runAction(() => resetOperatorPassword(payload), closePanel);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {operators.length} operator{operators.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Add operator
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {operators.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-600">
                  No operators yet.
                </td>
              </tr>
            ) : (
              operators.map((row) => (
                <tr key={row.id} className="text-zinc-900">
                  <td className="px-4 py-3 font-medium">
                    {row.name}
                    {row.id === currentOperatorId ? (
                      <span className="ml-2 text-xs font-normal text-zinc-500">(you)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {row.isAdmin ? (
                      <span className="inline-flex rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                        Operator
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openEdit(row)}
                        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-500"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openPasswordReset(row)}
                        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-500"
                      >
                        Reset password
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="operator-form-title"
          >
            <h2 id="operator-form-title" className="text-lg font-semibold text-zinc-900">
              {mode === "create"
                ? "Add operator"
                : mode === "edit"
                  ? "Edit operator"
                  : "Reset password"}
            </h2>

            {mode === "password" ? (
              <form onSubmit={handlePasswordReset} className="mt-4 space-y-4">
                <p className="text-sm text-zinc-600">{form.name}</p>
                <div>
                  <label htmlFor="op-password" className="mb-1 block text-sm font-medium">
                    New password
                  </label>
                  <input
                    id="op-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  >
                    {pending ? "Saving…" : "Save password"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateOrEdit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="op-name" className="mb-1 block text-sm font-medium">
                    Name
                  </label>
                  <input
                    id="op-name"
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                {mode === "create" ? (
                  <div>
                    <label htmlFor="op-new-password" className="mb-1 block text-sm font-medium">
                      Password
                    </label>
                    <input
                      id="op-new-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, password: event.target.value }))
                      }
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={form.isAdmin}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, isAdmin: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Admin access
                </label>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closePanel}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
