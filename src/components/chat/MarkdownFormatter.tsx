// /**
//  * MarkdownFormatter Component
//  * Handles rendering of markdown content from API responses
//  */
 
// import React from 'react';
// import { Box, Typography, Paper, Link, alpha, Theme } from '@mui/material';
// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
 
// interface MarkdownFormatterProps {
//   content: string;
//   theme: Theme;
// }
 
// export const MarkdownFormatter: React.FC<MarkdownFormatterProps> = ({ content, theme }) => {
//   if (!content) return null;
 
//   const borderColor = theme.palette.divider;
 
//   return (
//     <ReactMarkdown
//       remarkPlugins={[remarkGfm]}
//       components={{
//         // Style paragraphs
//         p: ({ children }) => (
//           <Typography
//             variant="body2"
//             sx={{
//               lineHeight: 1.7,
//               fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//               mb: 1.5,
//               '&:last-child': { mb: 0 },
//               wordWrap: 'break-word',
//               overflowWrap: 'break-word',
//               hyphens: 'auto',
//             }}
//           >
//             {children as React.ReactNode}
//           </Typography>
//         ),
 
//         // Style bold text from API
//         strong: ({ children }) => (
//           <Typography
//             component="span"
//             sx={{
//               fontWeight: 700,
//               color: 'text.primary',
//               fontSize: 'inherit',
//             }}
//           >
//             {children as React.ReactNode}
//           </Typography>
//         ),
 
//         // Style italic text from API
//         em: ({ children }) => (
//           <Typography
//             component="span"
//             sx={{
//               fontStyle: 'italic',
//               fontSize: 'inherit',
//             }}
//           >
//             {children as React.ReactNode}
//           </Typography>
//         ),
 
//         // Style unordered lists from API
//         ul: ({ children }) => (
//           <Box
//             component="ul"
//             sx={{
//               margin: 0,
//               paddingLeft: 2,
//               '& li': {
//                 marginBottom: 0.75,
//                 fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//                 lineHeight: 1.7,
//                 wordWrap: 'break-word',
//                 overflowWrap: 'break-word',
//               },
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),
 
//         // Style ordered lists from API
//         ol: ({ children }) => (
//           <Box
//             component="ol"
//             sx={{
//               margin: 0,
//               paddingLeft: 2,
//               '& li': {
//                 marginBottom: 0.75,
//                 fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//                 lineHeight: 1.7,
//                 wordWrap: 'break-word',
//                 overflowWrap: 'break-word',
//               },
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),
 
//         // Style list items from API
//         li: ({ children }) => (
//           <Typography
//             component="li"
//             sx={{
//               fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//               lineHeight: 1.7,
//               mb: 0.75,
//               '&:last-child': { mb: 0 },
//               wordWrap: 'break-word',
//               overflowWrap: 'break-word',
//             }}
//           >
//             {children as React.ReactNode}
//           </Typography>
//         ),
 
//         // Style inline and block code from API
//         code: ({ children, inline }: { children?: React.ReactNode; inline?: boolean }) =>
//           inline ? (
//             <Typography
//               component="code"
//               sx={{
//                 backgroundColor: alpha(theme.palette.grey[500], 0.1),
//                 padding: '2px 4px',
//                 borderRadius: 0.5,
//                 fontSize: '0.9em',
//                 fontFamily: 'monospace',
//               }}
//             >
//               {children as React.ReactNode}
//             </Typography>
//           ) : (
//             <Paper
//               sx={{
//                 p: 1.5,
//                 backgroundColor: alpha(theme.palette.grey[500], 0.1),
//                 fontFamily: 'monospace',
//                 fontSize: '0.9em',
//                 borderRadius: 1,
//               }}
//             >
//               <Typography component="pre" sx={{ margin: 0, fontSize: 'inherit' }}>
//                 {children as React.ReactNode}
//               </Typography>
//             </Paper>
//           ),
 
//         // Style links from API (if any)
//         a: ({ href, children }) => (
//           <Link
//             href={href as string}
//             target="_blank"
//             rel="noopener noreferrer"
//             sx={{
//               color: 'primary.main',
//               textDecoration: 'none',
//               '&:hover': { textDecoration: 'underline' },
//             }}
//           >
//             {children as React.ReactNode}
//           </Link>
//         ),
 
