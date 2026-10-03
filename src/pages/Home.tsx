import React, { useState, useEffect } from 'react';
import { TextField, Button, Box, Typography, CircularProgress, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, ToggleButton, ToggleButtonGroup, Chip, Alert, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import BookmarkAddedRoundedIcon from '@mui/icons-material/BookmarkAddedRounded';
import { useNavigate } from 'react-router-dom';
import { generateFlashcards, GenerateFlashcardsError } from '../services/anthropic';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, get } from 'firebase/database';
import Paper from '@mui/material/Paper';
import { brand } from '../theme';
import { loadStripe } from '@stripe/stripe-js';

// Add SubscriptionStatus type
// (copying from Profile.tsx for consistency)
type SubscriptionStatus = 'subscribed' | 'pending_cancellation' | 'unsubscribed';

const EXAMPLE_TOPICS = ['Photosynthesis', 'The French Revolution', 'Spanish irregular verbs', 'Python basics', 'Cell biology'];

const STEPS = [
    { icon: <EditNoteRoundedIcon />, title: 'Type a topic', body: 'Anything from organic chemistry to world capitals.' },
    { icon: <StyleRoundedIcon />, title: 'Get a deck', body: 'Clear question-and-answer cards in seconds.' },
    { icon: <BookmarkAddedRoundedIcon />, title: 'Study & save', body: 'Flip through, then save sets to revisit later.' },
];

