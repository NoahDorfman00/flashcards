import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const Success: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', mt: 8 }}>
            <Paper elevation={3} sx={{ p: 5, borderRadius: 4, boxShadow: '0 4px 24px 0 rgba(10,60,47,0.10)', mx: { xs: 1, sm: 0 } }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: 1 }}>
                    Subscription Successful!
                </Typography>
                <Typography variant="body1" paragraph sx={{ color: 'text.secondary', fontSize: 18, mb: 4 }}>
                    Thank you for subscribing! You can now generate unlimited flashcard sets.
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => navigate('/')}
                    sx={{ px: 5, py: 1.5, borderRadius: 3, fontWeight: 700, fontSize: 18 }}
                >
                    Generate Flashcards
                </Button>
            </Paper>
        </Box>
    );
};

export default Success; 