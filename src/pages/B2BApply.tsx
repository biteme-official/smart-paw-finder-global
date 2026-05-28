import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileText, X, Loader2, ArrowLeft, CheckCircle, Clock, XCircle, LogIn, UserPlus, FileUp, ShieldCheck, Tag } from 'lucide-react';
import { isLoggedIn as isCustomerLoggedIn, initiateLogin } from '@/lib/customer-auth';
import { fetchCustomerAccount, type CustomerAccountProfile } from '@/lib/customer-account';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const STEPS: { icon: React.ElementType; label: string; desc: string; note?: string }[] = [
  { icon: UserPlus, label: 'Sign Up', desc: 'Create an account with your business email.' },
  { icon: FileUp, label: 'Submit B2B Business Verification', desc: 'Submit your business information and required documents for verification.' },
  { icon: ShieldCheck, label: 'Admin Approval', desc: 'Our team reviews your submission and approves your B2B access.', note: 'Usually takes 2–3 business days.' },
  { icon: LogIn, label: 'Log In', desc: 'Log in to your approved account.' },
  { icon: Tag, label: 'B2B Prices Displayed', desc: 'Enjoy B2B pricing exclusively on eligible products.' },
];

function HowToSteps({ children }: { children?: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          How to sign up for B2B
        </h2>
        <p className="text-muted-foreground text-sm">
          Follow the steps below to unlock exclusive B2B pricing.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="relative flex flex-col items-center text-center">
              {i < STEPS.length - 1 && (
                <div className="hidden lg:flex absolute right-0 top-10 translate-x-1/2 z-10 text-primary">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <div className="w-full border border-border rounded-2xl p-5 bg-card hover:shadow-sm transition-shadow flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <p className="font-semibold text-sm text-foreground leading-tight">{step.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                {step.note && <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{step.note}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {children}
    </section>
  );
}

const schema = z.object({
  representativeName: z.string().min(1, 'Representative name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  address: z.string().min(1, 'Address is required'),
  companyName: z.string().min(1, 'Company name is required'),
});

type FormData = z.infer<typeof schema>;

function LoginRequired() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <HowToSteps>
          <div className="flex flex-col items-center gap-3 mt-8">
            <Button onClick={handleLogin} disabled={loginLoading} className="w-full max-w-sm h-12 text-base font-semibold">
              {loginLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sign Up to Continue
            </Button>
            <Button variant="outline" onClick={() => navigate('/mypage')} className="w-full max-w-sm h-12 text-base">
              Go to My Page
            </Button>
          </div>
        </HowToSteps>
      </main>
    </div>
  );
}

function StatusCard({ status, rejectionReason }: { status: 'pending' | 'approved' | 'rejected'; rejectionReason?: string | null }) {
  const navigate = useNavigate();
  const config = {
    pending: { icon: Clock, color: 'bg-yellow-50', iconColor: 'text-yellow-500', title: 'Application Under Review', desc: 'Your B2B application has been submitted and is currently being reviewed. We will notify you once approved.' },
    approved: { icon: CheckCircle, color: 'bg-green-50', iconColor: 'text-green-500', title: 'B2B Approved', desc: 'Your B2B account has been approved. You can now access wholesale pricing.' },
    rejected: { icon: XCircle, color: 'bg-red-50', iconColor: 'text-red-500', title: 'Application Rejected', desc: 'Unfortunately, your B2B application has been rejected.' },
  }[status];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-md mx-auto px-4 py-16 flex flex-col items-center text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${config.color}`}>
          <Icon className={`h-10 w-10 ${config.iconColor}`} />
        </div>
        <h1 className="text-xl font-bold mb-2">{config.title}</h1>
        <p className="text-sm text-muted-foreground mb-4">{config.desc}</p>

        {status === 'rejected' && rejectionReason && (
          <div className="w-full bg-red-50 border border-red-200 rounded-lg p-4 mb-8 text-left">
            <p className="text-xs font-semibold text-red-600 mb-1">Reason</p>
            <p className="text-sm text-red-800">{rejectionReason}</p>
          </div>
        )}

        {status !== 'rejected' && <div className="mb-4" />}

        <Button variant="outline" onClick={() => navigate('/mypage')} className="w-full h-12">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to My Page
        </Button>
      </main>
    </div>
  );
}

export default function B2BApply() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() => isCustomerLoggedIn());
  const [b2bStatus, setB2bStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CustomerAccountProfile | null>(null);
  const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!loggedIn) { setLoading(false); return; }
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
          fetch(`/api/b2b-status?email=${encodeURIComponent(data.emailAddress || '')}`),
        ]);

        const tagsData = await tagsRes.json();
        const tags: string[] = tagsData.tags || [];
        const statusData = await statusRes.json();

        if (tags.includes('B2B') || statusData.status === 'approved') {
          setB2bStatus('approved');
        } else if (statusData.status === 'rejected') {
          setB2bStatus('rejected');
          setRejectionReason(statusData.rejectionReason || null);
        } else if (tags.includes('B2B-pending') || statusData.status === 'pending') {
          setB2bStatus('pending');
        }
      } catch {
        toast.error('Failed to load account data.', { position: 'top-center' });
      } finally {
        setLoading(false);
      }
    })();
  }, [loggedIn]);

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
      const res = await fetch('/api/b2b-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: customerData?.emailAddress,
          ...formData,
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
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-md mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!loggedIn) return <LoginRequired />;

  if (b2bStatus !== 'none') {
    return <StatusCard status={b2bStatus} rejectionReason={rejectionReason} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
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

              <Button type="submit" disabled={submitting} className="w-full h-12 text-base font-semibold">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Submit Application
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>

        <HowToSteps />
      </main>
    </div>
  );
}
