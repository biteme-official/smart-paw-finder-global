import { Controller } from "react-hook-form";
import {
  ArrowRight,
  ArrowDown,
  Loader2,
  Plus,
  X,
  Sparkles,
  Mail,
  Smartphone,
  AtSign,
  Globe,
  PawPrint,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import heroBanner from "@/assets/affiliate-hero-banner.jpg";
import heroBannerMobile from "@/assets/affiliate-hero-banner-mobile.jpg";
import {
  SOCIAL_PLATFORMS,
  COUNTRIES,
  ACQUISITION_SOURCES,
  STEPS,
  BENEFITS,
} from "./affiliateData";
import type { AffiliateApply } from "./useAffiliateApply";

interface Props {
  apply: AffiliateApply;
}

/** Mobile-only leading icon for a form field label (hidden from md: up so PC layout is unchanged). */
function FieldIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="md:hidden h-4 w-4 shrink-0 text-orange-500" strokeWidth={2} />;
}

export function AffiliatePageContent({ apply }: Props) {
  const { form, socialAccounts, submitting, onSubmit } = apply;
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;
  const { fields, append, remove } = socialAccounts;
  const acquisitionSource = watch("acquisitionSource");

  return (
    <div className="max-w-7xl mx-auto px-4 mt-4 md:mt-6">
      {/* Hero banner — text overlaid on the image bottom (mobile 4:5) / center-left (desktop wide) */}
      <section className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-[#f4eede]">
        {/* Mobile uses a dedicated 4:5 image (subject pre-centered); desktop keeps the wide banner. */}
        <div className="aspect-[4/5] md:aspect-[21/9]">
          <picture>
            <source media="(min-width: 768px)" srcSet={heroBanner} />
            <img
              src={heroBannerMobile}
              alt="BITE ME plush toys and accessories"
              className="h-full w-full object-cover object-center md:object-[70%_center]"
            />
          </picture>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-6 pb-6 md:inset-0 md:flex md:flex-col md:items-start md:justify-center md:px-16 md:pb-0 md:max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs md:px-4 md:py-1.5 md:text-sm font-semibold text-orange-600">
            <Sparkles className="h-3 w-3 md:h-3.5 md:w-3.5" strokeWidth={2} />
            Affiliate Collab
          </span>
          <h1 className="mt-2 text-[32px] font-extrabold uppercase leading-[1.05] tracking-tight text-stone-800 md:text-5xl md:font-bold md:normal-case md:leading-[1.4] md:tracking-normal">
            <span className="md:hidden">
              Share Bite &amp;
              <br />
              Earn Together
            </span>
            <span className="hidden md:inline">
              Share Bite Me
              <br />
              earn together
            </span>
          </h1>
          <p className="mt-1 hidden max-w-[92%] text-sm text-stone-600 md:block md:max-w-none md:text-lg">
            Share your BITE ME favorites and earn with every sale!
          </p>
          <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-orange-600 md:gap-1.5 md:text-sm md:text-stone-700">
            <ArrowDown className="h-3 w-3 shrink-0 md:h-4 md:w-4" />
            <span className="md:hidden">Scroll down to join!</span>
            <span className="hidden md:inline">Scroll down and submit your application to join!</span>
          </p>
        </div>
      </section>

      {/* How it works — mobile: 2x2 compact grid (numbered); desktop: row with right arrows */}
      <section className="mt-8 md:mt-20">
        <h2 className="text-xl md:text-2xl font-bold text-foreground text-center mb-2">How it works</h2>
        <p className="text-xs md:text-sm text-muted-foreground text-center mb-4 md:mb-8">Join in just a few simple steps!</p>

        <div className="grid grid-cols-2 auto-rows-fr gap-3 md:flex md:items-stretch md:gap-4">
          {STEPS.map(({ icon: Icon, title, desc }, index) => (
            <div key={title} className="contents md:flex md:items-stretch md:flex-1 md:gap-4">
              <div className="relative flex h-full flex-col items-center justify-center text-center gap-1.5 md:gap-3 w-full md:flex-1 rounded-2xl bg-orange-100 shadow-sm py-4 px-3 md:py-10 md:px-4">
                <span className="absolute left-3 top-2.5 text-[11px] font-bold text-orange-400 md:hidden">{index + 1}</span>
                <Icon className="h-6 w-6 md:h-9 md:w-9 text-orange-500" strokeWidth={1.75} />
                <p className="text-sm md:text-base font-extrabold text-foreground">{title}</p>
                <p className="text-xs md:text-sm text-gray-600 leading-snug">{desc}</p>
              </div>
              {index < STEPS.length - 1 && (
                <ArrowRight className="hidden md:block h-6 w-6 text-orange-500 self-center shrink-0" strokeWidth={2} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Partner benefits — 2x2 on mobile with equal-height rows */}
      <section className="mt-10 md:mt-20">
        <h2 className="text-xl md:text-2xl font-bold text-foreground text-center mb-2">Earn More with BITE ME</h2>
        <p className="text-xs md:text-sm text-muted-foreground text-center mb-6 md:mb-8">
          The more you share, the more you can earn!
        </p>

        <div className="grid grid-cols-2 auto-rows-fr gap-3 md:flex md:items-stretch md:gap-4">
          {BENEFITS.map(({ icon: Icon, value, bgClass, accentClass, title, desc }) => (
            <div
              key={title}
              className={`flex h-full min-h-[190px] flex-col items-center text-center md:min-h-0 md:flex-1 rounded-2xl py-6 px-3 md:py-10 md:px-4 ${bgClass}`}
            >
              <div className="flex h-10 items-center justify-center md:h-12">
                {value ? (
                  <p className={`text-2xl md:text-[34px] font-extrabold leading-none ${accentClass}`}>{value}</p>
                ) : (
                  Icon && <Icon className={`h-7 w-7 md:h-9 md:w-9 ${accentClass}`} strokeWidth={1.75} />
                )}
              </div>
              <p className="mt-2 md:mt-3 text-sm md:text-base font-bold text-foreground">{title}</p>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Apply now */}
      <section className="mt-10 mb-10 md:mt-20 md:mb-16">
        <div className="rounded-2xl md:rounded-3xl bg-muted px-5 py-6 md:px-10 md:py-10">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">Apply now</h2>
          <p className="text-xs md:text-sm text-muted-foreground mb-5 md:mb-6">
            Enter your social accounts, email, and pet's name.
          </p>

          <form onSubmit={onSubmit} className="space-y-6">
            {/* Social accounts */}
            <div className="space-y-4">
              <div className="hidden md:grid grid-cols-[200px_1fr] gap-4">
                <Label className="font-semibold">Social Media Platform</Label>
                <Label className="font-semibold">Account</Label>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-start">
                  <div className="w-full md:w-[200px] md:shrink-0 space-y-2 md:space-y-0">
                    {index === 0 && (
                      <Label className="md:hidden font-semibold inline-flex items-center gap-1.5">
                        <FieldIcon icon={Smartphone} />
                        Social Media Platform
                      </Label>
                    )}
                    <Controller
                      name={`socialAccounts.${index}.platform`}
                      control={control}
                      render={({ field: platformField }) => (
                        <Select value={platformField.value} onValueChange={platformField.onChange}>
                          <SelectTrigger className="h-11 md:h-10">
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

                  <div className="flex-1 space-y-2 md:space-y-0">
                    {index === 0 && (
                      <Label className="md:hidden font-semibold inline-flex items-center gap-1.5">
                        <FieldIcon icon={AtSign} />
                        Account
                      </Label>
                    )}
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="@your_account"
                          className={`h-11 md:h-10 ${errors.socialAccounts?.[index]?.account ? "border-destructive" : ""}`}
                          {...register(`socialAccounts.${index}.account`)}
                        />
                      </div>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="h-11 md:h-10 px-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="h-3.5 w-3.5" /> Remove
                        </button>
                      )}
                    </div>
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

            {/* Email + Pet's Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-6">
              <div className="space-y-2">
                <Label className="font-semibold inline-flex items-center gap-1.5">
                  <FieldIcon icon={Mail} />
                  Email address
                </Label>
                <Input
                  placeholder="example@email.com"
                  className={`h-11 md:h-10 ${errors.email ? "border-destructive" : ""}`}
                  {...register("email")}
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold inline-flex items-center gap-1.5">
                  <FieldIcon icon={PawPrint} />
                  Pet's Name
                </Label>
                <Input
                  placeholder="coco"
                  className={`h-11 md:h-10 ${errors.petName ? "border-destructive" : ""}`}
                  {...register("petName")}
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your pet's name will be used to create your unique discount code (e.g. COCO15).
                </p>
              </div>
            </div>

            {/* Country + Acquisition */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-6">
              <div className="space-y-2">
                <Label className="font-semibold inline-flex items-center gap-1.5">
                  <FieldIcon icon={Globe} />
                  Country / Region
                </Label>
                <Controller
                  name="country"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={`h-11 md:h-10 ${errors.country ? "border-destructive" : ""}`}>
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
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Affiliate Program is currently unavailable in China, Taiwan, Malaysia, and the
                  Philippines due to local distribution partnerships.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold inline-flex items-center gap-1.5">
                  <FieldIcon icon={Sparkles} />
                  How did you hear about us?
                </Label>
                <Controller
                  name="acquisitionSource"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={`h-11 md:h-10 ${errors.acquisitionSource ? "border-destructive" : ""}`}>
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
                  <Input
                    placeholder="Tell us how you heard about us"
                    className={`h-11 md:h-10 ${errors.acquisitionOther ? "border-destructive" : ""}`}
                    {...register("acquisitionOther")}
                  />
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Controller
                name="confirmed"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="confirmed"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={`mt-0.5 ${errors.confirmed ? "border-destructive" : ""}`}
                  />
                )}
              />
              <Label htmlFor="confirmed" className="font-normal text-sm text-foreground leading-snug">
                I understand that my followers will receive 15% off with my code, and I will earn a
                10% commission on eligible sales.
              </Label>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 md:px-5 md:py-4">
              <span className="flex h-8 w-8 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-full bg-orange-100">
                <Mail className="h-4 w-4 text-orange-600" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">What happens next?</p>
                <p className="mt-1 text-xs md:text-sm text-muted-foreground leading-relaxed">
                  You'll receive an affiliate invitation email the following day. Follow the
                  instructions in the email to join and create your unique affiliate link.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 md:pt-1">
              <Button type="submit" disabled={submitting} size="sm" className="w-full md:w-auto font-semibold px-6">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Join the Program
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
