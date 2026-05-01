import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Map, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        if (!name.trim()) { setError('Name is required'); setLoading(false); return; }
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary mb-3">
            <Map className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">FiberTrack</h1>
          <p className="text-sm text-muted-foreground mt-1">ISP Joint Mapper</p>
        </div>

        <Card>
          {/* Tab-style header */}
          <CardHeader className="pb-0 pt-0 px-0">
            <div className="flex border-b border-border">
              <button
                type="button"
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors border-b-2',
                  !isRegister
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground',
                )}
                onClick={() => { setIsRegister(false); setError(''); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors border-b-2',
                  isRegister
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground',
                )}
                onClick={() => { setIsRegister(true); setError(''); }}
              >
                Register
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid gap-4">
              {isRegister && (
                <div className="grid gap-1.5">
                  <Label htmlFor="login-name">Full Name</Label>
                  <Input
                    id="login-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="h-9"
                    autoFocus={isRegister}
                  />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-9"
                  autoFocus={!isRegister}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-9">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {isRegister ? 'Creating account...' : 'Signing in...'}
                  </>
                ) : (
                  isRegister ? 'Create Account' : 'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          FiberTrack — Fiber Joint Mapping System
        </p>
      </div>
    </div>
  );
}
