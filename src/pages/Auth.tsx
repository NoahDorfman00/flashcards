import React, { useState } from 'react';
import { Box, Button, TextField, Typography, CircularProgress, Alert, Divider, Link as MuiLink } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import { LogoMark } from '../components/Logo';
import { brand } from '../theme';

const GoogleIcon: React.FC = () => (
    <Box component="svg" viewBox="0 0 48 48" sx={{ width: 18, height: 18 }} aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Box>
);

const Auth: React.FC = () => {
    const { login, signup, loginWithGoogle, user, loading } = useAuth();
    const [searchParams] = useSearchParams();
    const [isSignup, setIsSignup] = useState(searchParams.get('mode') === 'signup');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    React.useEffect(() => {
        setIsSignup(searchParams.get('mode') === 'signup');
    }, [searchParams]);

    React.useEffect(() => {
        if (user) navigate('/');
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            if (isSignup) {
                await signup(email, password);
            } else {
                await login(email, password);
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogle = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await loginWithGoogle();
        } catch (err: any) {
            setError(err.message || 'Google sign-in failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: 420, mx: 'auto', pt: { xs: 1, sm: 4 } }}>
            <Paper
                variant="outlined"
                sx={{ p: { xs: 3, sm: 4 }, boxShadow: `0 1px 2px ${alpha(brand.ink, 0.04)}, 0 12px 40px ${alpha(brand.greenDark, 0.08)}` }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', mb: 3 }}>
                    <LogoMark size={48} />
                    <Typography variant="h5" component="h1" sx={{ mt: 2 }}>
                        {isSignup ? 'Create your account' : 'Welcome back'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        {isSignup ? 'Your first flashcard deck is free.' : 'Log in to keep studying.'}
                    </Typography>
                </Box>

                <Button
                    variant="outlined"
                    color="inherit"
                    size="large"
                    fullWidth
                    onClick={handleGoogle}
                    disabled={submitting || loading}
                    startIcon={<GoogleIcon />}
                    sx={{ bgcolor: '#fff' }}
                >
                    Continue with Google
                </Button>

                <Divider sx={{ my: 3, color: 'text.secondary', fontSize: 13 }}>or</Divider>

                <form onSubmit={handleSubmit}>
                    <TextField
                        label="Email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        fullWidth
                        required
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        label="Password"
                        type="password"
                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        fullWidth
                        required
                    />
                    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                    <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        fullWidth
                        sx={{ mt: 3 }}
                        disabled={submitting || loading}
                    >
                        {submitting ? <CircularProgress size={22} color="inherit" /> : isSignup ? 'Create account' : 'Log in'}
                    </Button>
                </form>
            </Paper>

            <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', mt: 3 }}>
                {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                <MuiLink
                    component="button"
                    type="button"
                    onClick={() => { setIsSignup(s => !s); setError(null); }}
                    disabled={submitting || loading}
                    sx={{ fontWeight: 700, verticalAlign: 'baseline', fontSize: 'inherit' }}
                >
                    {isSignup ? 'Log in' : 'Sign up'}
                </MuiLink>
            </Typography>
        </Box>
    );
};

export default Auth;
