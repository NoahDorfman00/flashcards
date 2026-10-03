import React from 'react';
import { Box, Typography } from '@mui/material';

// Inline copy of public/assets/logo.svg so it renders crisply with no extra request.
export const LogoMark: React.FC<{ size?: number }> = ({ size = 32 }) => (
    <Box component="svg" viewBox="0 0 64 64" sx={{ width: size, height: size, flexShrink: 0, display: 'block' }} aria-hidden>
        <g transform="translate(-1 2)">
            <rect x="7" y="12" width="40" height="28" rx="6" transform="rotate(-12 27 26)" fill="#7FE0CF" />
            <rect x="17" y="22" width="42" height="30" rx="6.5" fill="#0E7A62" />
            <path d="M38 27c1.1 5.2 3.3 7.4 8.5 8.5-5.2 1.1-7.4 3.3-8.5 8.5-1.1-5.2-3.3-7.4-8.5-8.5 5.2-1.1 7.4-3.3 8.5-8.5z" fill="#fff" />
        </g>
    </Box>
);

const Logo: React.FC<{ size?: number }> = ({ size = 32 }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LogoMark size={size} />
        <Typography component="span" sx={{ fontWeight: 800, fontSize: { xs: 17, sm: 18 }, letterSpacing: '-0.02em', color: 'text.primary', whiteSpace: 'nowrap' }}>
            Flashcard Generator
        </Typography>
    </Box>
);

export default Logo;