//         /* ----------------------------- TABLES ----------------------------- */
//         // Table container (adds horizontal scroll on small screens)
//         table: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="div"
//             sx={{
//               width: '100%',
//               overflowX: 'auto',
//               my: 2,
//               border: `1px solid ${borderColor}`,
//               borderRadius: 1,
//               boxShadow: theme.palette.mode === 'light' ? 1 : 'none',
//             }}
//           >
//             <Box
//               component="table"
//               sx={{
//                 width: '100%',
//                 borderCollapse: 'collapse',
//                 backgroundColor: 'background.paper',
//               }}
//             >
//               {children as React.ReactNode}
//             </Box>
//           </Box>
//         ),
 
//         thead: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="thead"
//             sx={{
//               backgroundColor:
//                 theme.palette.mode === 'dark'
//                   ? alpha(theme.palette.primary.light, 0.08)
//                   : alpha(theme.palette.primary.main, 0.06),
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),
 
//         tbody: ({ children }: { children?: React.ReactNode }) => (
//           <Box component="tbody">{children as React.ReactNode}</Box>
//         ),
 
//         tr: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="tr"
//             sx={{
//               '&:nth-of-type(even)': {
//                 backgroundColor:
//                   theme.palette.mode === 'dark'
//                     ? alpha(theme.palette.grey[700], 0.2)
//                     : alpha(theme.palette.grey[200], 0.3),
//               },
//               '&:hover': {
//                 backgroundColor:
//                   theme.palette.mode === 'dark'
//                     ? alpha(theme.palette.primary.dark, 0.15)
//                     : alpha(theme.palette.primary.light, 0.15),
//               },
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),
 
//         th: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="th"
//             sx={{
//               textAlign: 'left',
//               fontWeight: 700,
//               fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//               color: 'text.primary',
//               borderBottom: `1px solid ${borderColor}`,
//               borderRight: `1px solid ${borderColor}`,
//               p: 1,
//               whiteSpace: 'nowrap',
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),
 
//         td: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="td"
//             sx={{
//               fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//               color: 'text.secondary',
//               borderTop: `1px solid ${borderColor}`,
//               borderRight: `1px solid ${borderColor}`,
//               p: 1,
//               verticalAlign: 'top',
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),
//         /* ------------------------------------------------------------------ */
//       }}
//     >
//       {content}
//     </ReactMarkdown>
//   );
// };
 
 

// giving table format 

/**
 * MarkdownFormatter Component
 * Handles rendering of markdown content from API responses
 */
import React from 'react';
import { Box, Typography, Paper, Link, alpha, Theme } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FlowAsciiRenderer from './FlowAsciiRenderer'; // ⬅️ NEW: adjust path if needed

interface MarkdownFormatterProps {
  content: string;
  theme: Theme;
}

