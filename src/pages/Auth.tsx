import React, { useState } from 'react';
import { Box, Button, TextField, Typography, CircularProgress, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Auth: React.FC = () => {
    const { login, signup, loginWithGoogle, user, loading } = useAuth();
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

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
        <Box sx={{ maxWidth: 400, mx: 'auto', mt: 6, p: 3, boxShadow: 2, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom align="center">
                {isSignup ? 'Sign Up' : 'Log In'}
            </Typography>
            <form onSubmit={handleSubmit}>
                <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    fullWidth
                    margin="normal"
                    required
                />
                <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    fullWidth
                    margin="normal"
                    required
                />
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    sx={{ mt: 2 }}
                    disabled={submitting || loading}
                >
                    {submitting ? <CircularProgress size={24} /> : isSignup ? 'Sign Up' : 'Log In'}
                </Button>
            </form>
            <Button
                variant="outlined"
                color="secondary"
                fullWidth
                sx={{ mt: 2 }}
                onClick={handleGoogle}
                disabled={submitting || loading}
            >
                {submitting ? <CircularProgress size={24} /> : 'Sign in with Google'}
            </Button>
            <Button
                color="inherit"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => setIsSignup(s => !s)}
                disabled={submitting || loading}
            >
                {isSignup ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </Button>
        </Box>
    );
};

export default Auth; 