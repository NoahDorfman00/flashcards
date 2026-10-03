import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { brand } from '../theme';

const Success: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Box sx={{ width: '100%', maxWidth: 480, mx: 'auto', pt: { xs: 2, sm: 6 } }}>
            <Paper
                variant="outlined"
                sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center', boxShadow: `0 1px 2px ${alpha(brand.ink, 0.04)}, 0 12px 40px ${alpha(brand.greenDark, 0.08)}` }}
            >
                <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: brand.mintSoft, color: 'primary.main', display: 'grid', placeItems: 'center', mx: 'auto', mb: 3 }}>
                    <CheckRoundedIcon sx={{ fontSize: 36 }} />
                </Box>
                <Typography variant="h4" component="h1" gutterBottom sx={{ fontSize: { xs: 26, sm: 32 } }}>
                    You're subscribed
                </Typography>
                <Typography sx={{ color: 'text.secondary', mb: 4 }}>
                    Thanks for subscribing! You can now generate unlimited flashcard sets.
                </Typography>
                <Button variant="contained" size="large" onClick={() => navigate('/')}>
                    Start generating
                </Button>
            </Paper>
        </Box>
    );
};

export default Success;