export const MarkdownFormatter: React.FC<MarkdownFormatterProps> = ({ content, theme }) => {
  if (!content) return null;
  const borderColor = theme.palette.divider;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // paragraphs
        p: ({ children }) => (
          <Typography
            variant="body2"
            sx={{
              lineHeight: 1.7,
              fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
              mb: 1.5,
              '&:last-child': { mb: 0 },
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              hyphens: 'auto',
            }}
          >
            {children as React.ReactNode}
          </Typography>
        ),

        // bold
        strong: ({ children }) => (
          <Typography
            component="span"
            sx={{ fontWeight: 700, color: 'text.primary', fontSize: 'inherit' }}
          >
            {children as React.ReactNode}
          </Typography>
        ),

        // italic
        em: ({ children }) => (
          <Typography component="span" sx={{ fontStyle: 'italic', fontSize: 'inherit' }}>
            {children as React.ReactNode}
          </Typography>
        ),

        // unordered list
        ul: ({ children }) => (
          <Box
            component="ul"
            sx={{
              margin: 0,
              paddingLeft: 2,
              '& li': {
                marginBottom: 0.75,
                fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
                lineHeight: 1.7,
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
              },
            }}
          >
            {children as React.ReactNode}
          </Box>
        ),

        // ordered list
        ol: ({ children }) => (
          <Box
            component="ol"
            sx={{
              margin: 0,
              paddingLeft: 2,
              '& li': {
                marginBottom: 0.75,
                fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
                lineHeight: 1.7,
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
              },
            }}
          >
            {children as React.ReactNode}
          </Box>
        ),

        // list item
        li: ({ children }) => (
          <Typography
            component="li"
            sx={{
              fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
              lineHeight: 1.7,
              mb: 0.75,
              '&:last-child': { mb: 0 },
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {children as React.ReactNode}
          </Typography>
        ),

        // code (inline + block) with ASCII-flow auto-detection
        code: ({
          children,
          inline,
          className,
        }: {
          children?: React.ReactNode;
          inline?: boolean;
          className?: string;
        }) => {
          const codeText = String(children ?? '');
          const lang = (className ?? '').replace('language-', '').trim().toLowerCase();

          // Heuristic: detect an ASCII flow block (untagged)
          const looksLikeAsciiFlow =
            /^\s*\+[-+]+\+[\s\S]*\+[-+]+\+\s*$/m.test(codeText);

          // If this is a fenced (non-inline) code block and it looks like ASCII boxes,
          // render our custom flow component instead of monospaced text.
          if (!inline && (looksLikeAsciiFlow || lang === 'ascii-flow' || lang === 'asciiflow')) {
            return (
              <FlowAsciiRenderer
                ascii={codeText}
                title="Data Quality Pipeline Flow Diagram"
              />
            );
          }

          // Otherwise keep your original code styling
          return inline ? (
            <Typography
              component="code"
              sx={{
                backgroundColor: alpha(theme.palette.grey[500], 0.1),
                padding: '2px 4px',
                borderRadius: 0.5,
                fontSize: '0.9em',
                fontFamily: 'monospace',
              }}
            >
              {children as React.ReactNode}
            </Typography>
          ) : (
            <Paper
              sx={{
                p: 1.5,
                backgroundColor: alpha(theme.palette.grey[500], 0.1),
                fontFamily: 'monospace',
                fontSize: '0.9em',
                borderRadius: 1,
              }}
            >
              <Typography component="pre" sx={{ margin: 0, fontSize: 'inherit' }}>
                {children as React.ReactNode}
              </Typography>
            </Paper>
          );
        },

        // links
        a: ({ href, children }) => (
          <Link
            href={href as string}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {children as React.ReactNode}
          </Link>
        ),

        /* ----------------------------- TABLES ----------------------------- */
        table: ({ children }: { children?: React.ReactNode }) => (
          <Box
            component="div"
            sx={{
              width: '100%',
              overflowX: 'auto',
              my: 2,
              border: `1px solid ${borderColor}`,
              borderRadius: 1,
              boxShadow: theme.palette.mode === 'light' ? 1 : 'none',
            }}
          >
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                backgroundColor: 'background.paper',
              }}
            >
              {children as React.ReactNode}
            </Box>
          </Box>
        ),

        thead: ({ children }: { children?: React.ReactNode }) => (
          <Box
            component="thead"
            sx={{
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.light, 0.08)
                  : alpha(theme.palette.primary.main, 0.06),
            }}
          >
            {children as React.ReactNode}
          </Box>
        ),

        tbody: ({ children }: { children?: React.ReactNode }) => (
          <Box component="tbody">{children as React.ReactNode}</Box>
        ),

        tr: ({ children }: { children?: React.ReactNode }) => (
          <Box
            component="tr"
            sx={{
              '&:nth-of-type(even)': {
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.grey[700], 0.2)
                    : alpha(theme.palette.grey[200], 0.3),
              },
              '&:hover': {
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.dark, 0.15)
                    : alpha(theme.palette.primary.light, 0.15),
              },
            }}
          >
            {children as React.ReactNode}
          </Box>
        ),

        th: ({ children }: { children?: React.ReactNode }) => (
          <Box
            component="th"
            sx={{
              textAlign: 'left',
              fontWeight: 700,
              fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
              color: 'text.primary',
              borderBottom: `1px solid ${borderColor}`,
              borderRight: `1px solid ${borderColor}`,
              p: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {children as React.ReactNode}
          </Box>
        ),

        td: ({ children }: { children?: React.ReactNode }) => (
          <Box
            component="td"
            sx={{
              fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
              color: 'text.secondary',
              borderTop: `1px solid ${borderColor}`,
              borderRight: `1px solid ${borderColor}`,
              p: 1,
              verticalAlign: 'top',
            }}
          >
            {children as React.ReactNode}
          </Box>
        ),
        /* ------------------------------------------------------------------ */
      }}
    >
      {content}
    </ReactMarkdown>
  );
};


