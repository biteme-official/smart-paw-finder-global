import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowDown,
  MousePointerClick,
  Clock,
  Mail,
  Gift,
  Ticket,
  Percent,
  Users,
  TrendingUp,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface StepDef {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const STEPS: StepDef[] = [
  { icon: MousePointerClick, title: "Apply", desc: "Instagram, email, dog's name" },
  { icon: Clock, title: "Review", desc: "Handled in order received" },
  { icon: Mail, title: "Get invited", desc: "Receive invitation by email" },
  { icon: Gift, title: "Earn", desc: "Upload content and earn commission" },
];

interface BenefitDef {
  icon: LucideIcon;
  bgClass: string;
  iconClass: string;
  title: string;
  desc: string;
}

const BENEFITS: BenefitDef[] = [
  { icon: Ticket, bgClass: "bg-amber-100", iconClass: "text-amber-600", title: "15% off coupon", desc: "Applies to all products" },
  { icon: Percent, bgClass: "bg-red-100", iconClass: "text-red-600", title: "10% commission", desc: "Applies to all products" },
  { icon: Users, bgClass: "bg-blue-100", iconClass: "text-blue-600", title: "Collab opportunities", desc: "Based on content performance" },
  { icon: TrendingUp, bgClass: "bg-purple-100", iconClass: "text-purple-600", title: "Tiered rates", desc: "Grow with your sales" },
];

const schema = z.object({
  instagramHandle: z
    .string()
    .min(1, "Instagram account is required")
    .regex(/^[a-zA-Z0-9._]+$/, "Enter a valid Instagram handle"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  dogName: z
    .string()
    .min(1, "Dog's name is required")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Enter a valid name"),
  confirmed: z.boolean().refine((v) => v === true, {
    message: "Please confirm the discount and commission terms",
  }),
});

type FormData = z.infer<typeof schema>;

export default function Affiliate() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { confirmed: false } });

  const handleSearch = (query: string) => {
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  };

  const onSubmit = async (formData: FormData) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramHandle: formData.instagramHandle,
          email: formData.email,
          dogName: formData.dogName,
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
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={handleSearch} />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 mt-6">
          {/* Hero banner */}
          <section className="relative aspect-[21/9] rounded-3xl overflow-hidden bg-gradient-to-br from-orange-400 to-orange-500">
            <div className="relative h-full flex flex-col items-start justify-center gap-4 px-8 md:px-16">
              <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-sm font-semibold text-orange-600">
                Affiliate Collab
              </span>
              <h1 className="text-3xl md:text-6xl font-bold text-white leading-tight">
                Share Bite Me,
                <br />
                earn together
              </h1>
            </div>
          </section>

          {/* How it works */}
          <section className="mt-14 md:mt-20">
            <h2 className="text-lg md:text-2xl font-bold text-foreground text-center mb-6 md:mb-8">How it works</h2>

            {/* Desktop: row with connecting arrows */}
            <div className="hidden md:flex items-stretch gap-4">
              {STEPS.map(({ icon: Icon, title, desc }, index) => (
                <div key={title} className="flex items-stretch flex-1 gap-4">
                  <div className="flex flex-col items-center text-center gap-3 flex-1 rounded-2xl border border-border py-10 px-4">
                    <Icon className="h-9 w-9 text-orange-500" strokeWidth={1.75} />
                    <p className="text-base font-bold text-foreground">{title}</p>
                    <p className="text-sm text-muted-foreground leading-snug">{desc}</p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <ArrowRight className="h-5 w-5 text-muted-foreground self-center shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile: stacked with connecting arrows */}
            <div className="md:hidden flex flex-col items-center gap-2">
              {STEPS.map(({ icon: Icon, title, desc }, index) => (
                <div key={title} className="w-full flex flex-col items-center">
                  <div className="w-full flex flex-col items-center text-center gap-2 rounded-xl border border-border py-5 px-4">
                    <Icon className="h-6 w-6 text-orange-500" strokeWidth={1.75} />
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <ArrowDown className="h-4 w-4 text-muted-foreground my-1 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Partner benefits */}
          <section className="mt-14 md:mt-20">
            <h2 className="text-lg md:text-2xl font-bold text-foreground text-center mb-6 md:mb-8">Partner benefits</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {BENEFITS.map(({ icon: Icon, bgClass, iconClass, title, desc }) => (
                <div key={title} className="flex flex-col items-center text-center gap-2 md:gap-4">
                  <span className={`flex h-16 w-16 md:h-36 md:w-36 items-center justify-center rounded-2xl ${bgClass}`}>
                    <Icon className={`h-7 w-7 md:h-14 md:w-14 ${iconClass}`} strokeWidth={1.75} />
                  </span>
                  <p className="text-sm md:text-base font-semibold text-foreground">{title}</p>
                  <p className="text-xs md:text-sm text-muted-foreground leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Apply now */}
          <section className="mt-14 md:mt-20 mb-16">
            {submitted ? (
              <div className="rounded-3xl bg-muted text-center px-6 py-10 md:px-10 md:py-14">
                <p className="text-base font-semibold text-foreground">Thanks for applying!</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  We'll review your application and email you if you're invited to the program.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl bg-muted px-6 py-8 md:px-10 md:py-10">
                <h2 className="text-lg md:text-2xl font-bold text-foreground mb-1">Apply now</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Enter your Instagram account, email, and dog's name.
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="font-semibold">Instagram account</Label>
                      <Input placeholder="@your_account" {...register("instagramHandle")} />
                      {errors.instagramHandle && (
                        <p className="text-xs text-destructive">{errors.instagramHandle.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="font-semibold">Email address</Label>
                      <Input placeholder="example@email.com" {...register("email")} />
                      {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold">Dog's name</Label>
                    <Input placeholder="coco" className="w-full" {...register("dogName")} />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This will be used to generate your coupon code (e.g. dog's name "coco" → coupon code
                      "COCO15").
                    </p>
                    {errors.dogName && <p className="text-xs text-destructive">{errors.dogName.message}</p>}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <Controller
                        name="confirmed"
                        control={control}
                        render={({ field }) => (
                          <Checkbox
                            id="confirmed"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5"
                          />
                        )}
                      />
                      <Label htmlFor="confirmed" className="font-normal text-sm text-foreground leading-snug">
                        I confirm the 15% discount and 10% commission.
                      </Label>
                    </div>
                    {errors.confirmed && <p className="text-xs text-destructive">{errors.confirmed.message}</p>}
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={submitting} size="sm" className="font-semibold px-6">
                      {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Apply
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    After submitting, you'll be redirected to a guide page — please review it.
                  </p>
                </form>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
