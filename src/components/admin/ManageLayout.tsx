import { createContext, useCallback, useContext, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Shared admin session for every /manage/* tab. The key name is unchanged from
// the original B2B admin so existing sessions keep working.
const ADMIN_KEY_STORAGE = 'b2b-admin-key';

const MANAGE_TABS = [
  { to: '/manage/b2b', label: 'B2B' },
  { to: '/manage/affiliate', label: '어필리에이트' },
  { to: '/manage/international-shipping', label: '해외배송' },
];

interface ManageAuth {
  adminKey: string;
  logout: () => void;
}

const ManageAuthContext = createContext<ManageAuth | null>(null);

export function useManageAuth(): ManageAuth {
  const ctx = useContext(ManageAuthContext);
  if (!ctx) throw new Error('useManageAuth must be used inside ManageLayout');
  return ctx;
}

function LoginGate({ onLogin }: { onLogin: (key: string) => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/b2b-list', { headers: { 'x-admin-key': password } });
      if (res.ok) {
        sessionStorage.setItem(ADMIN_KEY_STORAGE, password);
        onLogin(password);
      } else {
        toast.error('Invalid password.', { position: 'top-center' });
      }
    } catch {
      toast.error('Connection error.', { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="password" placeholder="Enter admin password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoFocus />
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ManageLayout() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || '');

  const logout = useCallback(() => {
    setAdminKey('');
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  }, []);

  if (!adminKey) return <LoginGate onLogin={setAdminKey} />;

  return (
    <ManageAuthContext.Provider value={{ adminKey, logout }}>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b px-6 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {MANAGE_TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => cn(
                  'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            Logout
          </Button>
        </nav>
        <Outlet />
      </div>
    </ManageAuthContext.Provider>
  );
}

export function ManageComingSoon({ title }: { title: string }) {
  return (
    <main className="max-w-6xl mx-auto p-6">
      <Card>
        <CardContent className="py-16 text-center space-y-2">
          <p className="text-lg font-bold">{title}</p>
          <p className="text-sm text-muted-foreground">준비 중입니다.</p>
        </CardContent>
      </Card>
    </main>
  );
}
