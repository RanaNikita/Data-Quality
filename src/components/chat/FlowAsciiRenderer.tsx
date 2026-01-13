

// import React from 'react';
// import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';

// type FlowNode = { id: number; lines: string[] };

// /**
//  * parseAsciiFlow
//  * Very lightweight parser for vertical ASCII box flows.
//  * It looks for blocks like:
//  *
//  * +------------+
//  * | Title      |
//  * | - bullet   |
//  * +------------+
//  *     |
//  *     v
//  * +------------+
//  * | Next ...   |
//  * +------------+
//  */
// function parseAsciiFlow(input: string): FlowNode[] {
//   const lines = input.split('\n');
//   const nodes: FlowNode[] = [];
//   let i = 0;
//   let id = 1;

//   while (i < lines.length) {
//     const line = lines[i];

//     // Detect the top border of a box: +----...----+
//     if (/^\s*\+[-+]+\+\s*$/.test(line)) {
//       i++;

//       const content: string[] = [];

//       // Collect interior lines: | ... |
//       while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
//         // Strip leading/trailing pipes while preserving inner text
//         const raw = lines[i].trim();
//         const middle = raw.slice(1, raw.length - 1).trim();
//         content.push(middle);
//         i++;
//       }

//       // Expect bottom border of the box: +----...----+
//       if (i < lines.length && /^\s*\+[-+]+\+\s*$/.test(lines[i])) {
//         nodes.push({ id: id++, lines: content });
//       }
//     }

//     i++;
//   }

//   return nodes;
// }

// const Arrow: React.FC = () => {
//   const theme = useTheme();
//   return (
//     <Box
//       aria-hidden
//       sx={{
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center',
//         my: 1.5,
//       }}
//     >
//       {/* vertical connector */}
//       <Box
//         sx={{
//           width: 2,
//           height: 16,
//           bgcolor: theme.palette.divider,
//         }}
//       />
//       {/* arrow head */}
//       <Box
//         sx={{
//           width: 0,
//           height: 0,
//           borderLeft: '6px solid transparent',
//           borderRight: '6px solid transparent',
//           borderTop: `8px solid ${theme.palette.divider}`,
//           mt: '-2px',
//         }}
//       />
//     </Box>
//   );
// };

// const FlowCard: React.FC<{ node: FlowNode }> = ({ node }) => {
//   const title = node.lines[0] || `Step ${node.id}`;
//   const details = node.lines.slice(1).filter(Boolean);

//   return (
//     <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
//       <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
//         <Typography variant="subtitle1" fontWeight={700}>
//           {title}
//         </Typography>

//         {details.length > 0 && (
//           <Box component="ul" sx={{ pl: 2, mb: 0, mt: 0.5 }}>
//             {details.map((d, idx) => (
//               <Typography
//                 key={idx}
//                 component="li"
//                 variant="body2"
//                 sx={{ lineHeight: 1.6, wordBreak: 'break-word' }}
//               >
//                 {/* Remove a leading dash if present: "- bullet" -> "bullet" */}
//                 {d.replace(/^\-\s*/, '').trim()}
//               </Typography>
//             ))}
//           </Box>
//         )}
//       </CardContent>
//     </Card>
//   );
// };

// interface FlowAsciiRendererProps {
//   /** The raw ASCII box flow text */
//   ascii: string;
//   /** Optional title shown above the rendered flow */
//   title?: string;
// }

// /**
//  * FlowAsciiRenderer
//  * Renders parsed ASCII flow as a vertical stack of MUI cards with arrows.
//  * If parsing fails (no boxes detected), it gracefully falls back to showing
//  * the raw ASCII in a monospace container.
//  */
// const FlowAsciiRenderer: React.FC<FlowAsciiRendererProps> = ({ ascii, title }) => {
//   const nodes = parseAsciiFlow(ascii);

//   if (nodes.length === 0) {
//     // Fallback: show as monospace if we couldn't parse
//     return (
//       <Box
//         sx={(t) => ({
//           p: 2,
//           borderRadius: 1,
//           border: `1px solid ${t.palette.divider}`,
//           bgcolor: 'background.paper',
//           whiteSpace: 'pre-wrap',
//           fontFamily: 'monospace',
//           fontSize: '0.9rem',
//         })}
//       >
//         {ascii}
//       </Box>
//     );
//   }

//   return (
//     <Box
//       sx={(t) => ({
//         p: 2,
//         borderRadius: 1,
//         border: `1px solid ${t.palette.divider}`,
//         bgcolor: 'background.paper',
//       })}
//     >
//       {title && (
//         <Typography variant="h6" sx={{ mb: 1.5 }}>
//           {title}
//         </Typography>
//       )}