//  second try earlier giving but new compatible 


// /**
//  * MarkdownFormatter Component
//  * Handles rendering of markdown content from API responses
//  */
// import React from 'react';
// import { Box, Typography, Paper, Link, alpha, Theme } from '@mui/material';
// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
// import FlowAsciiRenderer from './FlowAsciiRenderer';

// interface MarkdownFormatterProps {
//   content: string;
//   theme: Theme;
// }

// export const MarkdownFormatter: React.FC<MarkdownFormatterProps> = ({ content, theme }) => {
//   if (!content) return null;
//   const borderColor = theme.palette.divider;

//   return (
//     <ReactMarkdown
//       remarkPlugins={[remarkGfm]}
//       components={{
//         // paragraphs
//         p: ({ children }) => (
//           <Typography
//             variant="body2"
//             sx={{
//               lineHeight: 1.7,
//               fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//               mb: 1.5,
//               '&:last-child': { mb: 0 },
//               wordWrap: 'break-word',
//               overflowWrap: 'break-word',
//               hyphens: 'auto',
//             }}
//           >
//             {children as React.ReactNode}
//           </Typography>
//         ),

//         // bold
//         strong: ({ children }) => (
//           <Typography component="span" sx={{ fontWeight: 700, color: 'text.primary', fontSize: 'inherit' }}>
//             {children as React.ReactNode}
//           </Typography>
//         ),

//         // italic
//         em: ({ children }) => (
//           <Typography component="span" sx={{ fontStyle: 'italic', fontSize: 'inherit' }}>
//             {children as React.ReactNode}
//           </Typography>
//         ),

//         // ul
//         ul: ({ children }) => (
//           <Box
//             component="ul"
//             sx={{
//               margin: 0,
//               paddingLeft: 2,
//               '& li': {
//                 marginBottom: 0.75,
//                 fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//                 lineHeight: 1.7,
//                 wordWrap: 'break-word',
//                 overflowWrap: 'break-word',
//               },
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),

//         // ol
//         ol: ({ children }) => (
//           <Box
//             component="ol"
//             sx={{
//               margin: 0,
//               paddingLeft: 2,
//               '& li': {
//                 marginBottom: 0.75,
//                 fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//                 lineHeight: 1.7,
//                 wordWrap: 'break-word',
//                 overflowWrap: 'break-word',
//               },
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),

//         // li
//         li: ({ children }) => (
//           <Typography
//             component="li"
//             sx={{
//               fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//               lineHeight: 1.7,
//               mb: 0.75,
//               '&:last-child': { mb: 0 },
//               wordWrap: 'break-word',
//               overflowWrap: 'break-word',
//             }}
//           >
//             {children as React.ReactNode}
//           </Typography>
//         ),

//         // code (inline + block) — auto-detect ASCII boxes and render FlowAsciiRenderer
//         code: ({
//           children,
//           inline,
//           className,
//         }: {
//           children?: React.ReactNode;
//           inline?: boolean;
//           className?: string;
//         }) => {
//           const codeText = String(children ?? '');
//           const lang = (className ?? '').replace('language-', '').trim().toLowerCase();

//           // Heuristic: untagged ASCII boxes
//           const looksLikeAsciiFlow = /^\s*\+[-+]+\+[\s\S]*\+[-+]+\+\s*$/m.test(codeText);

