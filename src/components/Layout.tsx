import React from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Button, CircularProgress } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user, loading, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static">
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography
                        variant="h6"
                        component={Link}
                        to="/"
                        sx={{ textDecoration: 'none', color: 'inherit' }}
                    >
                        Flashcard Generator
                    </Typography>
                    {loading ? (
                        <CircularProgress color="inherit" size={24} />
                    ) : user ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Button color="inherit" onClick={() => navigate('/my-sets')}>
                                My Sets
                            </Button>
                            <Button color="inherit" onClick={() => navigate('/profile')} sx={{ textTransform: 'none' }}>
                                {user.displayName || user.email}
                            </Button>
                            <Button color="inherit" onClick={handleLogout}>
                                Log Out
                            </Button>
                        </Box>
                    ) : (
                        <Button color="inherit" component={Link} to="/auth">
                            Log In / Sign Up
                        </Button>
                    )}
                </Toolbar>
            </AppBar>
            <Container component="main" sx={{ flex: 1, py: 4 }}>
                {children}
            </Container>
        </Box>
    );
};

export default Layout; 