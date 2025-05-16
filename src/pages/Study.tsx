import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert } from '@mui/material';
import { FlipCameraAndroid, Save, ArrowBack } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { Flashcard, FlashcardSet } from '../types';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, push } from 'firebase/database';

interface StudyLocationState {
    flashcards: Flashcard[];
    topic: string;
    isSavedSet?: boolean;
}

const Study: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { flashcards, topic, isSavedSet } = location.state as StudyLocationState;
    const { user } = useAuth();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [saved, setSaved] = useState(!!isSavedSet);
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSavedSnackbar, setShowSavedSnackbar] = useState(false);

    const currentCard = flashcards[currentIndex];

    const handleNext = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setIsFlipped(false);
        }
    };

    const handleSave = async () => {
        if (!user) {
            setShowAuthPrompt(true);
            return;
        }
        setSaving(true);
        try {
            const setRef = ref(database, `users/${user.uid}/flashcardSets`);
            const newSet: Omit<FlashcardSet, 'id'> = {
                title: topic,
                topic,
                flashcards,
                userId: user.uid,
                createdAt: Date.now(),
            };
            await push(setRef, newSet);
            setSaved(true);
            setShowSavedSnackbar(true);
        } catch (err) {
            // Optionally handle error
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', textAlign: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <IconButton onClick={() => isSavedSet ? navigate('/my-sets') : navigate('/')}>
                    <ArrowBack />
                </IconButton>
                <Typography variant="h6">{topic}</Typography>
                {!saved && (
                    <IconButton onClick={handleSave} disabled={saved || saving}>
                        <Save />
                    </IconButton>
                )}
            </Box>

            <Card
                sx={{
                    minHeight: 300,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    mb: 2,
                }}
                onClick={() => setIsFlipped(!isFlipped)}
            >
                <CardContent>
                    <Typography variant="h5" component="div">
                        {isFlipped ? currentCard.answer : currentCard.question}
                    </Typography>
                </CardContent>
            </Card>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button
                    variant="contained"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                >
                    Previous
                </Button>
                <Button
                    variant="contained"
                    onClick={() => setIsFlipped(!isFlipped)}
                    startIcon={<FlipCameraAndroid />}
                >
                    Flip
                </Button>
                <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={currentIndex === flashcards.length - 1}
                >
                    Next
                </Button>
            </Box>

            <Typography sx={{ mt: 2 }}>
                Card {currentIndex + 1} of {flashcards.length}
            </Typography>

            <Dialog open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)}>
                <DialogTitle>Sign Up to Save Flashcards</DialogTitle>
                <DialogContent>
                    <Typography>
                        You need to sign up or log in to save your flashcard sets for later.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAuthPrompt(false)}>Cancel</Button>
                    <Button onClick={() => navigate('/auth')} variant="contained">Sign Up / Log In</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={showSavedSnackbar}
                autoHideDuration={3000}
                onClose={() => setShowSavedSnackbar(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="success" sx={{ width: '100%' }}>
                    Flashcard set saved!
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Study; 