const Home: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);
    const [showKeyPrompt, setShowKeyPrompt] = useState(false);
    const [hasOwnKey, setHasOwnKey] = useState(false);
    const [flashcardCount, setFlashcardCount] = useState(10);
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('unsubscribed');
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [freeGenerationUsed, setFreeGenerationUsed] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    // Fetch whether the user has saved their own key, and their subscription status, if logged in
    useEffect(() => {
        if (user) {
            const keyRef = ref(database, `users/${user.uid}/anthropicKeyHint`);
            const subRef = ref(database, `users/${user.uid}/subscriptionStatus`);
            const freeRef = ref(database, `users/${user.uid}/freeGenerationUsed`);

            Promise.all([
                get(keyRef),
                get(subRef),
                get(freeRef)
            ]).then(([keySnapshot, subSnapshot, freeSnapshot]) => {
                setHasOwnKey(keySnapshot.exists());
                if (subSnapshot.exists()) {
                    setSubscriptionStatus(subSnapshot.val() as SubscriptionStatus);
                } else {
                    setSubscriptionStatus('unsubscribed');
                }
                setFreeGenerationUsed(freeSnapshot.val() === true);
            });
        } else {
            setHasOwnKey(false);
            setSubscriptionStatus('unsubscribed');
            setFreeGenerationUsed(false);
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Generation requires an account (the free generation is tracked per user)
        if (!user) {
            setShowAuthPrompt(true);
            return;
        }

        // If user is logged in, has no key, and free generation is used, prompt to add key
        if (user && !hasOwnKey && freeGenerationUsed && !['subscribed', 'pending_cancellation'].includes(subscriptionStatus)) {
            setShowKeyPrompt(true);
            return;
        }

        setLoading(true);
        try {
            const idToken = await user.getIdToken();
            const flashcards = await generateFlashcards(idToken, topic, flashcardCount);
            // Without a subscription or their own key, the server has used up the free generation
            if (!hasOwnKey && !['subscribed', 'pending_cancellation'].includes(subscriptionStatus)) {
                setFreeGenerationUsed(true);
            }
            navigate('/study', { state: { flashcards, topic } });
        } catch (err) {
            if (err instanceof GenerateFlashcardsError && err.code === 'FREE_TIER_USED') {
                setFreeGenerationUsed(true);
                setShowKeyPrompt(true);
                return;
            }
            setError(err instanceof GenerateFlashcardsError ? err.message : 'Failed to generate flashcards. Please try again.');
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
        <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto', textAlign: 'center', pt: { xs: 1, sm: 4 } }}>
            <Chip
                icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
                label="AI-powered study decks"
                size="small"
                sx={{ bgcolor: brand.mintSoft, color: 'primary.dark', mb: { xs: 2, sm: 3 }, px: 0.5, '& .MuiChip-icon': { color: 'primary.main' } }}
            />
            <Typography
                variant="h1"
                sx={{ fontSize: { xs: 38, sm: 56 }, mb: 2 }}
            >
                Any topic.{' '}
                <Box component="br" sx={{ display: { xs: 'none', sm: 'block' } }} />
                <Box component="span" sx={{ color: 'primary.main' }}>Instant flashcards.</Box>
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: { xs: 16, sm: 19 }, maxWidth: 480, mx: 'auto', mb: { xs: 3, sm: 5 } }}>
                Type what you're learning and get a study-ready deck in seconds.
            </Typography>

            <Paper
                component="form"
                onSubmit={handleSubmit}
                variant="outlined"
                sx={{
                    p: { xs: 2, sm: 3 },
                    textAlign: 'left',
                    boxShadow: `0 1px 2px ${alpha(brand.ink, 0.04)}, 0 12px 40px ${alpha(brand.greenDark, 0.08)}`,
                }}
            >
                <Typography component="label" htmlFor="topic" sx={{ display: 'block', fontWeight: 700, fontSize: 14, mb: 1 }}>
                    What do you want to study?
                </Typography>
                <TextField
                    id="topic"
                    fullWidth
                    placeholder="e.g. The causes of World War I"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    autoComplete="off"
                    inputProps={{ maxLength: 200, enterKeyHint: 'go' }}
                    sx={{ '& .MuiOutlinedInput-input': { fontSize: 17, py: 1.75 } }}
                />

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5, alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, mr: 0.5 }}>Try:</Typography>
                    {EXAMPLE_TOPICS.map((t) => (
                        <Chip
                            key={t}
                            label={t}
                            size="small"
                            variant="outlined"
                            onClick={() => setTopic(t)}
                            sx={{ borderColor: 'divider', bgcolor: '#fff', '&:hover': { bgcolor: brand.mintSoft } }}
                        />
                    ))}
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: 2,
                        mt: 3,
                        pt: 3,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                        <Typography id="count-label" variant="body2" sx={{ fontWeight: 700 }}>Cards</Typography>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={flashcardCount}
                            onChange={(_, v) => v && setFlashcardCount(v)}
                            aria-labelledby="count-label"
                        >
                            {[10, 20, 30].map((n) => (
                                <ToggleButton key={n} value={n} sx={{ px: 2 }}>{n}</ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>
                    <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={loading || !topic.trim()}
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeRoundedIcon />}
                        sx={{ ml: { sm: 'auto' } }}
                    >
                        {loading ? 'Generating…' : 'Generate flashcards'}
                    </Button>
                </Box>

                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            </Paper>

            {!user && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
                    Your first deck is free — just create an account.
                </Typography>
            )}

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: { xs: 1.5, sm: 2 },
                    mt: { xs: 5, sm: 8 },
                    textAlign: 'left',
                }}
            >
                {STEPS.map((step, i) => (
                    <Stack key={step.title} direction={{ xs: 'row', sm: 'column' }} spacing={{ xs: 2, sm: 1.5 }} sx={{ p: { xs: 0.5, sm: 1 } }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: brand.mintSoft, color: 'primary.main', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            {step.icon}
                        </Box>
                        <Box>
                            <Typography sx={{ fontWeight: 700 }}>{i + 1}. {step.title}</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{step.body}</Typography>
                        </Box>
                    </Stack>
                ))}
            </Box>

            {/* Prompt to log in if not logged in */}
            <Dialog open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)}>
                <DialogTitle>Create a free account</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Sign up or log in to generate flashcards. Your first set is on us.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAuthPrompt(false)} color="inherit">Not now</Button>
                    <Button onClick={() => navigate('/auth?mode=signup')} variant="contained">Sign up / Log in</Button>
                </DialogActions>
            </Dialog>

            {/* Prompt to subscribe if logged in and free generation used */}
            <Dialog open={showKeyPrompt} onClose={() => setShowKeyPrompt(false)}>
                <DialogTitle>Keep the decks coming</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        You've used your free generation. Subscribe to generate unlimited flashcard sets.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowKeyPrompt(false)} color="inherit">Not now</Button>
                    <Button
                        onClick={handleCheckout}
                        variant="contained"
                        disabled={checkoutLoading}
                    >
                        {checkoutLoading ? <CircularProgress size={22} color="inherit" /> : 'Subscribe'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Home;
