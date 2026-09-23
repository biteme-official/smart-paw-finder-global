import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileText, X, Loader2, ArrowLeft, ArrowRight, ChevronRight, BadgeCheck, Hourglass, XCircle, UserPlus, FileUp, ShieldCheck, Tag, ShoppingBag } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { initiateLogin, getAccessToken, refreshAccessToken } from '@/lib/customer-auth';
import { fetchCustomerAccount, type CustomerAccountProfile } from '@/lib/customer-account';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const STEPS: { icon: React.ElementType; label: string; desc: string }[] = [
  { icon: UserPlus, label: 'Create an Account', desc: 'Sign up with your business email.' },
  { icon: FileUp, label: 'Apply for B2B', desc: 'Submit your business information and required documents.' },
  { icon: ShieldCheck, label: 'Get Approved', desc: "We'll review your application within 2–3 business days." },
  { icon: ShoppingBag, label: 'Start Shopping', desc: 'Log in to view B2B prices and place your orders.' },
];

function HowToSteps() {
  return (
    <section className="mt-4 md:mt-8">
      <div className="flex flex-col md:flex-row md:items-stretch gap-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="flex items-center gap-4 md:contents">
              <div className="flex-1 border border-border p-5 bg-card hover:shadow-sm transition-shadow flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <p className="font-bold text-sm text-foreground uppercase leading-tight">{step.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="hidden md:block h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const schema = z.object({
  representativeName: z.string().min(1, 'Representative name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  address: z.string().min(1, 'Address is required'),
  companyName: z.string().min(1, 'Company name is required'),
  privacyConsent: z.literal(true, {
    errorMap: () => ({ message: 'You must agree before submitting your application.' }),
  }),
});

type FormData = z.infer<typeof schema>;

function LoginRequired() {
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      await initiateLogin('/mypage/b2b-apply');
    } catch {
      toast.error('Failed to start login.', { position: 'top-center' });
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1">
        <PageHeader
          title={<>START BITE ME<br />WHOLESALE</>}
          description={
            <>
              <span className="block">Create your account, submit your business details,</span>
              <span className="block">
                <span className="block md:inline">and get access to exclusive B2B pricing</span>{' '}
                <span className="block md:inline whitespace-nowrap">in just a few simple steps.</span>
              </span>
            </>
          }
        />

        <section>
        <PageContainer className="pb-9 md:pb-24">
          <HowToSteps />

          <div className="mt-10 bg-primary/10 p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center flex-shrink-0">
                <Tag className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground text-sm uppercase">Exclusive B2B Pricing</p>
                <p className="text-sm text-muted-foreground">Enjoy special wholesale prices and grow your business with BITE ME.</p>
              </div>
            </div>
            <div className="hidden md:block w-px self-stretch bg-border" />
            <div className="flex flex-col items-center gap-2">
              <Button
                onClick={handleLogin}
                disabled={loginLoading}
                className="h-12 px-8 rounded-full bg-foreground text-background hover:bg-foreground/90 font-semibold"
              >
                {loginLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Apply for B2B <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground">
                Already have a B2B account?{' '}
                <button type="button" onClick={handleLogin} className="underline hover:text-foreground">
                  Log in
                </button>
              </p>
            </div>
          </div>
        </PageContainer>
        </section>
      </main>
      <Footer />
    </div>
  );
}

type B2BStatus = 'pending' | 'approved' | 'rejected';

const STATUS_CONFIG: Record<B2BStatus, { icon: React.ElementType; circle: string; iconColor: string; title: string; desc: string }> = {
  approved: { icon: BadgeCheck, circle: 'bg-accent', iconColor: 'text-primary', title: 'Your B2B account is verified!', desc: 'You can now shop at wholesale prices.' },
  pending: { icon: Hourglass, circle: 'bg-muted', iconColor: 'text-foreground', title: 'Your application is under review', desc: 'Review usually takes 2–3 business days.' },
  rejected: { icon: XCircle, circle: 'bg-destructive/10', iconColor: 'text-destructive', title: "We couldn't approve your application", desc: 'Please check the reason below. If you have any questions, feel free to contact us.' },
};

function StatusCard({ status, rejectionReason }: { status: B2BStatus; rejectionReason?: string | null }) {
  const navigate = useNavigate();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="w-full max-w-md mx-auto px-4 py-6 pb-24 flex-1">
        <Button variant="ghost" onClick={() => navigate('/mypage')} className="mb-4 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> My Page
        </Button>

        <div className="bg-card rounded-xl border border-border px-5 py-8 md:px-8 md:py-10 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${config.circle}`}>
            <Icon className={`h-8 w-8 ${config.iconColor}`} />
          </div>
          <h1 className="text-lg md:text-xl font-bold mb-2">{config.title}</h1>
          <p className="text-sm text-muted-foreground mb-6">{config.desc}</p>

          {status === 'rejected' && rejectionReason && (
            <div className="w-full bg-destructive/5 border border-destructive/20 rounded-lg p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-destructive mb-1">Reason</p>
              <p className="text-sm text-foreground">{rejectionReason}</p>
            </div>
          )}

          {status === 'approved' ? (
            <Button onClick={() => navigate('/?collection=all')} className="w-full h-12 text-base font-semibold">
              Shop wholesale
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate('/mypage')} className="w-full h-12">
              Back to My Page
            </Button>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Need help?{' '}
            <Link to="/contact" className="text-primary underline underline-offset-2 hover:text-primary/80">
              Contact us
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function B2BApply() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Optimistic: an expired-but-refreshable access token would make isCustomerLoggedIn() report
  // false even though the user is still signed in, so the real check below always runs the
  // account fetch (which transparently refreshes the token) instead of gating on this synchronously.
  const [loggedIn, setLoggedIn] = useState(true);
  const [b2bStatus, setB2bStatus] = useState<'none' | B2BStatus>('none');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerAccountProfile | null>(null);
  const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null);

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchCustomerAccount();
        if (!data) { setLoggedIn(false); setLoading(false); return; }
        setCustomerData(data);

        const [tagsRes, statusRes] = await Promise.all([
          fetch('/api/customer-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: data.emailAddress }),
          }),
          fetch('/api/b2b-status', { headers: { Authorization: getAccessToken() || (await refreshAccessToken()) || '' } }),
        ]);

        const tagsData = await tagsRes.json();
        const tags: string[] = tagsData.tags || [];
        const statusData = await statusRes.json();

        const hasTag = (tag: string) => tags.some((t) => t.toUpperCase() === tag);

        // Verified follows the same `B2B` tag that unlocks wholesale pricing (see B2BDiscountSync),
        // so this page never says "verified" while prices are still retail.
        if (hasTag('B2B')) {
          setB2bStatus('approved');
        } else if (statusData.status === 'rejected') {
          setB2bStatus('rejected');
          setRejectionReason(statusData.rejectionReason || null);
        } else if (hasTag('B2B-PENDING') || statusData.status === 'pending' || statusData.status === 'approved') {
          // KV `approved` without the `B2B` tag means tagging failed on approval — pricing isn't live yet.
          setB2bStatus('pending');
        }
      } catch {
        toast.error('Failed to load account data.', { position: 'top-center' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      toast.error('Please upload an image (JPG, PNG, WebP) or PDF file.', { position: 'top-center' });
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('File size must be under 5MB.', { position: 'top-center' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setFile({ name: selected.name, type: selected.type, data: base64 });
    };
    reader.readAsDataURL(selected);
  };

  const onSubmit = async (formData: FormData) => {
    if (!file) {
      toast.error('Please upload a business registration document.', { position: 'top-center' });
      return;
    }
    setSubmitting(true);
    try {
      const { privacyConsent: _privacyConsent, ...applicationData } = formData;
      const res = await fetch('/api/b2b-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerData?.emailAddress,
          ...applicationData,
          document: file,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit application.', { position: 'top-center' });
        return;
      }
      toast.success('B2B application submitted successfully!', { position: 'top-center' });
      setB2bStatus('pending');
    } catch {
      toast.error('Network error. Please try again.', { position: 'top-center' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="max-w-md mx-auto px-4 py-16 flex justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!loggedIn) return <LoginRequired />;

  if (b2bStatus !== 'none') {
    return <StatusCard status={b2bStatus} rejectionReason={rejectionReason} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-10 flex-1">
        <Button variant="ghost" onClick={() => navigate('/mypage')} className="mb-4 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> My Page
        </Button>

        <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">B2B Application</CardTitle>
            <CardDescription>Fill in your business details to apply for a wholesale account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label className="font-semibold">Account Email</Label>
                <Input value={customerData?.emailAddress || ''} readOnly className="bg-muted" />
                <p className="text-xs text-muted-foreground">This is your registered account email.</p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Representative Name <span className="text-destructive">*</span></Label>
                <Input placeholder="John Doe" {...register('representativeName')} />
                {errors.representativeName && <p className="text-xs text-destructive">{errors.representativeName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Phone Number <span className="text-destructive">*</span></Label>
                <Input placeholder="+1 234-567-8900" {...register('phoneNumber')} />
                {errors.phoneNumber && <p className="text-xs text-destructive">{errors.phoneNumber.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Address <span className="text-destructive">*</span></Label>
                <Input placeholder="123 Main St, City, Country" {...register('address')} />
                {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Company Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Happy Paws Inc." {...register('companyName')} />
                {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Business Registration Document <span className="text-destructive">*</span></Label>
                {file ? (
                  <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/50">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-primary font-medium">Click to upload file</span>
                    <span className="text-xs text-muted-foreground">Image or PDF (max 5MB)</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileSelect} className="hidden" />
              </div>

              <div className="space-y-3 pt-1 border-t border-border">
                <div className="flex items-start gap-3 pt-4">
                  <Controller
                    name="privacyConsent"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="privacyConsent"
                        checked={field.value === true}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        className="mt-0.5 flex-shrink-0"
                      />
                    )}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="privacyConsent" className="text-sm font-normal leading-snug cursor-pointer">
                      I agree to Bite Me collecting and using my business and personal information to review
                      this wholesale application and manage my wholesale account.{' '}
                      <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      See our{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                        Privacy Policy
                      </a>{' '}
                      for how we handle your information.
                    </p>
                  </div>
                </div>
                {errors.privacyConsent && <p className="text-xs text-destructive">{errors.privacyConsent.message}</p>}
              </div>

              <Button type="submit" disabled={submitting} className="w-full h-12 text-base font-semibold">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Submit Application
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
