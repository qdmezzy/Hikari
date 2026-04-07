'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import client from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Mail, Lock, Eye, EyeOff } from 'lucide-react';

const PENDING_OAUTH_LINK_KEY = 'hikari:auth:pending-oauth-link';

const isExistingAccountOauthError = (message = '') => {
    const text = String(message).toLowerCase();
    return (
        text.includes('already') ||
        text.includes('exists') ||
        text.includes('registered') ||
        text.includes('identity')
    );
};

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data, error: signInError } = await client.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                setError(signInError.message);
                setLoading(false);
                return;
            }

            const metadataUpdates = {
                oauth_password_set: true,
            };
            const currentHandle = data?.user?.user_metadata?.username || data?.user?.user_metadata?.handle;
            if (currentHandle) {
                metadataUpdates.oauth_setup_complete = true;
            }
            await client.auth.updateUser({ data: metadataUpdates });

            const pendingProvider =
                typeof window !== 'undefined' ? window.localStorage.getItem(PENDING_OAUTH_LINK_KEY) : null;
            if (pendingProvider === 'google' || pendingProvider === 'discord') {
                const { error: linkError } = await client.auth.linkIdentity({
                    provider: pendingProvider,
                    options: {
                        redirectTo: `${window.location.origin}/onboarding`,
                    },
                });
                if (linkError) {
                    setError(linkError.message || `Could not link ${pendingProvider}.`);
                    setLoading(false);
                    return;
                }
                return;
            }
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(PENDING_OAUTH_LINK_KEY);
            }

            router.push('/');
        } catch (err) {
            setError(err.message || 'An error occurred');
            setLoading(false);
        }
    };

    const handleOAuthSignIn = async (provider) => {
        setError('');
        setOauthLoading(provider);
        const redirectTo = `${window.location.origin}/onboarding`;

        const { error: oauthError } = await client.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo,
                ...(provider === 'google'
                    ? {
                          queryParams: {
                              access_type: 'offline',
                              prompt: 'consent',
                          },
                      }
                    : {}),
            },
        });

        if (oauthError) {
            if (isExistingAccountOauthError(oauthError.message)) {
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(PENDING_OAUTH_LINK_KEY, provider);
                }
                setError(
                    `This email already has an account. Sign in with email/password once, and we'll link ${provider} automatically.`,
                );
            } else {
                setError(oauthError.message || 'Could not start social sign in.');
            }
            setOauthLoading('');
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            {/* Background effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/15 rounded-full blur-[120px]" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <Link href="/" className="flex items-center justify-center gap-2 mb-8 group">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-xl blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <span className="text-3xl font-bold text-gradient">Hikari</span>
                </Link>

                <Card className="bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl overflow-hidden">
                    {/* Decorative top gradient */}
                    <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary" />

                    <CardHeader className="text-center pt-8 pb-4">
                        <CardTitle className="text-2xl">Welcome back</CardTitle>
                        <CardDescription>Sign in to continue your anime journey</CardDescription>
                    </CardHeader>

                    <CardContent className="pb-8">
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 h-12 bg-secondary/50 border-border/50 rounded-xl"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10 pr-10 h-12 bg-secondary/50 border-border/50 rounded-xl"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-base font-medium"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    "Sign In"
                                )}
                            </Button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border/50" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-3 text-muted-foreground">Or continue with</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl bg-transparent border-border/50 hover:bg-secondary/50"
                                type="button"
                                disabled={loading || Boolean(oauthLoading)}
                                onClick={() => handleOAuthSignIn('google')}
                            >
                                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                {oauthLoading === 'google' ? 'Connecting...' : 'Google'}
                            </Button>
                            <Button
                                variant="outline"
                                className="h-11 rounded-xl bg-transparent border-border/50 hover:bg-secondary/50"
                                type="button"
                                disabled={loading || Boolean(oauthLoading)}
                                onClick={() => handleOAuthSignIn('discord')}
                            >
                                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.317 4.3698A19.7913 19.7913 0 0 0 15.8857 3c-.1914.3289-.4133.771-.565 1.1167a18.2676 18.2676 0 0 0-5.6415 0c-.1517-.3457-.3783-.7878-.5717-1.1167a19.7363 19.7363 0 0 0-4.4337 1.3698C1.8693 8.3458.1103 12.2264.9961 16.0528A19.9352 19.9352 0 0 0 6.0586 18.555c.4056-.5552.7665-1.146.1078-1.758-.5535-.2098-1.0792-.4662-1.579-.7594.1326-.0972.2625-.1998.3886-.3029 3.0466 1.4306 6.3563 1.4306 9.3665 0 .1277.1045.2576.2071.3902.3029-.4998.2932-1.0271.5496-1.5822.7594.463.6119.8239 1.2027 1.228 1.758a19.886 19.886 0 0 0 5.0641-2.5022c1.0385-4.4358-1.7721-8.281-4.1241-11.683zM8.02 13.33c-.9366 0-1.701-0.8474-1.701-1.885 0-1.0376.7499-1.885 1.701-1.885.9594 0 1.7166.8552 1.701 1.885 0 1.0376-.7499 1.885-1.701 1.885zm7.96 0c-.9366 0-1.701-0.8474-1.701-1.885 0-1.0376.7499-1.885 1.701-1.885.9594 0 1.7166.8552 1.701 1.885 0 1.0376-.7416 1.885-1.701 1.885z" />
                                </svg>
                                {oauthLoading === 'discord' ? 'Connecting...' : 'Discord'}
                            </Button>
                        </div>

                        <p className="text-center text-sm text-muted-foreground mt-6">
                            Don't have an account?{" "}
                            <Link href="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
                                Sign up
                            </Link>
                        </p>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-muted-foreground mt-6">
                    By signing in, you agree to our{" "}
                    <Link href="/terms" className="text-primary hover:underline">
                        Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                        Privacy Policy
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
