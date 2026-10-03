import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Snackbar, Alert, LinearProgress, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CachedRoundedIcon from '@mui/icons-material/CachedRounded';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import BookmarkAddedRoundedIcon from '@mui/icons-material/BookmarkAddedRounded';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Flashcard, FlashcardSet } from '../types';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, push } from 'firebase/database';
import { brand } from '../theme';

interface StudyLocationState {
    flashcards: Flashcard[];
    topic: string;
    isSavedSet?: boolean;
}

const SWIPE_THRESHOLD = 50;

const cardIn = keyframes`
    from { opacity: 0; transform: translateY(8px) scale(0.985); }
    to { opacity: 1; transform: none; }
`;

const Study: React.FC = () => {
    const location = useLocation();
    const state = location.state as StudyLocationState | null;
    if (!state?.flashcards?.length) {
        return <Navigate to="/" replace />;
    }
    return <StudyDeck {...state} />;
};

const StudyDeck: React.FC<StudyLocationState> = ({ flashcards, topic, isSavedSet }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [saved, setSaved] = useState(!!isSavedSet);
    const [showAuthPrompt, setShowAuthPrompt] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSavedSnackbar, setShowSavedSnackbar] = useState(false);
    const touchStart = useRef<{ x: number; y: number } | null>(null);

    const currentCard = flashcards[currentIndex];
    const isLast = currentIndex === flashcards.length - 1;
    const backPath = isSavedSet ? '/my-sets' : '/';

    const goTo = useCallback((index: number) => {
        if (index < 0 || index >= flashcards.length) return;
        setCurrentIndex(index);
        setIsFlipped(false);
    }, [flashcards.length]);

    const handleNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex]);
    const handlePrevious = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex]);

    const flip = useCallback(() => setIsFlipped((f) => !f), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (e.key === 'ArrowRight') handleNext();
            else if (e.key === 'ArrowLeft') handlePrevious();
            else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                flip();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [handleNext, handlePrevious, flip]);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart.current) return;
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) handleNext();
            else handlePrevious();
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

    const faceSx = {
        gridArea: '1 / 1',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        borderRadius: '24px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: `0 1px 2px ${alpha(brand.ink, 0.04)}, 0 16px 48px ${alpha(brand.greenDark, 0.10)}`,
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 3, sm: 5 },
        minHeight: { xs: 'max(300px, 52dvh)', sm: 380 },
    } as const;

    return (
        <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 2, sm: 3 } }}>
                <IconButton onClick={() => navigate(backPath)} aria-label="Back" sx={{ ml: -1 }}>
                    <ArrowBackRoundedIcon />
                </IconButton>
                <Typography variant="h6" component="h1" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: { xs: 17, sm: 20 } }}>
                    {topic}
                </Typography>
                <Button
                    variant={saved ? 'text' : 'outlined'}
                    color={saved ? 'success' : 'inherit'}
                    onClick={handleSave}
                    disabled={saved || saving}
                    startIcon={saved ? <BookmarkAddedRoundedIcon /> : <BookmarkAddRoundedIcon />}
                    sx={{ flexShrink: 0, '&.Mui-disabled': saved ? { color: 'success.main' } : {} }}
                >
                    {saved ? 'Saved' : saving ? 'Saving…' : 'Save set'}
                </Button>
            </Box>

            {/* Progress */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: { xs: 2, sm: 3 } }}>
                <LinearProgress variant="determinate" value={((currentIndex + 1) / flashcards.length) * 100} sx={{ flex: 1 }} />
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right' }}>
                    {currentIndex + 1} / {flashcards.length}
                </Typography>
            </Box>

            {/* Card */}
            <Box
                sx={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    touchAction: 'pan-y',
                    borderRadius: '28px',
                    outline: 'none',
                    '&:focus-visible': { outline: `2px solid ${brand.green}`, outlineOffset: 4 },
                }}
                onClick={flip}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                role="button"
                tabIndex={0}
                aria-label={isFlipped ? 'Showing answer. Activate to show question.' : 'Showing question. Activate to show answer.'}
                onKeyDown={(e) => { if (e.key === 'Enter') flip(); }}
            >
                {/* Keyed by index so a new card mounts face-up instead of animating back and exposing its answer */}
                <Box
                    key={currentIndex}
                    sx={{
                        perspective: 1600,
                        animation: `${cardIn} 0.25s ease-out`,
                        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                    }}
                >
                    <Box
                        sx={{
                            display: 'grid',
                            transformStyle: 'preserve-3d',
                            transition: 'transform 0.5s cubic-bezier(.2,.8,.2,1)',
                            transform: isFlipped ? 'rotateY(180deg)' : 'none',
                            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        }}
                    >
                        <Box sx={{ ...faceSx, bgcolor: '#fff' }} aria-hidden={isFlipped}>
                            <Typography variant="overline" sx={{ color: 'primary.main', lineHeight: 1 }}>Question</Typography>
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: { xs: 22, sm: 28 }, lineHeight: 1.3, textAlign: 'center', letterSpacing: '-0.01em' }}>
                                    {currentCard.question}
                                </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                                <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Tap to reveal · swipe for next</Box>
                                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Click or press space to reveal · ← → to navigate</Box>
                            </Typography>
                        </Box>
                        <Box sx={{ ...faceSx, bgcolor: brand.mintSoft, borderColor: alpha(brand.green, 0.18), transform: 'rotateY(180deg)' }} aria-hidden={!isFlipped}>
                            <Typography variant="overline" sx={{ color: 'primary.dark', lineHeight: 1 }}>Answer</Typography>
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3 }}>
                                <Typography sx={{ fontWeight: 500, fontSize: { xs: 18, sm: 22 }, lineHeight: 1.5, textAlign: 'center' }}>
                                    {currentCard.answer}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1.5, sm: 2 }, mt: { xs: 3, sm: 4 } }}>
                <Tooltip title="Previous (←)">
                    <span>
                        <IconButton
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                            aria-label="Previous card"
                            sx={{ width: 52, height: 52, borderRadius: '50%', border: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}
                        >
                            <ChevronLeftRoundedIcon />
                        </IconButton>
                    </span>
                </Tooltip>
                <Button
                    variant="outlined"
                    color="inherit"
                    size="large"
                    onClick={flip}
                    startIcon={<CachedRoundedIcon />}
                    sx={{ minWidth: 160, bgcolor: '#fff', height: 52 }}
                >
                    {isFlipped ? 'Question' : 'Answer'}
                </Button>
                {isLast ? (
                    <Button variant="contained" size="large" onClick={() => navigate(backPath)} sx={{ height: 52 }}>
                        Done
                    </Button>
                ) : (
                    <Tooltip title="Next (→)">
                        <IconButton
                            onClick={handleNext}
                            aria-label="Next card"
                            sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }}
                        >
                            <ChevronRightRoundedIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            <Dialog open={showAuthPrompt} onClose={() => setShowAuthPrompt(false)}>
                <DialogTitle>Save this set</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Sign up or log in to save flashcard sets and study them later.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAuthPrompt(false)} color="inherit">Not now</Button>
                    <Button onClick={() => navigate('/auth')} variant="contained">Sign up / Log in</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={showSavedSnackbar}
                autoHideDuration={3000}
                onClose={() => setShowSavedSnackbar(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" variant="filled" sx={{ width: '100%' }}>
                    Saved to My Sets
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Study;
