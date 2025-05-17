import React, { useEffect, useState } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Button, CircularProgress, Alert, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Delete } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, onValue, off, remove } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import { FlashcardSet } from '../types';
import Paper from '@mui/material/Paper';

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
        return <Typography variant="h6">You must be logged in to view your saved sets.</Typography>;
    }

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: { xs: 3, sm: 6 }, px: 1 }}>
            <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 4, boxShadow: '0 4px 24px 0 rgba(10,60,47,0.10)', bgcolor: '#fff' }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, color: 'primary.main', textAlign: 'center' }}>My Saved Flashcard Sets</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                {sets.length === 0 ? (
                    <Typography>No saved sets yet.</Typography>
                ) : (
                    <List>
                        {sets.map(({ id, data }) => (
                            <ListItem key={id} secondaryAction={
                                <>
                                    <Button variant="contained" onClick={() => navigate('/study', { state: { flashcards: data.flashcards, topic: data.topic, isSavedSet: true } })} sx={{ mr: 1 }}>
                                        Study
                                    </Button>
                                    <IconButton edge="end" color="error" onClick={() => setDeleteId(id)}>
                                        <Delete />
                                    </IconButton>
                                </>
                            }>
                                <ListItemText
                                    primary={data.title || data.topic}
                                    secondary={new Date(data.createdAt).toLocaleString()}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
                <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                    <DialogTitle>Delete Flashcard Set</DialogTitle>
                    <DialogContent>
                        <Typography>Are you sure you want to delete this flashcard set? This action cannot be undone.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
                        <Button onClick={() => deleteId && handleDelete(deleteId)} color="error" variant="contained" disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Paper>
        </Box>
    );
};

export default MySets; 