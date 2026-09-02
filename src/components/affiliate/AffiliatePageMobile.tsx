import { Controller } from "react-hook-form";
import {
  ArrowDown,
  Loader2,
  Plus,
  X,
  Sparkles,
  Mail,
  Smartphone,
  AtSign,
  PawPrint,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

// 모바일 전용 레이아웃. 공용 폼 상태(useAffiliateApply)는 Affiliate 셸이
// 소유하고 이 컴포넌트는 프레젠테이션만 담당한다 — 데스크톱과 동일한
// 단일 신청 플로우를 렌더한다.
export function AffiliatePageMobile({ apply }: Props) {
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
    <div className="mx-auto mt-6 max-w-lg px-4">
      {/* Hero banner — 4:5 세로 크롭, 텍스트는 이미지 위 하단에 직접 배치 */}
      <section className="relative overflow-hidden rounded-3xl">
        <div className="relative aspect-[4/5]">
          <img
            src={heroBannerMobile}
            alt="BITE ME plush toys and accessories"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="relative flex h-full flex-col items-start justify-end gap-2 px-5 pb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-orange-600 shadow-sm">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
              Affiliate Collab
            </span>
            <h1 className="text-3xl font-extrabold uppercase leading-[1.1] text-stone-900">
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

      {/* How it works — 세로 스택, 화살표는 아래 방향 */}
      <section className="mt-14">
        <h2 className="mb-2 text-center text-lg font-bold text-foreground">How it works</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">Join in just a few simple steps!</p>

        <div className="flex flex-col items-center gap-2">
          {STEPS.map(({ icon: Icon, title, desc }, index) => (
            <div key={title} className="flex w-full flex-col items-center">
              <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-orange-100 px-4 py-5 text-center shadow-sm">
                <Icon className="h-6 w-6 text-orange-500" strokeWidth={1.75} />
                <p className="text-sm font-extrabold text-foreground">{title}</p>
                <p className="text-xs leading-snug text-gray-600">{desc}</p>
              </div>
              {index < STEPS.length - 1 && (
                <ArrowDown className="my-1 h-5 w-5 shrink-0 text-orange-500" strokeWidth={2} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Partner benefits — 2열 그리드 */}
      <section className="mt-14">
        <h2 className="mb-2 text-center text-lg font-bold text-foreground">Earn More with BITE ME</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          The more you share, the more you can earn!
        </p>

        <div className="grid grid-cols-2 gap-4">
          {BENEFITS.map(({ icon: Icon, value, bgClass, accentClass, title, desc }) => (
            <div
              key={title}
              className={`flex flex-col items-center rounded-xl px-4 py-5 text-center ${bgClass}`}
            >
              <div className="flex h-9 items-center justify-center">
                {value ? (
                  <p className={`text-2xl font-extrabold leading-none ${accentClass}`}>{value}</p>
                ) : (
                  Icon && <Icon className={`h-6 w-6 ${accentClass}`} strokeWidth={1.75} />
                )}
              </div>
              <p className="mt-2 text-sm font-bold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Apply now — 필드 세로 스택, 라벨에 line icon */}
      <section className="mb-16 mt-14">
        <div className="rounded-3xl bg-muted px-6 py-8">
          <h2 className="mb-1 text-lg font-bold text-foreground">Apply now</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Enter your social accounts, email, and pet's name.
          </p>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col gap-2">
                  <div className="space-y-2">
                    <Label className="inline-flex items-center gap-1 font-semibold">
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

                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Label className="inline-flex items-center gap-1 font-semibold">
                        <AtSign className="h-3.5 w-3.5 text-orange-500" strokeWidth={2} />
                        Account
                      </Label>
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
                        className="mt-8 flex h-10 shrink-0 items-center gap-1 px-2 text-xs text-muted-foreground transition-colors hover:text-destructive"
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

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1 font-semibold">
                <Mail className="h-3.5 w-3.5 text-orange-500" strokeWidth={2} />
                Email address
              </Label>
              <Input
                placeholder="example@email.com"
                className={errors.email ? "border-destructive" : undefined}
                {...register("email")}
              />
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1 font-semibold">
                <PawPrint className="h-3.5 w-3.5 text-orange-500" strokeWidth={2} />
                Pet's Name
              </Label>
              <Input
                placeholder="coco"
                className={errors.petName ? "border-destructive" : undefined}
                {...register("petName")}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Your pet's name will be used to create your unique discount code (e.g. COCO15).
              </p>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1 font-semibold">
                <Globe className="h-3.5 w-3.5 text-orange-500" strokeWidth={2} />
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
              <p className="text-xs leading-relaxed text-muted-foreground">
                Affiliate Program is currently unavailable in China, Taiwan, Malaysia, and the
                Philippines due to local distribution partnerships.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1 font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-orange-500" strokeWidth={2} />
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

            <div className="flex items-start gap-2">
              <Controller
                name="confirmed"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="confirmed-mobile"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={`mt-0.5 ${errors.confirmed ? "border-destructive" : ""}`}
                  />
                )}
              />
              <Label htmlFor="confirmed-mobile" className="text-sm font-normal leading-snug text-foreground">
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
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  You'll receive an affiliate invitation email the following day. Follow the
                  instructions in the email to join and create your unique affiliate link.
                </p>
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full font-semibold">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join the Program
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