//           if (!inline && (looksLikeAsciiFlow || lang === 'ascii-flow' || lang === 'asciiflow')) {
//             return (
//               <FlowAsciiRenderer
//                 ascii={codeText}
//                 title="Data Quality Pipeline Flow Diagram"
//               />
//             );
//           }

//           // inline code
//           if (inline) {
//             return (
//               <Typography
//                 component="code"
//                 sx={{
//                   backgroundColor: alpha(theme.palette.grey[500], 0.1),
//                   padding: '2px 4px',
//                   borderRadius: 0.5,
//                   fontSize: '0.9em',
//                   fontFamily: 'monospace',
//                 }}
//               >
//                 {children as React.ReactNode}
//               </Typography>
//             );
//           }

//           // block code (non-flow)
//           return (
//             <Paper
//               sx={{
//                 p: 1.5,
//                 backgroundColor: alpha(theme.palette.grey[500], 0.1),
//                 fontFamily: 'monospace',
//                 fontSize: '0.9em',
//                 borderRadius: 1,
//               }}
//             >
//               <Typography component="pre" sx={{ margin: 0, fontSize: 'inherit' }}>
//                 {children as React.ReactNode}
//               </Typography>
//             </Paper>
//           );
//         },

//         // links
//         a: ({ href, children }) => (
//           <Link
//             href={href as string}
//             target="_blank"
//             rel="noopener noreferrer"
//             sx={{
//               color: 'primary.main',
//               textDecoration: 'none',
//               '&:hover': { textDecoration: 'underline' },
//             }}
//           >
//             {children as React.ReactNode}
//           </Link>
//         ),

//         /* ----------------------------- TABLES ----------------------------- */
//         table: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="div"
//             sx={{
//               width: '100%',
//               overflowX: 'auto',
//               my: 2,
//               border: `1px solid ${borderColor}`,
//               borderRadius: 1,
//               boxShadow: theme.palette.mode === 'light' ? 1 : 'none',
//             }}
//           >
//             <Box
//               component="table"
//               sx={{
//                 width: '100%',
//                 borderCollapse: 'collapse',
//                 backgroundColor: 'background.paper',
//               }}
//             >
//               {children as React.ReactNode}
//             </Box>
//           </Box>
//         ),

//         thead: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="thead"
//             sx={{
//               backgroundColor:
//                 theme.palette.mode === 'dark'
//                   ? alpha(theme.palette.primary.light, 0.08)
//                   : alpha(theme.palette.primary.main, 0.06),
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),

//         tbody: ({ children }: { children?: React.ReactNode }) => (
//           <Box component="tbody">{children as React.ReactNode}</Box>
//         ),

//         tr: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="tr"
//             sx={{
//               '&:nth-of-type(even)': {
//                 backgroundColor:
//                   theme.palette.mode === 'dark'
//                     ? alpha(theme.palette.grey[700], 0.2)
//                     : alpha(theme.palette.grey[200], 0.3),
//               },
//               '&:hover': {
//                 backgroundColor:
//                   theme.palette.mode === 'dark'
//                     ? alpha(theme.palette.primary.dark, 0.15)
//                     : alpha(theme.palette.primary.light, 0.15),
//               },
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),

//         th: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="th"
//             sx={{
//               textAlign: 'left',
//               fontWeight: 700,
//               fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//               color: 'text.primary',
//               borderBottom: `1px solid ${borderColor}`,
//               borderRight: `1px solid ${borderColor}`,
//               p: 1,
//               whiteSpace: 'nowrap',
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),

//         td: ({ children }: { children?: React.ReactNode }) => (
//           <Box
//             component="td"
//             sx={{
//               fontSize: { xs: '0.9rem', sm: '1rem', '@media (min-width: 2000px)': { fontSize: '0.875rem' } },
//               color: 'text.secondary',
//               borderTop: `1px solid ${borderColor}`,
//               borderRight: `1px solid ${borderColor}`,
//               p: 1,
//               verticalAlign: 'top',
//             }}
//           >
//             {children as React.ReactNode}
//           </Box>
//         ),
//         /* ------------------------------------------------------------------ */
//       }}
//     >
//       {content}
//     </ReactMarkdown>
//   );
// };
