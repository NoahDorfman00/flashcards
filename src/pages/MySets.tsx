import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Card, CardActionArea, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import { brand } from '../theme';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, onValue, off, remove } from 'firebase/database';
import { Link, useNavigate } from 'react-router-dom';
import { FlashcardSet } from '../types';

const MySets: React.FC = () => {
    const { user } = useAuth();
    const [sets, setSets] = useState<{ id: string; data: FlashcardSet }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        setError(null);
        const setsRef = ref(database, `users/${user.uid}/flashcardSets`);
        const handle = onValue(
            setsRef,
            (snapshot) => {
                const data = snapshot.val() || {};
                const setsArr = Object.entries(data).map(([id, set]) => ({ id, data: set as FlashcardSet }));
                setSets(setsArr.sort((a, b) => b.data.createdAt - a.data.createdAt));
                setLoading(false);
            },
            (err) => {
                setError('Failed to load sets.');
                setLoading(false);
            }
        );
        return () => off(setsRef, 'value', handle);
    }, [user]);

    const handleDelete = async (id: string) => {
        if (!user) return;
        setDeleting(true);
        try {
            await remove(ref(database, `users/${user.uid}/flashcardSets/${id}`));
            setDeleteId(null);
        } catch (err) {
            setError('Failed to delete set.');
        } finally {
            setDeleting(false);
        }
    };

    if (!user) {
        return (
            <Box sx={{ textAlign: 'center', pt: 6 }}>
                <Typography variant="h6" gutterBottom>Log in to see your saved sets</Typography>
                <Button component={Link} to="/auth" variant="contained">Log in</Button>
            </Box>
        );
    }

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
    }

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <Box sx={{ width: '100%', maxWidth: 960, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: { xs: 3, sm: 4 } }}>
                <Box>
                    <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 28, sm: 34 } }}>My sets</Typography>
                    <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
                        {sets.length === 0 ? 'Nothing saved yet' : `${sets.length} saved ${sets.length === 1 ? 'set' : 'sets'}`}
                    </Typography>
                </Box>
                <Button component={Link} to="/" variant="contained" startIcon={<AddRoundedIcon />} sx={{ flexShrink: 0 }}>
                    New set
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {sets.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: { xs: 6, sm: 10 }, px: 3, border: '1.5px dashed', borderColor: 'divider', borderRadius: '20px' }}>
                    <Box sx={{ width: 56, height: 56, borderRadius: '16px', bgcolor: brand.mintSoft, color: 'primary.main', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                        <StyleRoundedIcon />
                    </Box>
                    <Typography variant="h6" gutterBottom>No saved sets yet</Typography>
                    <Typography sx={{ color: 'text.secondary', mb: 3, maxWidth: 360, mx: 'auto' }}>
                        Generate a deck, then tap “Save set” to keep it here for later.
                    </Typography>
                    <Button component={Link} to="/" variant="contained">Create your first set</Button>
                </Box>
            ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                    {sets.map(({ id, data }) => (
                        <Card
                            key={id}
                            sx={{
                                position: 'relative',
                                borderRadius: '18px',
                                transition: 'box-shadow .2s, border-color .2s, transform .2s',
                                '&:hover': { borderColor: alpha(brand.green, 0.35), boxShadow: `0 8px 28px ${alpha(brand.greenDark, 0.10)}`, transform: 'translateY(-2px)' },
                            }}
                        >
                            <CardActionArea
                                onClick={() => navigate('/study', { state: { flashcards: data.flashcards, topic: data.topic, isSavedSet: true } })}
                                sx={{ p: 2.5, pr: 7, minHeight: { xs: 0, sm: 136 }, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}
                            >
                                <Typography sx={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {data.title || data.topic}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontSize: 13, fontWeight: 600 }}>
                                    <Box component="span" sx={{ bgcolor: brand.mintSoft, color: 'primary.dark', px: 1, py: 0.25, borderRadius: '999px' }}>
                                        {data.flashcards?.length ?? 0} cards
                                    </Box>
                                    <span>{formatDate(data.createdAt)}</span>
                                </Box>
                            </CardActionArea>
                            <Tooltip title="Delete set">
                                <IconButton
                                    onClick={() => setDeleteId(id)}
                                    aria-label={`Delete ${data.title || data.topic}`}
                                    size="small"
                                    sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: alpha('#C8372D', 0.08) } }}
                                >
                                    <DeleteOutlineRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Card>
                    ))}
                </Box>
            )}

            <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                <DialogTitle>Delete this set?</DialogTitle>
                <DialogContent>
                    <DialogContentText>This can't be undone.</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteId(null)} disabled={deleting} color="inherit">Cancel</Button>
                    <Button onClick={() => deleteId && handleDelete(deleteId)} color="error" variant="contained" disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default MySets;
