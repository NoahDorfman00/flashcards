import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { database } from '../services/firebase';
import { ref, get, set } from 'firebase/database';

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
        <Box sx={{ maxWidth: 500, mx: 'auto', mt: 6, p: 3, boxShadow: 2, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>Profile</Typography>
            <Typography variant="body1" gutterBottom>Email: {user.email}</Typography>
            <form onSubmit={handleSave}>
                <TextField
                    label="Anthropic API Key"
                    value={anthropicKey}
                    onChange={e => setAnthropicKey(e.target.value)}
                    fullWidth
                    margin="normal"
                    type="password"
                    autoComplete="off"
                />
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mt: 2 }}>Key saved!</Alert>}
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    sx={{ mt: 2 }}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} /> : 'Save Key'}
                </Button>
            </form>
        </Box>
    );
};

export default Profile; 