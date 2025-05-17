import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Container, Box, Button, CircularProgress, IconButton, Drawer, List, ListItem, ListItemText, Divider } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MenuIcon from '@mui/icons-material/Menu';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user, loading, logout } = useAuth();
    const navigate = useNavigate();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static" elevation={2} sx={{ bgcolor: '#fff', color: 'primary.main', borderRadius: 0, boxShadow: '0 2px 12px 0 rgba(10,60,47,0.06)' }}>
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', px: { xs: 1, sm: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                        <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', minWidth: 0 }}>
                            <img src="/assets/logo.png" alt="Logo" style={{ width: 36, height: 36, borderRadius: '50%', marginRight: 10, background: 'linear-gradient(135deg, #19c2b2 0%, #145a43 100%)' }} />
                            <Typography
                                variant="h6"
                                sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: 1, fontSize: { xs: 18, sm: 22 }, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                                Flashcard Generator
                            </Typography>
                        </Box>
                    </Box>
                    {/* Desktop Menu */}
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 2 }}>
                        {loading ? (
                            <CircularProgress color="primary" size={24} />
                        ) : user ? (
                            <>
                                <Button color="primary" onClick={() => navigate('/my-sets')} sx={{ fontWeight: 700, fontSize: 16 }}>
                                    My Sets
                                </Button>
                                <Button color="primary" onClick={() => navigate('/profile')} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 16 }}>
                                    {user.displayName || user.email}
                                </Button>
                                <Button color="primary" onClick={handleLogout} sx={{ fontWeight: 700, fontSize: 16 }}>
                                    Log Out
                                </Button>
                            </>
                        ) : (
                            <Button color="primary" component={Link} to="/auth" sx={{ fontWeight: 700, fontSize: 16 }}>
                                Log In / Sign Up
                            </Button>
                        )}
                    </Box>
                    {/* Mobile Hamburger Menu */}
                    <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
                        <IconButton edge="end" color="primary" onClick={() => setDrawerOpen(true)}>
                            <MenuIcon />
                        </IconButton>
                        <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                            <Box sx={{ width: 240 }} role="presentation" onClick={() => setDrawerOpen(false)}>
                                <List>
                                    {loading ? (
                                        <ListItem><CircularProgress color="primary" size={24} /></ListItem>
                                    ) : user ? (
                                        <>
                                            <ListItem button onClick={() => navigate('/my-sets')}>
                                                <ListItemText primary="My Sets" />
                                            </ListItem>
                                            <ListItem button onClick={() => navigate('/profile')}>
                                                <ListItemText primary={user.displayName || user.email} />
                                            </ListItem>
                                            <Divider />
                                            <ListItem button onClick={handleLogout}>
                                                <ListItemText primary="Log Out" />
                                            </ListItem>
                                        </>
                                    ) : (
                                        <ListItem button component={Link} to="/auth">
                                            <ListItemText primary="Log In / Sign Up" />
                                        </ListItem>
                                    )}
                                </List>
                            </Box>
                        </Drawer>
                    </Box>
                </Toolbar>
            </AppBar>
            <Container component="main" sx={{ flex: 1, py: { xs: 2, sm: 4 }, px: { xs: 0.5, sm: 2 }, width: '100%', maxWidth: '100vw' }}>
                {children}
            </Container>
        </Box>
    );
};

export default Layout; 