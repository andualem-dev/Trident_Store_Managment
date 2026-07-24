"use client";

import { EquipmentStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createEquipment,
  setEquipmentMaintenance,
  updateEquipment,
  type ActionResult,
  type EquipmentRow,
} from "@/app/admin/equipment/actions";
import {
  EQUIPMENT_CATEGORIES,
  type EquipmentCategoryPreset,
} from "@/lib/equipment-categories";

function statusLabel(status: EquipmentStatus) {
  switch (status) {
    case EquipmentStatus.AVAILABLE:
      return "Available";
    case EquipmentStatus.RENTED:
      return "Rented";
    case EquipmentStatus.BOOKED:
      return "Booked";
    case EquipmentStatus.MAINTENANCE:
      return "Maintenance";
  }
}

function statusClass(status: EquipmentStatus) {
  switch (status) {
    case EquipmentStatus.AVAILABLE:
      return "bg-emerald-50 text-emerald-800 ring-emerald-600/20";
    case EquipmentStatus.RENTED:
      return "bg-blue-50 text-blue-800 ring-blue-600/20";
    case EquipmentStatus.BOOKED:
      return "bg-amber-50 text-amber-900 ring-amber-600/20";
    case EquipmentStatus.MAINTENANCE:
      return "bg-orange-50 text-orange-900 ring-orange-600/20";
  }
}

function formatRate(dailyRate: string) {
  const value = Number.parseFloat(dailyRate);
  return Number.isFinite(value) ? value.toFixed(2) : dailyRate;
}

function categoryPreset(category: string): EquipmentCategoryPreset {
  if ((EQUIPMENT_CATEGORIES as readonly string[]).includes(category)) {
    return category as EquipmentCategoryPreset;
  }
  return "Other";
}

type FormMode = "create" | "edit" | null;

type FormState = {
  id?: string;
  name: string;
  category: EquipmentCategoryPreset;
  customCategory: string;
  dailyRate: string;
};

const emptyForm: FormState = {
  name: "",
  category: "Camera",
  customCategory: "",
  dailyRate: "",
};

export function EquipmentAdminPanel({ equipment }: { equipment: EquipmentRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setFormMode("create");
  }

  function openEdit(row: EquipmentRow) {
    const preset = categoryPreset(row.category);
    setForm({
      id: row.id,
      name: row.name,
      category: preset,
      customCategory: preset === "Other" ? row.category : "",
      dailyRate: row.dailyRate,
    });
    setFormError(null);
    setFormMode("edit");
  }

  function closeForm() {
    setFormMode(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function runAction(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const payload = new FormData();
    payload.set("name", form.name);
    payload.set("category", form.category);
    payload.set("customCategory", form.customCategory);
    payload.set("dailyRate", form.dailyRate);

    if (formMode === "edit" && form.id) {
      payload.set("id", form.id);
      runAction(() => updateEquipment(payload), closeForm);
      return;
    }

    runAction(() => createEquipment(payload), closeForm);
  }

  function handleMaintenanceToggle(row: EquipmentRow) {
    if (row.status === EquipmentStatus.MAINTENANCE) {
      runAction(() => setEquipmentMaintenance(row.id, false));
      return;
    }

    if (row.status === EquipmentStatus.RENTED) {
      const confirmed = window.confirm(
        "This item is marked RENTED. A customer may still have it. Mark as maintenance anyway?",
      );
      if (!confirmed) {
        return;
      }
    }

    runAction(() => setEquipmentMaintenance(row.id, true));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {equipment.length} item{equipment.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex min-h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Add equipment
        </button>
      </div>

      {actionError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Daily rate</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {equipment.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">
                  No equipment yet. Add your first item.
                </td>
              </tr>
            ) : (
              equipment.map((row) => (
                <tr key={row.id} className="text-zinc-900">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3 tabular-nums">{formatRate(row.dailyRate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
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
                      {row.status === EquipmentStatus.MAINTENANCE ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleMaintenanceToggle(row)}
                          className="rounded-md border border-emerald-300 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-zinc-500"
                        >
                          Mark available
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => handleMaintenanceToggle(row)}
                          className="rounded-md border border-orange-300 px-2.5 py-1.5 text-xs font-medium text-orange-900 hover:bg-orange-50 disabled:cursor-not-allowed disabled:text-zinc-500"
                        >
                          Mark maintenance
                        </button>
                      )}
                    </div>
                    {row.status === EquipmentStatus.RENTED ||
                    row.status === EquipmentStatus.BOOKED ? (
                      <p className="mt-1 text-xs text-zinc-600">
                        Cannot set to available here while {row.status.toLowerCase()}.
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="equipment-form-title"
          >
            <h2 id="equipment-form-title" className="text-lg font-semibold text-zinc-900">
              {formMode === "create" ? "Add equipment" : "Edit equipment"}
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="eq-name" className="mb-1 block text-sm font-medium">
                  Name
                </label>
                <input
                  id="eq-name"
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="eq-category" className="mb-1 block text-sm font-medium">
                  Category
                </label>
                <select
                  id="eq-category"
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value as EquipmentCategoryPreset,
                    }))
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  {EQUIPMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              {form.category === "Other" ? (
                <div>
                  <label
                    htmlFor="eq-custom-category"
                    className="mb-1 block text-sm font-medium"
                  >
                    Custom category
                  </label>
                  <input
                    id="eq-custom-category"
                    required
                    value={form.customCategory}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customCategory: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
              <div>
                <label htmlFor="eq-rate" className="mb-1 block text-sm font-medium">
                  Daily rate
                </label>
                <input
                  id="eq-rate"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.dailyRate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dailyRate: event.target.value }))
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              {formError ? (
                <p className="text-sm text-red-600">{formError}</p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:text-zinc-950"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
