import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, Mail, PawPrint } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  updateEmailMarketingConsent, updatePetProfile, EmailMarketingState, PetType,
} from '@/lib/customer-account';

// Set by AuthCallback when a new customer is not subscribed or has no pet info yet.
const PET_PROMPT_SESSION_KEY = 'pet_profile_prompt';
// Set instead of the prompt when the new customer lands on My Page, which highlights its consent card.
const PET_HIGHLIGHT_SESSION_KEY = 'pet_profile_highlight';
// Customers created within this window before login count as a new sign-up.
const NEW_SIGNUP_WINDOW_MS = 10 * 60 * 1000;
// Fired after the prompt saves, so an open My Page can refresh its state.
export const PET_PROFILE_UPDATED_EVENT = 'pet-profile-updated';

export interface PetProfileUpdate {
  emailMarketingState?: EmailMarketingState;
  petType: PetType | null;
  petBirthday: string | null;
}

// Remembers customers who were already prompted (popup or highlight), so it only happens once per browser.
const PET_PROMPT_SEEN_PREFIX = 'pet_profile_prompt_seen:';

export interface PetPromptData {
  customerId: string;
  emailMarketingState: EmailMarketingState | null;
  petType: PetType | null;
  petBirthday: string | null;
}

export function isNewSignup(creationDate: string | null | undefined): boolean {
  const created = creationDate ? Date.parse(creationDate) : NaN;
  return !Number.isNaN(created) && Date.now() - created < NEW_SIGNUP_WINDOW_MS;
}

export function isMarketingSubscribed(state: EmailMarketingState | null): boolean {
  return state === 'SUBSCRIBED' || state === 'PENDING';
}

export function shouldPromptPetProfile(data: PetPromptData): boolean {
  const missingInfo = !isMarketingSubscribed(data.emailMarketingState) || (!data.petType && !data.petBirthday);
  if (!missingInfo) return false;
  try {
    return !localStorage.getItem(PET_PROMPT_SEEN_PREFIX + data.customerId);
  } catch {
    return false;
  }
}

export function requestPetProfilePrompt(data: PetPromptData, returnTo: string) {
  try {
    // My Page already shows the same form, so highlight it there instead of opening the prompt.
    if (returnTo === '/mypage') {
      sessionStorage.setItem(PET_HIGHLIGHT_SESSION_KEY, data.customerId);
    } else {
      sessionStorage.setItem(PET_PROMPT_SESSION_KEY, JSON.stringify(data));
    }
    localStorage.setItem(PET_PROMPT_SEEN_PREFIX + data.customerId, '1');
  } catch {
    // Storage unavailable: skip the prompt
  }
}

export function consumePetHighlight(customerId: string): boolean {
  try {
    if (sessionStorage.getItem(PET_HIGHLIGHT_SESSION_KEY) !== customerId) return false;
    sessionStorage.removeItem(PET_HIGHLIGHT_SESSION_KEY);
    return true;
  } catch {
    return false;
  }
}

function todayLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function PetFields({ petType, petBirthday, disabled, onTypeChange, onBirthdayChange }: {
  petType: PetType | null;
  petBirthday: string;
  disabled: boolean;
  onTypeChange: (next: PetType | null) => void;
  onBirthdayChange: (next: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <p className="text-sm">Pet type <span className="text-xs text-muted-foreground">(optional)</span></p>
        <div className="grid grid-cols-2 gap-2">
          {(['dog', 'cat'] as const).map((type) => (
            <Button
              key={type}
              type="button"
              variant={petType === type ? 'default' : 'outline'}
              onClick={() => onTypeChange(petType === type ? null : type)}
              disabled={disabled}
            >
              {type === 'dog' ? 'Dog' : 'Cat'}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="pet-birthday" className="text-sm block">
          Birthday or adoption day <span className="text-xs text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="pet-birthday"
          type="date"
          max={todayLocal()}
          value={petBirthday}
          onChange={(e) => onBirthdayChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </>
  );
}

// Pet info editor shown inside the marketing consent card on My Page.
export function PetProfileForm({ customerId, initialType, initialBirthday, onSaved }: {
  customerId: string;
  initialType: PetType | null;
  initialBirthday: string | null;
  onSaved: (pet: { petType: PetType | null; petBirthday: string | null }) => void;
}) {
  const [petType, setPetType] = useState<PetType | null>(initialType);
  const [petBirthday, setPetBirthday] = useState(initialBirthday || '');
  const [saving, setSaving] = useState(false);

  const unchanged = petType === initialType && (petBirthday || null) === initialBirthday;
  // Saved values can be changed but not cleared (metafieldsSet cannot write empty values).
  const cleared = (!!initialType && !petType) || (!!initialBirthday && !petBirthday);

  const handleSave = async () => {
    const pet = { petType, petBirthday: petBirthday || null };
    setSaving(true);
    try {
      await updatePetProfile(customerId, pet);
      toast.success('Pet info saved.', { position: 'top-center' });
      onSaved(pet);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save pet info. Please try again.', { position: 'top-center' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PawPrint className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm">Tell us about your pet for tailored offers.</p>
      </div>
      <PetFields
        petType={petType}
        petBirthday={petBirthday}
        disabled={saving}
        onTypeChange={setPetType}
        onBirthdayChange={setPetBirthday}
      />
      <Button
        type="button"
        onClick={handleSave}
        disabled={saving || unchanged || cleared || (!petType && !petBirthday)}
        className="w-full md:w-auto"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Save
      </Button>
    </div>
  );
}

// Shown once right after sign-up (outside My Page) when the customer is not subscribed or has no pet info yet.
export function PetProfilePrompt() {
  const location = useLocation();
  const [data, setData] = useState<PetPromptData | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [petType, setPetType] = useState<PetType | null>(null);
  const [petBirthday, setPetBirthday] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (location.pathname === '/auth/callback') return;
    try {
      const raw = sessionStorage.getItem(PET_PROMPT_SESSION_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PET_PROMPT_SESSION_KEY);
      const next = JSON.parse(raw) as PetPromptData;
      setData(next);
      setSubscribed(isMarketingSubscribed(next.emailMarketingState));
      setPetType(next.petType);
      setPetBirthday(next.petBirthday || '');
    } catch {
      // Storage unavailable or malformed: skip the prompt
    }
  }, [location.pathname]);

  const close = () => setData(null);

  if (!data) return null;

  const initiallySubscribed = isMarketingSubscribed(data.emailMarketingState);
  const petChanged = petType !== data.petType || (petBirthday || null) !== data.petBirthday;
  const consentChanged = subscribed !== initiallySubscribed;
  const cleared = (!!data.petType && !petType) || (!!data.petBirthday && !petBirthday);

  // Entering pet info switches marketing consent on; the customer can still turn it off before saving.
  const handleTypeChange = (next: PetType | null) => {
    setPetType(next);
    if (next) setSubscribed(true);
  };
  const handleBirthdayChange = (next: string) => {
    setPetBirthday(next);
    if (next) setSubscribed(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const update: PetProfileUpdate = { petType: data.petType, petBirthday: data.petBirthday };
      if (consentChanged) update.emailMarketingState = await updateEmailMarketingConsent(subscribed);
      if (petChanged && !cleared) {
        await updatePetProfile(data.customerId, { petType, petBirthday: petBirthday || null });
        update.petType = petType;
        update.petBirthday = petBirthday || null;
      }
      window.dispatchEvent(new CustomEvent<PetProfileUpdate>(PET_PROFILE_UPDATED_EVENT, { detail: update }));
      toast.success('Saved. Thank you!', { position: 'top-center' });
      close();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save. Please try again.', { position: 'top-center' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) close(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PawPrint className="h-5 w-5" />
            Tell us about your pet
          </DialogTitle>
          <DialogDescription>
            Get product recommendations and offers made for your pet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm">Marketing Emails</p>
                <p className="text-xs text-muted-foreground">News, new arrivals and special offers.</p>
              </div>
            </div>
            <Switch
              checked={subscribed}
              disabled={saving}
              onCheckedChange={setSubscribed}
              aria-label="Marketing email consent"
            />
          </div>
          <PetFields
            petType={petType}
            petBirthday={petBirthday}
            disabled={saving}
            onTypeChange={handleTypeChange}
            onBirthdayChange={handleBirthdayChange}
          />
          <div className="flex flex-col-reverse md:flex-row gap-2 md:justify-end">
            <Button type="button" variant="ghost" onClick={close} disabled={saving} className="w-full md:w-auto">
              Maybe later
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || (!consentChanged && (!petChanged || cleared))}
              className="w-full md:w-auto"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
