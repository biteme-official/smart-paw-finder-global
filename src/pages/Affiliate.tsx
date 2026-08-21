import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, BadgePercent, Users2, Instagram, Mail, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const BENEFITS = [
  {
    icon: BadgePercent,
    title: "Performance-Based Commission",
    desc: "Earn commission on sales generated through your dedicated affiliate code, at a special launch rate.",
  },
  {
    icon: Users2,
    title: "Collab Opportunities",
    desc: "Get ongoing opportunities for new product collaborations and events.",
  },
];

const STEPS = [
  "Submit your Instagram account and email address using the form below.",
  "Applications are reviewed in the order received by our team.",
  "Once approved, you'll receive an invitation by email. Please allow some time, as applications are handled in order.",
];

const schema = z.object({
  instagramHandle: z
    .string()
    .min(1, "Instagram account is required")
    .regex(/^[a-zA-Z0-9._]+$/, "Enter a valid Instagram handle"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
});

type FormData = z.infer<typeof schema>;

export default function Affiliate() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const handleSearch = (query: string) => {
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  };

  const onSubmit = async (formData: FormData) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliate-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
        <Link
          to="/"
          className="inline-flex items-center gap-1 px-4 md:px-0 md:max-w-2xl md:mx-auto mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> BITE ME
        </Link>

        {/* Hero */}
        <section className="px-4 md:max-w-2xl md:mx-auto mt-6 text-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-600">
            <Sparkles className="h-3.5 w-3.5" /> Affiliate Collab
          </span>
          <h1 className="mt-4 text-2xl md:text-3xl font-bold text-foreground leading-tight">
            BITE ME GLOBAL
            <br />
            Affiliate Program
          </h1>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            We're looking for affiliate partners who love BITE ME to help share our products with the world.
          </p>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Introduce your favorite BITE ME products to your followers on Instagram.
          </p>
        </section>

        {/* Commission highlight */}
        <section className="px-4 md:max-w-2xl md:mx-auto mt-8">
          <div className="rounded-2xl bg-orange-500 text-white px-6 py-8 text-center">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium mb-3">
              🎉 Launch Campaign
            </span>
            <p className="text-5xl font-extrabold">10%</p>
            <p className="mt-2 text-sm font-semibold">Commission on Referred Sales</p>
            <p className="mt-2 text-xs text-white/85 leading-relaxed">
              To celebrate the launch of our affiliate program, we're offering a special 10% commission
              rate for a limited time.
            </p>
          </div>
        </section>

        {/* Partner benefits */}
        <section className="px-4 md:max-w-2xl md:mx-auto mt-10">
          <h2 className="text-center text-lg font-bold text-foreground mb-4">Partner Benefits</h2>
          <div className="space-y-3">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100">
                  <Icon className="h-4.5 w-4.5 text-orange-600" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 md:max-w-2xl md:mx-auto mt-10">
          <h2 className="text-center text-lg font-bold text-foreground mb-4">How It Works</h2>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white text-[11px] font-bold">
                  {i + 1}
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-center text-xs text-muted-foreground/70">
            * Applications are handled on a first-come, first-served basis.
          </p>
        </section>

        {/* Application form */}
        <section className="px-4 md:max-w-2xl md:mx-auto mt-10 mb-16">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Apply Now</CardTitle>
              <CardDescription>Enter your Instagram account and email address.</CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="text-center py-6">
                  <p className="text-sm font-semibold text-foreground">Thanks for applying!</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    We'll review your application and email you if you're invited to the program.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="font-semibold flex items-center gap-1.5">
                      <Instagram className="h-3.5 w-3.5" /> Instagram Account
                    </Label>
                    <Input placeholder="@your_account" {...register("instagramHandle")} />
                    {errors.instagramHandle && (
                      <p className="text-xs text-destructive">{errors.instagramHandle.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="font-semibold flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email Address
                    </Label>
                    <Input placeholder="example@email.com" {...register("email")} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full h-11 text-sm font-semibold">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Apply
                  </Button>

                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                    The information you provide is used only to contact you about the affiliate program.{" "}
                    <Link to="/privacy" className="underline hover:text-foreground">
                      See our Privacy Policy
                    </Link>
                    .
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
}
