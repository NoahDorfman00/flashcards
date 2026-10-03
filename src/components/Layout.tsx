import React, { useState } from 'react';
import { AppBar, Toolbar, Container, Box, Button, CircularProgress, IconButton, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider, Typography, Avatar } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import Logo from './Logo';
import { brand } from '../theme';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user, loading, logout } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const go = (path: string) => {
        setDrawerOpen(false);
        navigate(path);
    };

    const navButtonSx = (path: string) => ({
        color: pathname === path ? 'text.primary' : 'text.secondary',
        bgcolor: pathname === path ? alpha(brand.ink, 0.06) : 'transparent',
        fontWeight: 700,
        px: 2,
        '&:hover': { bgcolor: alpha(brand.ink, 0.06), color: 'text.primary' },
    });

    const userLabel = user?.displayName || user?.email || '';
    const initial = userLabel.charAt(0).toUpperCase();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
            <AppBar
                position="sticky"
                elevation={0}
                sx={{
                    bgcolor: alpha(brand.paper, 0.85),
                    backdropFilter: 'saturate(180%) blur(12px)',
                    color: 'text.primary',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    pt: 'env(safe-area-inset-top)',
                }}
            >
                <Container maxWidth="lg">
                    <Toolbar disableGutters sx={{ minHeight: { xs: 60, sm: 68 }, gap: 2 }}>
                        <Box component={Link} to="/" sx={{ textDecoration: 'none', mr: 'auto', minWidth: 0 }} aria-label="Flashcard Generator home">
                            <Logo />
                        </Box>

                        {/* Desktop */}
                        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.5 }}>
                            {loading ? (
                                <CircularProgress size={20} />
                            ) : user ? (
                                <>
                                    <Button component={Link} to="/" sx={navButtonSx('/')}>Create</Button>
                                    <Button component={Link} to="/my-sets" sx={navButtonSx('/my-sets')}>My Sets</Button>
                                    <IconButton component={Link} to="/profile" aria-label="Profile" sx={{ ml: 1, p: 0.5 }}>
                                        <Avatar src={user.photoURL || undefined} sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 15, fontWeight: 700 }}>
                                            {initial}
                                        </Avatar>
                                    </IconButton>
                                </>
                            ) : (
                                <>
                                    <Button component={Link} to="/auth" sx={navButtonSx('/auth')}>Log in</Button>
                                    <Button component={Link} to="/auth?mode=signup" variant="contained" sx={{ ml: 0.5 }}>
                                        Sign up free
                                    </Button>
                                </>
                            )}
                        </Box>

                        {/* Mobile */}
                        <IconButton
                            sx={{ display: { xs: 'inline-flex', sm: 'none' }, mr: -1 }}
                            onClick={() => setDrawerOpen(true)}
                            aria-label="Open menu"
                        >
                            <MenuRoundedIcon />
                        </IconButton>
                    </Toolbar>
                </Container>
            </AppBar>

            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                PaperProps={{ sx: { width: 'min(320px, 85vw)', borderRadius: '20px 0 0 20px', pt: 'env(safe-area-inset-top)', pb: 'env(safe-area-inset-bottom)' } }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
                    <Typography sx={{ fontWeight: 800 }}>Menu</Typography>
                    <IconButton onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                        <CloseRoundedIcon />
                    </IconButton>
                </Box>
                {user && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, pb: 2 }}>
                        <Avatar src={user.photoURL || undefined} sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 700 }}>{initial}</Avatar>
                        <Typography variant="body2" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userLabel}</Typography>
                    </Box>
                )}
                <Divider />
                <List sx={{ px: 1, '& .MuiListItemButton-root': { borderRadius: '12px', py: 1.25 }, '& .MuiListItemText-primary': { fontWeight: 600 } }}>
                    <ListItemButton selected={pathname === '/'} onClick={() => go('/')}>
                        <ListItemIcon><AutoAwesomeRoundedIcon /></ListItemIcon>
                        <ListItemText primary="Create flashcards" />
                    </ListItemButton>
                    {loading ? (
                        <Box sx={{ p: 2 }}><CircularProgress size={20} /></Box>
                    ) : user ? (
                        <>
                            <ListItemButton selected={pathname === '/my-sets'} onClick={() => go('/my-sets')}>
                                <ListItemIcon><CollectionsBookmarkRoundedIcon /></ListItemIcon>
                                <ListItemText primary="My sets" />
                            </ListItemButton>
                            <ListItemButton selected={pathname === '/profile'} onClick={() => go('/profile')}>
                                <ListItemIcon><PersonRoundedIcon /></ListItemIcon>
                                <ListItemText primary="Profile & subscription" />
                            </ListItemButton>
                            <Divider sx={{ my: 1 }} />
                            <ListItemButton onClick={() => { setDrawerOpen(false); handleLogout(); }}>
                                <ListItemIcon><LogoutRoundedIcon /></ListItemIcon>
                                <ListItemText primary="Log out" />
                            </ListItemButton>
                        </>
                    ) : (
                        <ListItemButton selected={pathname === '/auth'} onClick={() => go('/auth')}>
                            <ListItemIcon><LoginRoundedIcon /></ListItemIcon>
                            <ListItemText primary="Log in / Sign up" />
                        </ListItemButton>
                    )}
                </List>
            </Drawer>

            <Container
                component="main"
                maxWidth="lg"
                sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: { xs: 3, sm: 6 }, pb: { xs: 'calc(24px + env(safe-area-inset-bottom))', sm: 6 } }}
            >
                {children}
            </Container>
        </Box>
    );
};

export default Layout;
