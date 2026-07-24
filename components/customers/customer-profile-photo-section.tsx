"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { uploadCustomerProfilePhoto } from "@/app/customers/actions";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import type { CustomerSummary } from "@/lib/customers";

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

type Props = {
  customer: CustomerSummary;
  onUpdated: (customer: CustomerSummary) => void;
};

export function CustomerProfilePhotoSection({ customer, onUpdated }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("profilePhoto", file);

    startTransition(async () => {
      const result = await uploadCustomerProfilePhoto(customer.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUpdated(result.customer);
      router.refresh();
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="space-y-3 border-t border-zinc-200 pt-4">
      <h3 className="text-sm font-semibold text-zinc-900">Profile picture</h3>

      <div className="flex flex-wrap items-center gap-4">
        <CustomerAvatar
          name={customer.name}
          profilePhotoUrl={customer.profilePhotoUrl}
          size="lg"
        />
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            capture="user"
            disabled={pending}
            onChange={(event) => handleUpload(event.target.files?.[0])}
            className="block w-full max-w-xs text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800"
          />
          {pending ? (
            <p className="text-xs text-zinc-600">Uploading…</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
