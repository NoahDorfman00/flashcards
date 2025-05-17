import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, get, set } from 'firebase/database';
import Paper from '@mui/material/Paper';

const Profile: React.FC = () => {
    const { user } = useAuth();
    const [anthropicKey, setAnthropicKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        if (user) {
            setInitialLoading(true);
            const keyRef = ref(database, `users/${user.uid}/anthropicKey`);
            get(keyRef)
                .then((snapshot) => {
                    if (snapshot.exists()) {
                        setAnthropicKey(snapshot.val());
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
            </Paper>
        </Box>
    );
};

export default Profile; 