import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowDown,
  MousePointerClick,
  Mail,
  Link2,
  Gift,
  Users,
  TrendingUp,
  Loader2,
  Plus,
  X,
  Sparkles,
  Smartphone,
  AtSign,
  PawPrint,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import heroBanner from "@/assets/affiliate-hero-banner.jpg";
import heroBanner2 from "@/assets/affiliate-hero-banner-2.jpg";
import heroBannerMobile from "@/assets/affiliate-hero-banner-mobile.jpg";
import heroBannerMobile2 from "@/assets/affiliate-hero-banner-mobile-2.jpg";

const HERO_IMAGES_DESKTOP = [heroBanner, heroBanner2];
const HERO_IMAGES_MOBILE = [heroBannerMobile, heroBannerMobile2];
const HERO_SLIDE_MS = 4500;

const SOCIAL_PLATFORMS = ["Instagram", "TikTok"] as const;

const COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Netherlands",
  "Japan",
  "South Korea",
  "Singapore",
  "Hong Kong",
  "Macau",
  "Taiwan",
  "Malaysia",
  "Thailand",
  "Vietnam",
  "Philippines",
  "Indonesia",
  "China",
  "India",
  "Other",
] as const;

const ACQUISITION_SOURCES = [
  "Instagram",
  "TikTok",
  "Google Search",
  "Friend / Referral",
  "Offline Event",
  "Other",
] as const;

