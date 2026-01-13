

// src/components/StatusSidebar.tsx
// import React from 'react';
// import {
//   Drawer,
//   List,
//   ListItem,
//   ListItemIcon,
//   ListItemText,
//   Chip,
//   Box,
//   Typography,
//   Divider,
// } from '@mui/material';
// import CircleIcon from '@mui/icons-material/Circle';
// import type { AgentStatusMap } from '../types/agentStatus';

// type Props = {
//   title: string;               // e.g., "Table Agents" or "File Agents"
//   status: AgentStatusMap;      // map of DisplayLabel -> 'pending'|'running'|'success'|'error'
//   width?: number;              // default 280
//   showTitleDivider?: boolean;  // default true
// };

// const colorForChip = (state: string) => {
//   switch (state) {
//     case 'running': return 'info';
//     case 'success': return 'success';
//     case 'error': return 'error';
//     default: return 'default'; // pending
//   }
// };

// const dotColor = (state: string) => {
//   switch (state) {
//     case 'running': return '#0288d1';
//     case 'success': return '#2e7d32';
//     case 'error': return '#d32f2f';
//     default: return 'rgba(218, 232, 19, 1)';
//   }
// };

// export default function StatusSidebar({
//   title,
//   status,
//   width = 280,
//   showTitleDivider = true,
// }: Props) {
//   const items = Object.entries(status); // [[label, state], ...]

//   return (
//     <Drawer variant="permanent" anchor="left" PaperProps={{ style: { width } }}>
//       <Box px={2} py={2}>
//         <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
//           {title}
//         </Typography>
//       </Box>

//       {showTitleDivider && <Divider />}

//       <List dense>
//         {items.map(([label, state]) => (
//           <ListItem key={label} sx={{ py: 0.5 }}>
//             <ListItemIcon sx={{ minWidth: 32 }}>
//               <CircleIcon sx={{ color: dotColor(state) }} fontSize="small" />
//             </ListItemIcon>

//             <ListItemText
//               primary={label}
//               primaryTypographyProps={{ variant: 'body2' }}
//             />

//             <Chip
//               label={state}
//               size="small"
//               color={colorForChip(state) as any}
//               variant={state === 'pending' ? 'outlined' : 'filled'}
//             />
//           </ListItem>
//         ))}
//       </List>
//     </Drawer>
//   );
// }
//_________________________________________new code below






// src/components/StatusSidebar.tsx
import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import type { AgentStatusMap } from '../types/agentStatus';

type Props = {
  title: string;               // e.g., "Table Agents" or "File Agents"
  status: AgentStatusMap;      // label -> 'pending'|'running'|'success'|'error'
  width?: number;              // default 280
  showTitleDivider?: boolean;  // default true
};

const colorForChip = (state: string) => {
  switch (state) {
    case 'running': return 'info';
    case 'success': return 'success';
    case 'error': return 'error';
    default: return 'default'; // pending
  }
};

const dotColor = (state: string) => {
  switch (state) {
    case 'running': return '#0288d1';
    case 'success': return '#2e7d32';
    case 'error': return '#d32f2f';
    default: return '#9e9e9e'; // pending
  }
};

export default function StatusSidebar({
  title,
  status,
  width = 280,
  showTitleDivider = true,
}: Props) {
  const items = Object.entries(status); // [[label, state], ...]

  return (
    <Drawer variant="permanent" anchor="left" PaperProps={{ style: { width } }}>
      <Box px={2} py={2}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>

      {showTitleDivider && <Divider />}

      <List dense>
        {items.map(([label, state]) => (
          <ListItem key={label} sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <CircleIcon sx={{ color: dotColor(state) }} fontSize="small" />
            </ListItemIcon>

            <ListItemText
              primary={label}
              primaryTypographyProps={{ variant: 'body2' }}
            />

            <Chip
              label={state}
              size="small"
              color={colorForChip(state) as any}
              variant={state === 'pending' ? 'outlined' : 'filled'}
            />
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
}
