import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, Alert, CircularProgress, Collapse, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Avatar, Chip, ButtonBase } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link, useNavigate } from 'react-router-dom';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { brand } from '../theme';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, get } from 'firebase/database';
import { saveAnthropicKey } from '../services/anthropic';
import { loadStripe } from '@stripe/stripe-js';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

type SubscriptionStatus = 'subscribed' | 'pending_cancellation' | 'unsubscribed';

const Profile: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [anthropicKey, setAnthropicKey] = useState('');
    const [keyHint, setKeyHint] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('unsubscribed');
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        if (user) {
            setInitialLoading(true);
            // Load the saved key's hint (the key itself is stored encrypted and never sent to the browser)
            const hintRef = ref(database, `users/${user.uid}/anthropicKeyHint`);
            get(hintRef)
                .then((snapshot) => {
                    setKeyHint(snapshot.exists() ? snapshot.val() : null);
                })
                .catch(() => { });

            // Load subscription status
            const subRef = ref(database, `users/${user.uid}/subscriptionStatus`);
            get(subRef)
                .then((snapshot) => {
                    if (snapshot.exists()) {
                        setSubscriptionStatus(snapshot.val() as SubscriptionStatus);
                    } else {
                        setSubscriptionStatus('unsubscribed');
                    }
                })
                .catch(() => { })
                .finally(() => setInitialLoading(false));
        }
    }, [user]);

    const saveKey = async (key: string) => {
        if (!user) return;
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            const idToken = await user.getIdToken();
            const hint = await saveAnthropicKey(idToken, key);
            setKeyHint(hint);
            setAnthropicKey('');
            setSuccess(hint ? 'Key saved!' : 'Key removed.');
        } catch (err: any) {
            setError(err.message || 'Failed to save key.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        saveKey(anthropicKey);
    };

    const handleCheckout = async () => {
        if (!user) return;
        setCheckoutLoading(true);
        setError(null);
        try {
            const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
            if (!publishableKey) {
                throw new Error('Stripe publishable key is not configured');
            }

            // Get the current user's ID token
            console.log("Getting ID token for user:", {
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified,
                isAnonymous: user.isAnonymous,
            });

            // Force token refresh and get new token
            console.log("Starting token refresh process...");
            try {
                await user.getIdToken(true);
                console.log("Token refresh completed successfully");
            } catch (refreshError) {
                console.error("Token refresh failed:", refreshError);
                throw refreshError;
            }

            const idToken = await user.getIdToken();
            console.log("Got ID token:", {
                tokenLength: idToken.length,
                tokenPrefix: idToken.substring(0, 10) + '...',
                tokenParts: idToken.split('.').length, // Should be 3 for a valid JWT
                tokenExpiry: new Date(JSON.parse(atob(idToken.split('.')[1])).exp * 1000).toISOString(),
                currentTime: new Date().toISOString(),
            });

            // Call the createCheckoutSession function
            console.log("Making request to create checkout session...", {
                url: 'https://us-central1-flashcards-d25b9.cloudfunctions.net/createCheckoutSession',
                headers: {
                    'Authorization': `Bearer ${idToken.substring(0, 10)}...`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });
            const response = await fetch('https://us-central1-flashcards-d25b9.cloudfunctions.net/createCheckoutSession', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                mode: 'cors',
                credentials: 'include',
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error("Checkout session creation failed:", {
                    status: response.status,
                    statusText: response.statusText,
                    errorData,
                    headers: Object.fromEntries(response.headers.entries()),
                });
                throw new Error(`Failed to create checkout session: ${response.status} ${response.statusText} - ${errorData}`);
            }

            const { sessionId } = await response.json();
            console.log("Checkout session created successfully:", sessionId);

            // Initialize Stripe
            const stripe = await loadStripe(publishableKey);
            if (!stripe) {
                throw new Error('Failed to initialize Stripe');
            }

            // Redirect to Stripe Checkout
            const { error } = await stripe.redirectToCheckout({ sessionId });
            if (error) {
                throw error;
            }
        } catch (err: any) {
            console.error('Checkout error:', {
                error: err,
                message: err.message,
                stack: err.stack,
                user: user ? {
                    uid: user.uid,
                    email: user.email,
                    emailVerified: user.emailVerified,
                } : 'no user',
            });
            setError(err.message || 'Failed to start checkout process.');
        } finally {
            setCheckoutLoading(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!user) return;
        setCancelling(true);
        setError(null);
        try {
            const idToken = await user.getIdToken();

            const response = await fetch('https://us-central1-flashcards-d25b9.cloudfunctions.net/cancelSubscription', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to cancel subscription');
            }

            setSubscriptionStatus('pending_cancellation');
            setShowCancelDialog(false);
        } catch (err: any) {
            setError(err.message || 'Failed to cancel subscription.');
            console.error('Cancel subscription error:', err);
        } finally {
            setCancelling(false);
        }
    };

    const handleReactivateSubscription = async () => {
        if (!user) return;
        setCancelling(true);
        setError(null);
        try {
            const idToken = await user.getIdToken();

            const response = await fetch('https://us-central1-flashcards-d25b9.cloudfunctions.net/reactivateSubscription', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to reactivate subscription');
            }

            setSubscriptionStatus('subscribed');
        } catch (err: any) {
            setError(err.message || 'Failed to reactivate subscription.');
            console.error('Reactivate subscription error:', err);
        } finally {
            setCancelling(false);
        }
    };

    if (!user) {
        return (
            <Box sx={{ textAlign: 'center', pt: 6 }}>
                <Typography variant="h6" gutterBottom>Log in to view your profile</Typography>
                <Button component={Link} to="/auth" variant="contained">Log in</Button>
            </Box>
        );
    }

    if (initialLoading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
    }

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const sectionSx = {
        p: { xs: 2.5, sm: 3 },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '20px',
        bgcolor: '#fff',
    } as const;

    const status = {
        subscribed: { label: 'Active', color: 'success' as const, body: 'Unlimited flashcard generation.' },
        pending_cancellation: { label: 'Cancels at period end', color: 'warning' as const, body: 'Your subscription stays active until the end of your current billing period.' },
        unsubscribed: { label: 'Free plan', color: 'default' as const, body: 'Subscribe to generate unlimited flashcard sets.' },
    }[subscriptionStatus];

    const userLabel = user.displayName || user.email || '';

    return (
        <Box sx={{ width: '100%', maxWidth: 560, mx: 'auto' }}>
            <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 28, sm: 34 }, mb: { xs: 3, sm: 4 } }}>Profile</Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            {/* Account */}
            <Box sx={{ ...sectionSx, display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar src={user.photoURL || undefined} sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontWeight: 700 }}>
                    {userLabel.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {user.displayName && <Typography sx={{ fontWeight: 700 }} noWrap>{user.displayName}</Typography>}
                    <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>{user.email}</Typography>
                </Box>
            </Box>

            {/* Subscription */}
            <Box sx={{ ...sectionSx, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                    <Typography variant="h6" component="h2" sx={{ fontSize: 17 }}>Subscription</Typography>
                    <Chip
                        label={status.label}
                        size="small"
                        color={status.color === 'default' ? undefined : status.color}
                        variant={status.color === 'default' ? 'outlined' : 'filled'}
                        sx={status.color === 'success' ? { bgcolor: brand.mintSoft, color: 'primary.dark' } : undefined}
                    />
                </Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>{status.body}</Typography>
                {subscriptionStatus === 'unsubscribed' ? (
                    <Button variant="contained" onClick={handleCheckout} disabled={checkoutLoading} fullWidth size="large">
                        {checkoutLoading ? <CircularProgress size={22} color="inherit" /> : 'Subscribe'}
                    </Button>
                ) : subscriptionStatus === 'pending_cancellation' ? (
                    <Button variant="contained" onClick={handleReactivateSubscription} disabled={cancelling} fullWidth size="large">
                        {cancelling ? <CircularProgress size={22} color="inherit" /> : 'Keep subscription'}
                    </Button>
                ) : (
                    <Button variant="outlined" color="error" onClick={() => setShowCancelDialog(true)} sx={{ borderColor: alpha('#C8372D', 0.4) }}>
                        Cancel subscription
                    </Button>
                )}
            </Box>

            {/* Advanced */}
            <Box sx={{ ...sectionSx, p: 0, overflow: 'hidden' }}>
                <ButtonBase
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    aria-expanded={showAdvancedSettings}
                    sx={{ width: '100%', justifyContent: 'space-between', p: { xs: 2.5, sm: 3 }, textAlign: 'left' }}
                >
                    <Box>
                        <Typography variant="h6" component="h2" sx={{ fontSize: 17 }}>Advanced</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Use your own Anthropic API key</Typography>
                    </Box>
                    {showAdvancedSettings ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                </ButtonBase>
                <Collapse in={showAdvancedSettings}>
                    <Box component="form" onSubmit={handleSave} sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                            {keyHint ? `Saved key ending in ${keyHint}. It's stored encrypted.` : 'No API key saved.'}
                        </Typography>
                        <TextField
                            label={keyHint ? 'Replace Anthropic API key' : 'Anthropic API key'}
                            value={anthropicKey}
                            onChange={e => setAnthropicKey(e.target.value)}
                            fullWidth
                            type="password"
                            autoComplete="off"
                            placeholder="sk-ant-…"
                        />
                        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                            <Button type="submit" variant="contained" disabled={loading || !anthropicKey.trim()}>
                                {loading ? <CircularProgress size={22} color="inherit" /> : 'Save key'}
                            </Button>
                            {keyHint && (
                                <Button variant="outlined" color="error" onClick={() => saveKey('')} disabled={loading} sx={{ borderColor: alpha('#C8372D', 0.4) }}>
                                    Remove key
                                </Button>
                            )}
                        </Box>
                    </Box>
                </Collapse>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Button color="inherit" onClick={handleLogout} startIcon={<LogoutRoundedIcon />} sx={{ color: 'text.secondary' }}>
                    Log out
                </Button>
            </Box>

            {/* Cancel Subscription Dialog */}
            <Dialog open={showCancelDialog} onClose={() => setShowCancelDialog(false)}>
                <DialogTitle>Cancel subscription?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        You'll keep access until the end of your current billing period.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowCancelDialog(false)} disabled={cancelling} color="inherit">
                        Keep it
                    </Button>
                    <Button onClick={handleCancelSubscription} color="error" variant="contained" disabled={cancelling}>
                        {cancelling ? <CircularProgress size={22} color="inherit" /> : 'Cancel subscription'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Profile;
