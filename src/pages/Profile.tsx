import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, Alert, CircularProgress, Divider, Collapse, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, get, set } from 'firebase/database';
import Paper from '@mui/material/Paper';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { loadStripe } from '@stripe/stripe-js';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

type SubscriptionStatus = 'subscribed' | 'pending_cancellation' | 'unsubscribed';

const Profile: React.FC = () => {
    const { user } = useAuth();
    const [anthropicKey, setAnthropicKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
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
            // Load Anthropic key
            const keyRef = ref(database, `users/${user.uid}/anthropicKey`);
            get(keyRef)
                .then((snapshot) => {
                    if (snapshot.exists()) {
                        setAnthropicKey(snapshot.val());
                    }
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setError(null);
        setSuccess(false);
        try {
            const keyRef = ref(database, `users/${user.uid}/anthropicKey`);
            await set(keyRef, anthropicKey);
            setSuccess(true);
        } catch (err: any) {
            setError('Failed to save key.');
        } finally {
            setLoading(false);
        }
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
                url: 'https://createcheckoutsession-n3crmlorra-uc.a.run.app',
                headers: {
                    'Authorization': `Bearer ${idToken.substring(0, 10)}...`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });
            const response = await fetch('https://createcheckoutsession-n3crmlorra-uc.a.run.app', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
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

            const response = await fetch('https://cancelsubscription-n3crmlorra-uc.a.run.app', {
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

            const response = await fetch('https://reactivatesubscription-n3crmlorra-uc.a.run.app', {
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
        return <Typography variant="h6">You must be logged in to view this page.</Typography>;
    }

    if (initialLoading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ maxWidth: 500, mx: 'auto', mt: { xs: 3, sm: 6 }, px: 1 }}>
            <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 4, boxShadow: '0 4px 24px 0 rgba(10,60,47,0.10)', bgcolor: '#fff' }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, color: 'primary.main', textAlign: 'center' }}>Profile</Typography>
                <Typography variant="body1" gutterBottom sx={{ color: 'text.secondary', textAlign: 'center' }}>Email: {user.email}</Typography>

                {/* Subscription Status */}
                <Box sx={{ mt: 4, mb: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>Subscription Status</Typography>
                    <Typography variant="body1" sx={{
                        color: subscriptionStatus === 'subscribed'
                            ? 'success.main'
                            : subscriptionStatus === 'pending_cancellation'
                                ? 'warning.main'
                                : 'text.secondary',
                        mb: 1
                    }}>
                        {subscriptionStatus === 'subscribed'
                            ? 'Active Subscription'
                            : subscriptionStatus === 'pending_cancellation'
                                ? 'Subscription (Cancellation Pending)'
                                : 'No Active Subscription'
                        }
                    </Typography>
                    {subscriptionStatus === 'pending_cancellation' && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                            Your subscription will remain active until the end of your current billing period.
                        </Typography>
                    )}
                    {subscriptionStatus === 'unsubscribed' ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleCheckout}
                                disabled={checkoutLoading}
                                sx={{ px: 4, py: 1.5, borderRadius: 3, fontWeight: 700 }}
                            >
                                {checkoutLoading ? <CircularProgress size={24} /> : 'Subscribe Now'}
                            </Button>
                        </Box>
                    ) : subscriptionStatus === 'pending_cancellation' ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleReactivateSubscription}
                                disabled={cancelling}
                                sx={{ px: 4, py: 1.5, borderRadius: 3, fontWeight: 700 }}
                            >
                                {cancelling ? <CircularProgress size={24} /> : 'Keep Subscription'}
                            </Button>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={() => setShowCancelDialog(true)}
                                sx={{ px: 4, py: 1.5, borderRadius: 3, fontWeight: 700 }}
                            >
                                Cancel Subscription
                            </Button>
                        </Box>
                    )}
                </Box>

                {/* Advanced Settings Section */}
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                    <Button
                        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                        endIcon={showAdvancedSettings ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        sx={{ color: 'text.secondary', mb: 1, fontSize: '0.9rem' }}
                    >
                        Advanced Settings
                    </Button>
                </Box>
                <Collapse in={showAdvancedSettings}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>API Settings</Typography>
                    <form onSubmit={handleSave}>
                        <TextField
                            label="Anthropic API Key"
                            value={anthropicKey}
                            onChange={e => setAnthropicKey(e.target.value)}
                            fullWidth
                            margin="normal"
                            type="password"
                            autoComplete="off"
                            sx={{ bgcolor: '#f8fafb', borderRadius: 2 }}
                        />
                        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                        {success && <Alert severity="success" sx={{ mt: 2 }}>Key saved!</Alert>}
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                sx={{ mt: 2, px: 4, py: 1.5, borderRadius: 3, fontWeight: 700 }}
                                disabled={loading}
                            >
                                {loading ? <CircularProgress size={24} /> : 'Save Key'}
                            </Button>
                        </Box>
                    </form>
                </Collapse>

                {/* Cancel Subscription Dialog */}
                <Dialog open={showCancelDialog} onClose={() => setShowCancelDialog(false)}>
                    <DialogTitle>Cancel Subscription</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to cancel your subscription? You'll still have access until the end of your current billing period.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowCancelDialog(false)} disabled={cancelling}>
                            Keep Subscription
                        </Button>
                        <Button
                            onClick={handleCancelSubscription}
                            color="error"
                            variant="contained"
                            disabled={cancelling}
                        >
                            {cancelling ? <CircularProgress size={24} /> : 'Cancel Subscription'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Paper>
        </Box>
    );
};

export default Profile; 