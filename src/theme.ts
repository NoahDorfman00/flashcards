import { createTheme, alpha } from '@mui/material';

// Brand tokens. Keep in sync with public/assets/*.svg and src/index.css.
export const brand = {
    green: '#0E7A62',
    greenDark: '#0A5A48',
    mint: '#7FE0CF',
    mintSoft: '#E3F6F0',
    ink: '#15201C',
    muted: '#5A6862',
    paper: '#F7F7F4',
    border: '#E3E6E1',
};

const fontFamily = ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'].join(',');

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: brand.green,
            dark: brand.greenDark,
            light: brand.mint,
            contrastText: '#fff',
        },
        secondary: {
            main: brand.ink,
        },
        background: {
            default: brand.paper,
            paper: '#fff',
        },
        text: {
            primary: brand.ink,
            secondary: brand.muted,
        },
        divider: brand.border,
        success: { main: '#1F8A4C' },
        warning: { main: '#B26A00' },
        error: { main: '#C8372D' },
    },
    shape: {
        borderRadius: 12,
    },
    typography: {
        fontFamily,
        h1: { fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08 },
        h2: { fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.12 },
        h3: { fontWeight: 800, letterSpacing: '-0.02em' },
        h4: { fontWeight: 700, letterSpacing: '-0.02em' },
        h5: { fontWeight: 700, letterSpacing: '-0.01em' },
        h6: { fontWeight: 700, letterSpacing: '-0.01em' },
        subtitle1: { fontWeight: 600 },
        button: { fontWeight: 700, textTransform: 'none', letterSpacing: 0 },
        overline: { fontWeight: 700, letterSpacing: '0.12em' },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: { backgroundColor: brand.paper },
            },
        },
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: { borderRadius: 999, paddingInline: 18 },
                sizeLarge: { paddingBlock: 12, paddingInline: 26, fontSize: 16 },
                outlined: { borderColor: brand.border, '&:hover': { borderColor: brand.muted } },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: { borderRadius: 12 },
            },
        },
        MuiPaper: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: { backgroundImage: 'none' },
                rounded: { borderRadius: 20 },
                outlined: { borderColor: brand.border },
            },
        },
        MuiCard: {
            defaultProps: { variant: 'outlined' },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 14,
                    backgroundColor: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: brand.border },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: brand.muted },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: { borderRadius: 20, margin: 16, width: 'calc(100% - 32px)', maxWidth: 440 },
            },
        },
        MuiDialogTitle: {
            styleOverrides: { root: { fontWeight: 700, paddingTop: 22 } },
        },
        MuiDialogActions: {
            styleOverrides: { root: { padding: '8px 20px 20px', gap: 4 } },
        },
        MuiAlert: {
            styleOverrides: { root: { borderRadius: 12 } },
        },
        MuiChip: {
            styleOverrides: { root: { fontWeight: 600 } },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 700,
                    border: 0,
                    borderRadius: 999,
                    color: brand.muted,
                    '&.Mui-selected': {
                        backgroundColor: '#fff',
                        color: brand.ink,
                        boxShadow: `0 1px 2px ${alpha(brand.ink, 0.08)}, 0 2px 8px ${alpha(brand.ink, 0.06)}`,
                        '&:hover': { backgroundColor: '#fff' },
                    },
                },
            },
        },
        MuiToggleButtonGroup: {
            styleOverrides: {
                root: { backgroundColor: alpha(brand.ink, 0.05), borderRadius: 999, padding: 4, gap: 4 },
                grouped: {
                    border: 0,
                    '&:not(:first-of-type)': { borderRadius: 999, marginLeft: 0 },
                    '&:not(:last-of-type)': { borderRadius: 999 },
                },
            },
        },
        MuiLinearProgress: {
            styleOverrides: {
                root: { borderRadius: 999, height: 6, backgroundColor: alpha(brand.ink, 0.07) },
                bar: { borderRadius: 999 },
            },
        },
    },
});

export default theme;
