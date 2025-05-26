import React, { useState, useEffect } from 'react';
import { TextField, Button, Box, Typography, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { generateFlashcards } from '../services/anthropic';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, get } from 'firebase/database';
import Paper from '@mui/material/Paper';
import { loadStripe } from '@stripe/stripe-js';

// Add SubscriptionStatus type
// (copying from Profile.tsx for consistency)
type SubscriptionStatus = 'subscribed' | 'pending_cancellation' | 'unsubscribed';

const Home: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);
    const [showKeyPrompt, setShowKeyPrompt] = useState(false);
    const [userAnthropicKey, setUserAnthropicKey] = useState<string | null>(null);
    const [flashcardCount, setFlashcardCount] = useState(10);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('unsubscribed');
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    // Check if free generation has been used
    const freeGenerationUsed = localStorage.getItem('freeGenerationUsed') === 'true';

    // Fetch user's Anthropic key and subscription status if logged in
    useEffect(() => {
        if (user) {
            const keyRef = ref(database, `users/${user.uid}/anthropicKey`);
            const subRef = ref(database, `users/${user.uid}/subscriptionStatus`);

            Promise.all([
                get(keyRef),
                get(subRef)
            ]).then(([keySnapshot, subSnapshot]) => {
                if (keySnapshot.exists() && keySnapshot.val()) {
                    setUserAnthropicKey(keySnapshot.val());
                } else {
                    setUserAnthropicKey(null);
                }
                if (subSnapshot.exists()) {
                    setSubscriptionStatus(subSnapshot.val() as SubscriptionStatus);
                } else {
                    setSubscriptionStatus('unsubscribed');
                }
            });
        } else {
            setUserAnthropicKey(null);
            setSubscriptionStatus('unsubscribed');
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // If user is not logged in and free generation is used, prompt login
        if (!user && freeGenerationUsed) {
            setShowAuthPrompt(true);
            return;
        }

        // If user is logged in, has no key, and free generation is used, prompt to add key
        if (user && !userAnthropicKey && freeGenerationUsed && !['subscribed', 'pending_cancellation'].includes(subscriptionStatus)) {
            setShowKeyPrompt(true);
            return;
        }

        setLoading(true);
        try {
            // Use app key if user is subscribed, otherwise use user's key if present
            const apiKey = ['subscribed', 'pending_cancellation'].includes(subscriptionStatus) ? undefined : userAnthropicKey || undefined;
            const flashcards = await generateFlashcards(topic, apiKey, flashcardCount);
            // If using the app key (no user key) and not subscribed, set freeGenerationUsed
            if (!userAnthropicKey && !['subscribed', 'pending_cancellation'].includes(subscriptionStatus)) {
                localStorage.setItem('freeGenerationUsed', 'true');
            }
            navigate('/study', { state: { flashcards, topic } });
        } catch (err) {
            setError('Failed to generate flashcards. Please try again.');
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
            const idToken = await user.getIdToken();

            // Call the createCheckoutSession function
            const response = await fetch('https://us-central1-flashcards-d25b9.cloudfunctions.net/createCheckoutSession', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }

            const { sessionId } = await response.json();

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
            setError(err.message || 'Failed to start checkout process.');
            console.error('Checkout error:', err);
        } finally {
            setCheckoutLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', mt: 8 }}>
            <Paper elevation={3} sx={{ p: 5, borderRadius: 4, boxShadow: '0 4px 24px 0 rgba(10,60,47,0.10)', mx: { xs: 1, sm: 0 } }}>
                <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: 1 }}>
                    Instant AI Flashcards
                </Typography>
                <Typography variant="body1" paragraph sx={{ color: 'text.secondary', fontSize: 18 }}>
                    Generate flashcards on any subject
                </Typography>

                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Enter a topic"
                        variant="outlined"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        margin="normal"
                        required
                        sx={{ bgcolor: '#f8fafb', borderRadius: 2 }}
                    />
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel id="flashcard-count-label">Number of Flashcards</InputLabel>
                        <Select
                            labelId="flashcard-count-label"
                            value={flashcardCount}
                            label="Number of Flashcards"
                            onChange={e => setFlashcardCount(Number(e.target.value))}
                        >
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={20}>20</MenuItem>
                            <MenuItem value={30}>30</MenuItem>
                        </Select>
                    </FormControl>
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={loading || !topic}
                        sx={{ mt: 3, px: 5, py: 1.5, borderRadius: 3, fontWeight: 700, fontSize: 18 }}
                    >
                        {loading ? <CircularProgress size={24} /> : 'Generate Flashcards'}
                    </Button>
                </form>

                {error && (
                    <Typography color="error" sx={{ mt: 2 }}>
                        {error}
                    </Typography>
                )}
            </Paper>

            {/* Prompt to log in if not logged in and free generation used */}
            <Dialog open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)}>
                <DialogTitle>Sign Up to Generate More</DialogTitle>
                <DialogContent>
                    <Typography>
                        You have reached the limit of 1 free flashcard generation. Please sign up or log in to generate more sets!
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAuthPrompt(false)}>Cancel</Button>
                    <Button onClick={() => navigate('/auth')} variant="contained">Sign Up / Log In</Button>
                </DialogActions>
            </Dialog>

            {/* Prompt to subscribe if logged in and free generation used */}
            <Dialog open={showKeyPrompt} onClose={() => setShowKeyPrompt(false)}>
                <DialogTitle>Subscribe to Generate More</DialogTitle>
                <DialogContent>
                    <Typography>
                        You have reached the limit of 1 free flashcard generation. Subscribe to generate unlimited sets!
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowKeyPrompt(false)}>Cancel</Button>
                    <Button
                        onClick={handleCheckout}
                        variant="contained"
                        disabled={checkoutLoading}
                    >
                        {checkoutLoading ? <CircularProgress size={24} /> : 'Subscribe Now'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Home; 