//       <Box sx={{ display: 'flex', flexDirection: 'column' }}>
//         {nodes.map((n, idx) => (
//           <React.Fragment key={n.id}>
//             <FlowCard node={n} />
//             {idx < nodes.length - 1 && <Arrow />}
//           </React.Fragment>
//         ))}
//       </Box>
//     </Box>
//   );
// };

// export default FlowAsciiRenderer;



import React from 'react';
import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';

type FlowNode = { id: number; lines: string[] };

/**
 * parseAsciiFlow – parses vertical ASCII boxes into nodes.
 */
function parseAsciiFlow(input: string): FlowNode[] {
  const lines = input.split('\n');
  const nodes: FlowNode[] = [];
  let i = 0;
  let id = 1;

  while (i < lines.length) {
    const line = lines[i];

    // Detect the top border of a box: +----...----+
    if (/^\s*\+[-+]+\+\s*$/.test(line)) {
      i++;

      const content: string[] = [];

      // Collect interior lines: | ... |
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const raw = lines[i].trim();
        const middle = raw.slice(1, raw.length - 1).trim();
        content.push(middle);
        i++;
      }

      // Expect bottom border of the box
      if (i < lines.length && /^\s*\+[-+]+\+\s*$/.test(lines[i])) {
        nodes.push({ id: id++, lines: content });
      }
    }

    i++;
  }

  return nodes;
}

/** Vertical down arrow with darker tone */
const Arrow: React.FC = () => {
  const theme = useTheme();
  const arrowColor =
    theme.palette.mode === 'dark'
      ? theme.palette.text.secondary
      : theme.palette.text.primary; // darker in light mode

  return (
    <Box
      aria-hidden
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        my: 2,
      }}
    >
      {/* vertical line */}
      <Box
        sx={{
          width: 2,
          height: 18,
          bgcolor: arrowColor,
          opacity: 0.7,
        }}
      />
      {/* arrow head */}
      <Box
        sx={{
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: `10px solid ${arrowColor}`,
          ml: 0.5,
          opacity: 0.7,
        }}
      />
    </Box>
  );
};

const FlowCard: React.FC<{ node: FlowNode }> = ({ node }) => {
  const theme = useTheme();
  const title = node.lines[0] || `Step ${node.id}`;
  const details = node.lines.slice(1).filter(Boolean);

  // darker border token
  const borderColor =
    theme.palette.mode === 'dark'
      ? theme.palette.text.secondary
      : theme.palette.text.primary;

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: borderColor,
        // add subtle shadow to lift boxes
        boxShadow: theme.palette.mode === 'dark' ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
      }}
    >
      <CardContent
        sx={{
          py: 2,
          '&:last-child': { pb: 2 },
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={800}
          align="center"
          sx={{
            textTransform: 'none',
            letterSpacing: 0.1,
          }}
        >
          {title}
        </Typography>

        {details.length > 0 && (
          <Box
            component="ul"
            sx={{
              listStylePosition: 'inside', // bullets inside
              pl: 0,
              mt: 1,
              mb: 0,
              textAlign: 'center', // center items
            }}
          >
            {details.map((d, idx) => (
              <Typography
                key={idx}
                component="li"
                variant="body2"
                sx={{
                  lineHeight: 1.7,
                  wordBreak: 'break-word',
                  m: 0.5,
                }}
              >
                {d.replace(/^\-\s*/, '').trim()}
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

interface FlowAsciiRendererProps {
  ascii: string;
  title?: string;
}

/**
 * FlowAsciiRenderer – renders parsed ASCII flow as centered MUI cards with
 * darker borders and vertical arrows. Falls back to monospace if parsing fails.
 */
const FlowAsciiRenderer: React.FC<FlowAsciiRendererProps> = ({ ascii, title }) => {
  const theme = useTheme();
  const nodes = parseAsciiFlow(ascii);

  // container border darker too
  const containerBorder =
    theme.palette.mode === 'dark'
      ? theme.palette.text.secondary
      : theme.palette.text.primary;

  if (nodes.length === 0) {
    // Fallback: raw monospace block
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: `2px solid ${containerBorder}`,
          bgcolor: 'background.paper',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '0.95rem',
          textAlign: 'center',
        }}
      >
        {ascii}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: `2px solid ${containerBorder}`,
        bgcolor: 'background.paper',
      }}
    >
      {title && (
        <Typography variant="h6" align="center" sx={{ mb: 1.5, fontWeight: 800 }}>
          {title}
        </Typography>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {nodes.map((n, idx) => (
          <React.Fragment key={n.id}>
            <FlowCard node={n} />
            {idx < nodes.length - 1 && <Arrow />}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

export default FlowAsciiRenderer;
