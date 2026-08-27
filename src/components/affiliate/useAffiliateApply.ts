import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { affiliateSchema, type AffiliateFormData } from "./affiliateData";

// Shared form state + submit logic so the desktop and mobile presentation
// components render the same single application flow without duplicating it.
export function useAffiliateApply() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<AffiliateFormData>({
    resolver: zodResolver(affiliateSchema),
    defaultValues: {
      socialAccounts: [{ platform: "Instagram", account: "" }],
      confirmed: false,
    },
  });

  const socialAccounts = useFieldArray({ control: form.control, name: "socialAccounts" });

  const onSubmit = form.handleSubmit(async (formData) => {
    setSubmitting(true);
    try {
      const resolvedAcquisitionSource =
        formData.acquisitionSource === "Other"
          ? formData.acquisitionOther?.trim() || "Other"
          : formData.acquisitionSource;

      const res = await fetch("/api/affiliate-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialAccounts: formData.socialAccounts,
          email: formData.email,
          petName: formData.petName,
          country: formData.country,
          acquisitionSource: resolvedAcquisitionSource,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to submit application.", { position: "top-center" });
        return;
      }
      toast.success("Application submitted!", { position: "top-center" });
      setSubmitted(true);
    } catch {
      toast.error("Network error. Please try again.", { position: "top-center" });
    } finally {
      setSubmitting(false);
    }
  });

  return { form, socialAccounts, submitting, submitted, setSubmitted, onSubmit };
}

export type AffiliateApply = ReturnType<typeof useAffiliateApply>;
