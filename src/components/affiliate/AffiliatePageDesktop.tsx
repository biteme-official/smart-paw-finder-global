import { Controller } from "react-hook-form";
import {
  ArrowRight,
  ArrowDown,
  Loader2,
  Plus,
  X,
  Sparkles,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import heroBanner from "@/assets/affiliate-hero-banner.jpg";
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

export function AffiliatePageDesktop({ apply }: Props) {
  const { form, socialAccounts, submitting, onSubmit } = apply;
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;
  const { fields, append, remove } = socialAccounts;
  const acquisitionSource = watch("acquisitionSource");

  // NOTE: 이 브랜치는 PC(데스크톱) 구현만 포함한다. 모바일 전용 레이아웃
  // (AffiliatePageMobile)과 `hidden md:block` / `md:hidden` 뷰포트 분기는
  // 별도 브랜치·PR에서 추가한다 (#108 후속). 그때까지 모바일에서는 이
  // 데스크톱 레이아웃이 그대로 노출된다.
  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      {/* Hero banner — 21:9 image campaign banner */}
      <section className="relative rounded-3xl overflow-hidden">
        <div className="relative aspect-[21/9]">
          <img
            src={heroBanner}
            alt="BITE ME plush toys and accessories"
            className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
          />
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
      </section>

      {/* How it works */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">How it works</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">Join in just a few simple steps!</p>

        <div className="flex items-stretch gap-4">
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
      </section>

      {/* Partner benefits */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">Earn More with BITE ME</h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          The more you share, the more you can earn!
        </p>

        <div className="flex items-stretch gap-4">
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
      </section>

      {/* Apply now */}
      <section className="mt-20 mb-16">
        <div className="rounded-3xl bg-muted px-10 py-10">
          <h2 className="text-2xl font-bold text-foreground mb-1">Apply now</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Enter your social accounts, email, and pet's name.
          </p>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-3">
              <div className="grid grid-cols-[200px_1fr] gap-4">
                <Label className="font-semibold">Social Media Platform</Label>
                <Label className="font-semibold">Account</Label>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-row gap-4 items-start">
                  <div className="w-[200px] shrink-0">
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
                    <div className="flex-1">
                      <Input
                        placeholder="@your_account"
                        className={errors.socialAccounts?.[index]?.account ? "border-destructive" : undefined}
                        {...register(`socialAccounts.${index}.account`)}
                      />
                    </div>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="h-10 px-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
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

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-semibold">Email address</Label>
                <Input
                  placeholder="example@email.com"
                  className={errors.email ? "border-destructive" : undefined}
                  {...register("email")}
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Pet's Name</Label>
                <Input
                  placeholder="coco"
                  className={errors.petName ? "border-destructive" : undefined}
                  {...register("petName")}
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your pet's name will be used to create your unique discount code (e.g. COCO15).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-semibold inline-flex items-center gap-1">
                  Country / Region
                  <span className="font-normal text-muted-foreground">(Optional)</span>
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
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Affiliate Program is currently unavailable in China, Taiwan, Malaysia, and the
                  Philippines due to local distribution partnerships.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold inline-flex items-center gap-1">
                  How did you hear about us?
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

            <div className="flex items-start gap-2">
              <Controller
                name="confirmed"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="confirmed-desktop"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={`mt-0.5 ${errors.confirmed ? "border-destructive" : ""}`}
                  />
                )}
              />
              <Label htmlFor="confirmed-desktop" className="font-normal text-sm text-foreground leading-snug">
                I understand that my followers will receive 15% off with my code, and I will earn a
                10% commission on eligible sales.
              </Label>
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
      </section>
    </div>
  );
}
