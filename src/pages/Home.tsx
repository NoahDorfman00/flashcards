import React, { useState, useEffect } from 'react';
import { TextField, Button, Box, Typography, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select, InputLabel, FormControl } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { generateFlashcards } from '../services/anthropic';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, get } from 'firebase/database';

const Home: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);
    const [showKeyPrompt, setShowKeyPrompt] = useState(false);
    const [userAnthropicKey, setUserAnthropicKey] = useState<string | null>(null);
    const [flashcardCount, setFlashcardCount] = useState(10);
    const navigate = useNavigate();
    const { user } = useAuth();

    // Check if free generation has been used
    const freeGenerationUsed = localStorage.getItem('freeGenerationUsed') === 'true';

    // Fetch user's Anthropic key if logged in
    useEffect(() => {
        if (user) {
            const keyRef = ref(database, `users/${user.uid}/anthropicKey`);
            get(keyRef).then((snapshot) => {
                if (snapshot.exists() && snapshot.val()) {
                    setUserAnthropicKey(snapshot.val());
                } else {
                    setUserAnthropicKey(null);
                }
            });
        } else {
            setUserAnthropicKey(null);
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
        if (user && !userAnthropicKey && freeGenerationUsed) {
            setShowKeyPrompt(true);
            return;
        }

        setLoading(true);
        try {
            // Use user's key if present, otherwise use app key
            const apiKey = userAnthropicKey || undefined;
            const flashcards = await generateFlashcards(topic, apiKey, flashcardCount);
            // If using the app key (no user key), set freeGenerationUsed
            if (!userAnthropicKey) {
                localStorage.setItem('freeGenerationUsed', 'true');
            }
            navigate('/study', { state: { flashcards, topic } });
        } catch (err) {
            setError('Failed to generate flashcards. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Flashcard Generator
            </Typography>
            <Typography variant="body1" paragraph>
                Enter any topic, and we'll generate flashcards to help you study!
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
                    sx={{ mt: 2 }}
                >
                    {loading ? <CircularProgress size={24} /> : 'Generate Flashcards'}
                </Button>
            </form>

            {error && (
                <Typography color="error" sx={{ mt: 2 }}>
                    {error}
                </Typography>
            )}

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

            {/* Prompt to add Anthropic key if logged in and free generation used */}
            <Dialog open={showKeyPrompt} onClose={() => setShowKeyPrompt(false)}>
                <DialogTitle>Add Your Anthropic API Key</DialogTitle>
                <DialogContent>
                    <Typography>
                        You have reached the limit of 1 free flashcard generation. Please add your own Anthropic API key in your profile to generate more sets!
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowKeyPrompt(false)}>Cancel</Button>
                    <Button onClick={() => navigate('/profile')} variant="contained">Go to Profile</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Home; 