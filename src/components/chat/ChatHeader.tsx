
import React from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Link,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { HEADER_TEXT } from '../../constants/textConstants';
import { ThemeToggle } from '../ThemeToggle';
import type { Mode } from '../../hooks/useAgentStatus';

type ChatHeaderProps = {
  mode: Mode;                         // current mode
  onModeChange: (m: Mode) => void;    // switch handler
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({ mode, onModeChange }) => {
  const handleModeChange = (_: React.MouseEvent<HTMLElement>, next: Mode | null) => {
    if (next) onModeChange(next);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderRadius: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <Container maxWidth="lg">
          <Box sx={{ py: 2, position: 'relative' }}>
            {/* Title row with logo + text + mode switch */}
            <Box
              sx={{
                display: 'flex',
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 2,
                mb: 1,
                pr: 7,
                flexWrap: 'wrap',
              }}
            >
              {/* Left: Logo + Titles */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <Box
                  component="img"
                  src={HEADER_TEXT.LOGO_PATH}
                  alt={HEADER_TEXT.LOGO_ALT}
                  sx={{
                    height: 80,
                    width: 'auto',
                    objectFit: 'contain',
                    imageRendering: 'crisp-edges',
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                    '@media (max-width: 600px)': { height: 64 },
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
                  <Typography
                    variant="h2"
                    component="h1"
                    sx={{
                      color: 'text.primary',
                      fontWeight: 600,
                      fontSize: { xs: '1.8rem', '@media (min-width: 2000px)': { fontSize: '2rem' } },
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {HEADER_TEXT.MAIN_TITLE}
                  </Typography>

                  {/* Tagline and Subtitle - Responsive Sizes */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      fontSize: { xs: '0.8rem', sm: '0.95rem', md: '1rem', '@media (min-width: 2000px)': { fontSize: '1.05rem' } },
                      fontWeight: 400,
                      opacity: 0.85,
                    }}
                  >
                    {/* left blank as original */}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      fontSize: { xs: '0.8rem', sm: '0.95rem', md: '1rem', '@media (min-width: 2000px)': { fontSize: '1.05rem' } },
                      fontWeight: 400,
                      opacity: 0.85,
                    }}
                  >
                    {HEADER_TEXT.SUBTITLE_PREFIX}{' '}
                    <Link
                      href={HEADER_TEXT.CORTEX_AGENTS_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 500,
                        '&:hover': { textDecoration: 'underline', color: 'primary.light' } }}
                    >
                      {HEADER_TEXT.SUBTITLE_MIDDLE}
                    </Link>
                    {' | '}{HEADER_TEXT.SUBTITLE_SUFFIX}{' '}
                    <Link
                      href={HEADER_TEXT.SUBTITLE_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'primary.main', textDecoration: 'none', fontWeight: 500,
                        '&:hover': { textDecoration: 'underline', color: 'primary.light' } }}
                    >
                      {HEADER_TEXT.SUBTITLE_DEVELOPER}
                    </Link>
                  </Typography>
                </Box>
              </Box>

              {/* Right: Mode toggle (Table/File) */}
              <ToggleButtonGroup
                exclusive
                color="primary"
                size="small"
                value={mode}
                onChange={handleModeChange}
                sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, mt: { xs: 1, sm: 0 } }}
              >
                <ToggleButton value="table">Table</ToggleButton>
                <ToggleButton value="file">File</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Theme Toggle - Aligned with container edge */}
            <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ThemeToggle />
            </Box>
          </Box>
        </Container>
      </Box>
    </Paper>
  );
};
