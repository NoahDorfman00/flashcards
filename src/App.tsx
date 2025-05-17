import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import Layout from './components/Layout';
import Home from './pages/Home';
import Study from './pages/Study';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import MySets from './pages/MySets';
import { AuthProvider } from './context/AuthContext';

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#19c2b2',
        },
        secondary: {
            main: '#145a43',
        },
        background: {
            default: 'transparent',
            paper: '#fff',
        },
        text: {
            primary: '#0a3c2f',
            secondary: '#145a43',
        },
    },
    shape: {
        borderRadius: 18,
    },
    typography: {
        fontFamily: [
            'Inter',
            'system-ui',
            'sans-serif',
        ].join(','),
        fontWeightBold: 700,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 18,
                    fontWeight: 700,
                    textTransform: 'none',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 18,
                    boxShadow: '0 4px 24px 0 rgba(10,60,47,0.08)',
                },
            },
        },
    },
});

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
                <Router>
                    <Layout>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/study" element={<Study />} />
                            <Route path="/auth" element={<Auth />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/my-sets" element={<MySets />} />
                        </Routes>
                    </Layout>
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App; 