interface StepDef {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const STEPS: StepDef[] = [
  { icon: MousePointerClick, title: "Apply", desc: "Submit your application" },
  { icon: Mail, title: "Get Invited", desc: "Receive your invitation by email" },
  { icon: Link2, title: "Share Your Link", desc: "Create and share your unique affiliate link" },
  { icon: Gift, title: "Earn Commission", desc: "Earn 10% on every eligible sale" },
];

interface BenefitDef {
  icon?: LucideIcon;
  value?: string;
  bgClass: string;
  accentClass: string;
  title: string;
  desc: string;
}

const BENEFITS: BenefitDef[] = [
  {
    value: "15%",
    bgClass: "bg-amber-100",
    accentClass: "text-amber-600",
    title: "OFF for Your Followers",
    desc: "Give your community an exclusive discount",
  },
  {
    value: "10%",
    bgClass: "bg-red-100",
    accentClass: "text-red-600",
    title: "Commission",
    desc: "Get rewarded for every eligible sale",
  },
  {
    icon: Users,
    bgClass: "bg-blue-100",
    accentClass: "text-blue-600",
    title: "Exclusive Collabs",
    desc: "Top creators get more opportunities",
  },
  {
    icon: TrendingUp,
    bgClass: "bg-purple-100",
    accentClass: "text-purple-600",
    title: "Higher Rates",
    desc: "Unlock higher rates as your sales grow",
  },
];

const schema = z.object({
  socialAccounts: z
    .array(
      z.object({
        platform: z.enum(SOCIAL_PLATFORMS),
        account: z
          .string()
          .min(1, "Account is required")
          .regex(/^[a-zA-Z0-9._@\s-]+$/, "Enter a valid account name"),
      }),
    )
    .min(1),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  petName: z
    .string()
    .min(1, "Pet's name is required")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Enter a valid name"),
  country: z.enum(COUNTRIES).optional(),
  acquisitionSource: z.enum(ACQUISITION_SOURCES).optional(),
  acquisitionOther: z.string().optional(),
  confirmed: z.boolean().refine((v) => v === true, {
    message: "Please confirm the discount and commission terms",
  }),
});

type FormData = z.infer<typeof schema>;

export default function Affiliate() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_IMAGES_DESKTOP.length);
    }, HERO_SLIDE_MS);
    return () => clearInterval(timer);
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { socialAccounts: [{ platform: "Instagram", account: "" }], confirmed: false },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "socialAccounts" });
  const acquisitionSource = watch("acquisitionSource");

  const handleSearch = (query: string) => {
    navigate(query ? `/?q=${encodeURIComponent(query)}` : "/");
  };

  const onSubmit = async (formData: FormData) => {
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
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Header onSearch={handleSearch} />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 mt-6">
          {/* Hero banner — image campaign banner (desktop 21:9, mobile 4:5) */}
          <section className="relative rounded-3xl overflow-hidden">
            {/* Desktop crop */}
            <div className="relative hidden md:block aspect-[21/9]">
              {HERO_IMAGES_DESKTOP.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt="BITE ME plush toys and accessories"
                  className={`absolute inset-0 h-full w-full object-cover object-[70%_center] transition-opacity duration-[900ms] ease-in-out ${
                    i === heroIndex ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
              <div className="relative h-full flex flex-col items-start justify-center gap-3 px-16 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-1.5 text-sm font-semibold text-orange-600">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                  Affiliate Collab
                </span>
                <h1 className="text-5xl font-bold text-stone-800 leading-tight">
                  Share Bite Me
                  <br />
                  earn together
                </h1>
                <p className="text-lg text-stone-600">
                  Share your BITE ME favorites and earn with every sale!
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                  <ArrowDown className="h-4 w-4" />
                  Scroll down and submit your application to join!
                </p>
              </div>
            </div>

            {/* Mobile crop */}
            <div className="relative md:hidden aspect-[4/5]">
              {HERO_IMAGES_MOBILE.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt="BITE ME plush toys and accessories"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms] ease-in-out ${
                    i === heroIndex ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
              <div className="relative h-full flex flex-col items-start justify-end gap-2 px-5 pb-8">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-orange-600 shadow-sm">
                  <Sparkles className="h-4 w-4" strokeWidth={2} />
                  Affiliate Collab
                </span>
                <h1 className="text-3xl font-extrabold uppercase text-stone-900 leading-[1.1] whitespace-nowrap">
                  Share Bite Me
                  <br />
                  Earn Together!
                </h1>
                <p className="inline-flex items-center gap-1 text-sm font-bold text-orange-600">
                  <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                  Scroll down to join!
                </p>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="mt-14 md:mt-20">
            <h2 className="text-lg md:text-2xl font-bold text-foreground text-center mb-2">How it works</h2>
            <p className="text-sm text-muted-foreground text-center mb-6 md:mb-8">
              Join in just a few simple steps!
            </p>

            {/* Desktop: row with connecting arrows */}
            <div className="hidden md:flex items-stretch gap-4">
              {STEPS.map(({ icon: Icon, title, desc }, index) => (
                <div key={title} className="flex items-stretch flex-1 gap-4">
                  <div className="flex flex-col items-center text-center gap-3 flex-1 rounded-2xl bg-orange-100 shadow-sm py-10 px-4">
                    <Icon className="h-9 w-9 text-orange-500" strokeWidth={1.75} />
                    <p className="text-base font-extrabold text-foreground">{title}</p>
                    <p className="text-sm text-gray-600 leading-snug">{desc}</p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <ArrowRight className="h-6 w-6 text-orange-500 self-center shrink-0" strokeWidth={2} />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile: stacked with connecting arrows */}
            <div className="md:hidden flex flex-col items-center gap-2">
              {STEPS.map(({ icon: Icon, title, desc }, index) => (
                <div key={title} className="w-full flex flex-col items-center">
                  <div className="w-full flex flex-col items-center text-center gap-2 rounded-xl bg-orange-100 shadow-sm py-5 px-4">
                    <Icon className="h-6 w-6 text-orange-500" strokeWidth={1.75} />
                    <p className="text-sm font-extrabold text-foreground">{title}</p>
                    <p className="text-xs text-gray-600 leading-snug">{desc}</p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <ArrowDown className="h-5 w-5 text-orange-500 my-1 shrink-0" strokeWidth={2} />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Partner benefits */}
          <section className="mt-14 md:mt-20">
            <h2 className="text-lg md:text-2xl font-bold text-foreground text-center mb-2">Earn More with BITE ME</h2>
            <p className="text-sm text-muted-foreground text-center mb-6 md:mb-8">
              The more you share, the more you can earn!
            </p>

            {/* Desktop: same card size as How it works, filled with the benefit's accent color */}
            <div className="hidden md:flex items-stretch gap-4">
              {BENEFITS.map(({ icon: Icon, value, bgClass, accentClass, title, desc }) => (
                <div
                  key={title}
                  className={`flex flex-col items-center text-center flex-1 rounded-2xl py-10 px-4 ${bgClass}`}
                >
                  <div className="h-12 flex items-center justify-center">
                    {value ? (
                      <p className={`text-[34px] font-extrabold leading-none ${accentClass}`}>{value}</p>
                    ) : (
                      Icon && <Icon className={`h-9 w-9 ${accentClass}`} strokeWidth={1.75} />
                    )}
                  </div>
                  <p className="mt-3 text-base font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-snug">{desc}</p>
                </div>
              ))}
            </div>

            {/* Mobile: 2-column grid, same filled-card style at a smaller size */}
            <div className="grid grid-cols-2 gap-4 md:hidden">
              {BENEFITS.map(({ icon: Icon, value, bgClass, accentClass, title, desc }) => (
                <div
                  key={title}
                  className={`flex flex-col items-center text-center rounded-xl py-5 px-4 ${bgClass}`}
                >
                  <div className="h-9 flex items-center justify-center">
                    {value ? (
                      <p className={`text-2xl font-extrabold leading-none ${accentClass}`}>{value}</p>
                    ) : (
                      Icon && <Icon className={`h-6 w-6 ${accentClass}`} strokeWidth={1.75} />
                    )}
                  </div>
                  <p className="mt-2 text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">{desc}</p>
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
                  Enter your social accounts, email, and pet's name.
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-3">
                    <div className="hidden md:grid md:grid-cols-[200px_1fr] gap-4">
                      <Label className="font-semibold">Social Media Platform</Label>
                      <Label className="font-semibold">Account</Label>
                    </div>

                    {fields.map((field, index) => (
                      <div key={field.id} className="flex flex-col md:flex-row gap-2 md:gap-4 md:items-start">
                        <div className="md:w-[200px] shrink-0 space-y-2">
                          <Label className="font-semibold md:hidden inline-flex items-center gap-1">
                            <Smartphone className="h-3.5 w-3.5 text-orange-500" strokeWidth={2} />
                            Social Media Platform
                          </Label>
                          <Controller
                            name={`socialAccounts.${index}.platform`}
                            control={control}
                            render={({ field: platformField }) => (
                              <Select value={platformField.value} onValueChange={platformField.onChange}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SOCIAL_PLATFORMS.map((platform) => (
                                    <SelectItem key={platform} value={platform}>
                                      {platform}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>

                        <div className="flex-1 flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <Label className="font-semibold md:hidden inline-flex items-center gap-1">
                              <AtSign className="h-3.5 w-3.5 text-orange-500" strokeWidth={2} />
                              Account
                            </Label>
                            <Input
                              placeholder="@your_account"
                              {...register(`socialAccounts.${index}.account`)}
                            />
                            {errors.socialAccounts?.[index]?.account && (
                              <p className="text-xs text-destructive">
                                {errors.socialAccounts[index]?.account?.message}
                              </p>
                            )}
                          </div>
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="h-10 mt-0 md:mt-8 px-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            >
                              <X className="h-3.5 w-3.5" /> Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => append({ platform: "Instagram", account: "" })}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                    >
                      <Plus className="h-4 w-4" /> Add another account
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="font-semibold inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-orange-500 md:hidden" strokeWidth={2} />
                        Email address
                      </Label>
                      <Input placeholder="example@email.com" {...register("email")} />
                      {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="font-semibold inline-flex items-center gap-1">
                        <PawPrint className="h-3.5 w-3.5 text-orange-500 md:hidden" strokeWidth={2} />
                        Pet's Name
                      </Label>
                      <Input placeholder="coco" {...register("petName")} />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Your pet's name will be used to create your unique discount code (e.g. COCO15).
                      </p>
                      {errors.petName && <p className="text-xs text-destructive">{errors.petName.message}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="font-semibold inline-flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5 text-orange-500 md:hidden" strokeWidth={2} />
                        Country / Region <span className="font-normal text-muted-foreground">(Optional)</span>
                      </Label>
                      <Controller
                        name="country"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {COUNTRIES.map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-semibold inline-flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-orange-500 md:hidden" strokeWidth={2} />
                        How did you hear about us?{" "}
                        <span className="font-normal text-muted-foreground">(Optional)</span>
                      </Label>
                      <Controller
                        name="acquisitionSource"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {ACQUISITION_SOURCES.map((source) => (
                                <SelectItem key={source} value={source}>
                                  {source}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {acquisitionSource === "Other" && (
                        <Input placeholder="Tell us how you heard about us" {...register("acquisitionOther")} />
                      )}
                    </div>
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
                        I understand that my followers will receive 15% off with my code, and I will earn a
                        10% commission on eligible sales.
                      </Label>
                    </div>
                    {errors.confirmed && <p className="text-xs text-destructive">{errors.confirmed.message}</p>}
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100">
                      <Mail className="h-4 w-4 text-orange-600" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">What happens next?</p>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        You'll receive an affiliate invitation email the following day. Follow the
                        instructions in the email to join and create your unique affiliate link.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={submitting} size="sm" className="font-semibold px-6">
                      {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Join the Program
                    </Button>
                  </div>
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
