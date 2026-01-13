
// // src/dq/useDashboardFromMessages.ts
// import { useMemo } from 'react';
// import type { ChatMessage } from '../types/chat';
// import { reduceMessagesToDashboard, type DashboardState } from './dqAggregator';

// /** Tiny string hash (fast & non-crypto) */
// function hashLite(input: any): number {
//   try {
//     const s = typeof input === 'string' ? input : JSON.stringify(input);
//     let h = 0;
//     for (let i = 0; i < s.length; i++) {
//       h = (h * 31 + s.charCodeAt(i)) >>> 0;
//     }
//     return h >>> 0;
//   } catch {
//     return 0;
//   }
// }

// /**
//  * Build a robust signature that changes whenever relevant message fields change:
//  * - id, status
//  * - number & hash of tool results
//  * - number & hash of timeline tool payloads
//  * - text content hash (assistant text can carry DQ numbers)
//  * - plus: hash of UI bridge objects (msg.dashboard / msg.metrics / msg.executionSummary)
//  */
// function buildSignature(messages: ChatMessage[]): string {
//   try {
//     return messages
//       .map((m: any) => {
//         const respTR = m?.response?.tool_result;
//         const rootTR = m?.tool_result;
//         const trs = m?.toolResults;

//         const toolArray: any[] =
//           Array.isArray(respTR) ? respTR :
//           Array.isArray(trs) ? trs :
//           Array.isArray(rootTR) ? rootTR :
//           respTR || trs || rootTR ? [respTR || trs || rootTR] : [];

//         const toolCount = toolArray.length;
//         const toolHashSum = toolArray.reduce((acc: number, item: any) => acc + hashLite(item), 0);

//         const timelineTools: any[] = Array.isArray(m?.timeline)
//           ? m.timeline.filter((t: any) => t?.type === 'tool')
//           : [];

//         const timelineToolCount = timelineTools.length;
//         const timelineHashSum = timelineTools.reduce((acc: number, t: any) => {
//           const payload: any =
//             t?.payload ?? t?.result ?? t?.data ?? t?.output ??
//             (Array.isArray(t?.content) ? t.content : t?.content);
//           return acc + hashLite(payload);
//         }, 0);

//         const textHash =
//           hashLite(m?.text) +
//           hashLite(m?.response?.text);

//         const bridgeHash =
//           hashLite(m?.dashboard) +
//           hashLite(m?.metrics) +
//           hashLite(m?.executionSummary);

//         return [
//           m?.id ?? '',
//           m?.status ?? '',
//           toolCount,
//           toolHashSum,
//           timelineToolCount,
//           timelineHashSum,
//           textHash,
//           bridgeHash,
//         ].join(':');
//       })
//       .join('|');
//   } catch {
//     return `N=${messages.length}`;
//   }
// }

// export const useDashboardFromMessages = (messages: ChatMessage[]): DashboardState => {
//   const signature = useMemo(() => buildSignature(messages), [messages]);

//   // DEBUG: see when the signature changes (requires window.DQ_DEBUG = true)
//   if ((window as any).DQ_DEBUG) {
//     // eslint-disable-next-line no-console
//     console.log('[DQ] Hook signature changed:', signature.slice(0, 160) + (signature.length > 160 ? '…' : ''));
//   }

//   // Re-aggregate whenever signature changes (not just array ref)
//   return useMemo(() => reduceMessagesToDashboard(messages), [signature]);
// };


// trying on 6 jan



// // src/dq/useDashboardFromMessages.ts
// import { useMemo } from 'react';
// import type { ChatMessage } from '../types/chat';
// import { reduceMessagesToDashboard, type DashboardState } from './dqAggregator';

// /** Stable stringify: shallow key sort to avoid flicker */
// function stableStringify(obj: any): string {
//   if (obj === null || typeof obj !== 'object') return String(obj);
//   const keys = Object.keys(obj).sort();
//   const ordered: any = {};
//   for (const k of keys) ordered[k] = obj[k];
//   return JSON.stringify(ordered);
// }

// /** Tiny string hash (fast & non-crypto) with stable ordering */
// function hashLite(input: any): number {
//   try {
//     const s = typeof input === 'string' ? input : stableStringify(input);
//     let h = 0;
//     for (let i = 0; i < s.length; i++) {
//       h = (h * 31 + s.charCodeAt(i)) >>> 0;
//     }
//     return h >>> 0;
//   } catch {
//     return 0;
//   }
// }

// /**
//  * Build a robust signature that changes whenever relevant message fields change:
//  * - id, status
//  * - number & hash of tool results
//  * - number & hash of timeline tool payloads
//  * - number & hash of response.events content
//  * - text content hash (assistant text can carry DQ numbers)
//  * - plus: hash of UI bridge objects (msg.dashboard / msg.metrics / msg.executionSummary)
//  */
// function buildSignature(messages: ChatMessage[]): string {
//   try {
//     return messages
//       .map((m: any) => {
//         const respTR = m?.response?.tool_result;
//         const rootTR = m?.tool_result;
//         const trs = m?.toolResults;

//         const toolArray: any[] =
//           Array.isArray(respTR) ? respTR :
//           Array.isArray(trs) ? trs :
//           Array.isArray(rootTR) ? rootTR :
//           respTR || trs || rootTR ? [respTR || trs || rootTR] : [];

//         const toolCount = toolArray.length;
//         const toolHashSum = toolArray.reduce((acc: number, item: any) => acc + hashLite(item), 0);

//         const timelineTools: any[] = Array.isArray(m?.timeline)
//           ? m.timeline.filter((t: any) => t?.type === 'tool')
//           : [];

//         const timelineToolCount = timelineTools.length;
//         const timelineHashSum = timelineTools.reduce((acc: number, t: any) => {
//           const payload: any =
//             t?.payload ?? t?.result ?? t?.data ?? t?.output ??
//             (Array.isArray(t?.content) ? t.content : t?.content);
//           return acc + hashLite(payload);
//         }, 0);

//         // NEW: include response.events[].content[] in signature
//         const eventsContent: any[] = Array.isArray(m?.response?.events)
//           ? m.response.events.flatMap((e: any) =>
//               Array.isArray(e?.content) ? e.content : (e?.content ? [e.content] : []))
//           : [];
//         const eventsToolCount = eventsContent.length;
//         const eventsHashSum = eventsContent.reduce((acc: number, part: any) => acc + hashLite(part), 0);

//         const textHash =
//           hashLite(m?.text) +
//           hashLite(m?.response?.text);

//         const bridgeHash =
//           hashLite(m?.dashboard) +
//           hashLite(m?.metrics) +
//           hashLite(m?.executionSummary);

//         return [
//           m?.id ?? '',
//           m?.status ?? '',
//           toolCount,
//           toolHashSum,
//           timelineToolCount,
//           timelineHashSum,
//           eventsToolCount,
//           eventsHashSum,
//           textHash,
//           bridgeHash,
//         ].join(':');
//       })
//       .join('|');
//   } catch {
//     return `N=${messages.length}`;
//   }
// }

// export const useDashboardFromMessages = (messages: ChatMessage[]): DashboardState => {
//   const signature = useMemo(() => buildSignature(messages), [messages]);

//   // DEBUG: see when the signature changes (requires window.DQ_DEBUG = true)
//   if ((window as any).DQ_DEBUG) {
//     // eslint-disable-next-line no-console
//     console.log('[DQ] Hook signature changed:', signature.slice(0, 160) + (signature.length > 160 ? '…' : ''));
//   }

//   // Re-aggregate whenever signature changes (not just array ref)
//   return useMemo(() => reduceMessagesToDashboard(messages), [signature]);
// };


// trying on 7 jan

//  working partially 


// // src/dq/useDashboardFromMessages.ts
// import { useMemo } from 'react';
// import type { ChatMessage } from '../types/chat';
// import { reduceMessagesToDashboard, type DashboardState } from './dqAggregator';

// /** Tiny string hash (fast & non-crypto) */
// function hashLite(input: any): number {
//   try {
//     const s = typeof input === 'string' ? input : JSON.stringify(input);
//     let h = 0;
//     for (let i = 0; i < s.length; i++) {
//       h = (h * 31 + s.charCodeAt(i)) >>> 0;
//     }
//     return h >>> 0;
//   } catch {
//     return 0;
//   }
// }

// /**
//  * Build a robust signature that changes whenever relevant message fields change:
//  * - id, status
//  * - number & hash of tool results
//  * - number & hash of timeline tool payloads
//  * - NEW: number & hash of response.events content
//  * - text content hash (assistant text can carry DQ numbers)
//  * - plus: hash of UI bridge objects (msg.dashboard / msg.metrics / msg.executionSummary)
//  */
// function buildSignature(messages: ChatMessage[]): string {
//   try {
//     return messages
//       .map((m: any) => {
//         const respTR = m?.response?.tool_result;
//         const rootTR = m?.tool_result;
//         const trs = m?.toolResults;

//         const toolArray: any[] =
//           Array.isArray(respTR) ? respTR :
//           Array.isArray(trs) ? trs :
//           Array.isArray(rootTR) ? rootTR :
//           respTR || trs || rootTR ? [respTR || trs || rootTR] : [];

//         const toolCount = toolArray.length;
//         const toolHashSum = toolArray.reduce((acc: number, item: any) => acc + hashLite(item), 0);

//         const timelineTools: any[] = Array.isArray(m?.timeline)
//           ? m.timeline.filter((t: any) => t?.type === 'tool')
//           : [];

//         const timelineToolCount = timelineTools.length;
//         const timelineHashSum = timelineTools.reduce((acc: number, t: any) => {
//           const payload: any =
//             t?.payload ?? t?.result ?? t?.data ?? t?.output ??
//             (Array.isArray(t?.content) ? t.content : t?.content);
//           return acc + hashLite(payload);
//         }, 0);

//         // NEW: include response.events[].content[] in signature
//         const eventsContent: any[] = Array.isArray(m?.response?.events)
//           ? m.response.events.flatMap((e: any) =>
//               Array.isArray(e?.content) ? e.content : (e?.content ? [e.content] : []))
//           : [];
//         const eventsToolCount = eventsContent.length;
//         const eventsHashSum = eventsContent.reduce((acc: number, part: any) => acc + hashLite(part), 0);

//         const textHash =
//           hashLite(m?.text) +
//           hashLite(m?.response?.text);

//         const bridgeHash =
//           hashLite(m?.dashboard) +
//           hashLite(m?.metrics) +
//           hashLite(m?.executionSummary);

//         return [
//           m?.id ?? '',
//           m?.status ?? '',
//           toolCount,
//           toolHashSum,
//           timelineToolCount,
//           timelineHashSum,
//           eventsToolCount,
//           eventsHashSum,
//           textHash,
//           bridgeHash,
//         ].join(':');
//       })
//       .join('|');
//   } catch {
//     return `N=${messages.length}`;
//   }
// }

// export const useDashboardFromMessages = (messages: ChatMessage[]): DashboardState => {
//   const signature = useMemo(() => buildSignature(messages), [messages]);

//   // DEBUG: see when the signature changes (requires window.DQ_DEBUG = true)
//   if ((window as any).DQ_DEBUG) {
//     // eslint-disable-next-line no-console
//     console.log('[DQ] Hook signature changed:', signature.slice(0, 160) + (signature.length > 160 ? '…' : ''));
//   }

//   // Re-aggregate whenever signature changes (not just array ref)
//   return useMemo(() => reduceMessagesToDashboard(messages), [signature]);
// };



// trying




// // src/dq/useDashboardFromMessages.ts
// import { useMemo } from 'react';
// import type { ChatMessage } from '../types/chat';
// import { reduceMessagesToDashboard, type DashboardState } from './dqAggregator';

// /** Tiny string hash (fast & non-crypto) */
// function hashLite(input: any): number {
//   try {
//     const s = typeof input === 'string' ? input : JSON.stringify(input);
//     let h = 0;
//     for (let i = 0; i < s.length; i++) {
//       h = (h * 31 + s.charCodeAt(i)) >>> 0;
//     }
//     return h >>> 0;
//   } catch {
//     return 0;
//   }
// }

// /**
//  * Build a robust signature that changes whenever relevant message fields change:
//  * - id, status
//  * - number & hash of tool results
//  * - number & hash of timeline tool payloads
//  * - number & hash of response.events content
//  * - text content hash (assistant text can carry DQ numbers)
//  * - plus: hash of UI bridge objects (msg.dashboard / msg.metrics / msg.executionSummary)
//  */
// function buildSignature(messages: ChatMessage[]): string {
//   try {
//     return messages
//       .map((m: any) => {
//         const respTR = m?.response?.tool_result;
//         const rootTR = m?.tool_result;
//         const trs = m?.toolResults;

//         const toolArray: any[] =
//           Array.isArray(respTR) ? respTR :
//           Array.isArray(trs) ? trs :
//           Array.isArray(rootTR) ? rootTR :
//           respTR || trs || rootTR ? [respTR || trs || rootTR] : [];

//         const toolCount = toolArray.length;
//         const toolHashSum = toolArray.reduce((acc: number, item: any) => acc + hashLite(item), 0);

//         const timelineTools: any[] = Array.isArray(m?.timeline)
//           ? m.timeline.filter((t: any) => t?.type === 'tool')
//           : [];

//         const timelineToolCount = timelineTools.length;
//         const timelineHashSum = timelineTools.reduce((acc: number, t: any) => {
//           const payload: any =
//             t?.payload ?? t?.result ?? t?.data ?? t?.output ??
//             (Array.isArray(t?.content) ? t.content : t?.content);
//           return acc + hashLite(payload);
//         }, 0);

//         // Include response.events[].content[] in signature
//         const eventsContent: any[] = Array.isArray(m?.response?.events)
//           ? m.response.events.flatMap((e: any) =>
//               Array.isArray(e?.content) ? e.content : (e?.content ? [e.content] : []))
//           : [];
//         const eventsToolCount = eventsContent.length;
//         const eventsHashSum = eventsContent.reduce((acc: number, part: any) => acc + hashLite(part), 0);

//         const textHash =
//           hashLite(m?.text) +
//           hashLite(m?.response?.text);

//         const bridgeHash =
//           hashLite(m?.dashboard) +
//           hashLite(m?.metrics) +
//           hashLite(m?.executionSummary);

//         return [
//           m?.id ?? '',
//           m?.status ?? '',
//           toolCount,
//           toolHashSum,
//           timelineToolCount,
//           timelineHashSum,
//           eventsToolCount,
//           eventsHashSum,
//           textHash,
//           bridgeHash,
//         ].join(':');
//       })
//       .join('|');
//   } catch {
//     return `N=${messages.length}`;
//   }
// }

// export const useDashboardFromMessages = (messages: ChatMessage[]): DashboardState => {
//   const signature = useMemo(() => buildSignature(messages), [messages]);

//   // DEBUG: see when the signature changes (requires window.DQ_DEBUG = true)
//   if ((window as any).DQ_DEBUG) {
//     // eslint-disable-next-line no-console
//     console.log('[DQ] Hook signature changed:', signature.slice(0, 160) + (signature.length > 160 ? '…' : ''));
//   }

//   // Re-aggregate whenever signature changes (not just array ref)
//   // NOTE: include `messages` to satisfy react-hooks/exhaustive-deps and avoid warnings
//   return useMemo(() => reduceMessagesToDashboard(messages), [signature, messages]);
// };


// trying - after  main.tsx


// // src/dq/useDashboardFromMessages.ts
// import { useMemo } from 'react';
// import type { ChatMessage } from '../types/chat';
// import { reduceMessagesToDashboard, type DashboardState } from './dqAggregator';

// /** Tiny string hash (fast & non-crypto) */
// function hashLite(input: any): number {
//   try {
//     const s = typeof input === 'string' ? input : JSON.stringify(input);
//     let h = 0;
//     for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
//     return h >>> 0;
//   } catch {
//     return 0;
//   }
// }

// /**
//  * Build a robust signature that changes whenever relevant message fields change:
//  * - id, status
//  * - number & hash of tool results
//  * - number & hash of timeline tool payloads
//  * - number & hash of response.events content
//  * - text content hash (assistant text can carry DQ numbers)
//  * - plus: hash of UI bridge objects (msg.dashboard / msg.metrics / msg.executionSummary)
//  */
// function buildSignature(messages: ChatMessage[]): string {
//   try {
//     return messages
//       .map((m: any) => {
//         const respTR = m?.response?.tool_result;
//         const rootTR = m?.tool_result;
//         const trs = m?.toolResults;

//         const toolArray: any[] =
//           Array.isArray(respTR) ? respTR :
//           Array.isArray(trs) ? trs :
//           Array.isArray(rootTR) ? rootTR :
//           respTR || trs || rootTR ? [respTR || trs || rootTR] : [];

//         const toolCount = toolArray.length;
//         const toolHashSum = toolArray.reduce((acc: number, item: any) => acc + hashLite(item), 0);

//         const timelineTools: any[] = Array.isArray(m?.timeline)
//           ? m.timeline.filter((t: any) => t?.type === 'tool')
//           : [];

//         const timelineToolCount = timelineTools.length;
//         const timelineHashSum = timelineTools.reduce((acc: number, t: any) => {
//           const payload: any =
//             t?.payload ?? t?.result ?? t?.data ?? t?.output ??
//             (Array.isArray(t?.content) ? t.content : t?.content);
//           return acc + hashLite(payload);
//         }, 0);

//         // Include response.events[].content[] in signature
//         const eventsContent: any[] = Array.isArray(m?.response?.events)
//           ? m.response.events.flatMap((e: any) =>
//               Array.isArray(e?.content) ? e.content : (e?.content ? [e.content] : []))
//           : [];
//         const eventsToolCount = eventsContent.length;
//         const eventsHashSum = eventsContent.reduce((acc: number, part: any) => acc + hashLite(part), 0);

//         const textHash = hashLite(m?.text) + hashLite(m?.response?.text);
//         const bridgeHash = hashLite(m?.dashboard) + hashLite(m?.metrics) + hashLite(m?.executionSummary);

//         return [
//           m?.id ?? '',
//           m?.status ?? '',
//           toolCount, toolHashSum,
//           timelineToolCount, timelineHashSum,
//           eventsToolCount, eventsHashSum,
//           textHash, bridgeHash,
//         ].join(':');
//       })
//       .join('|');
//   } catch {
//     return `N=${messages.length}`;
//   }
// }

// export const useDashboardFromMessages = (messages: ChatMessage[]): DashboardState => {
//   const signature = useMemo(() => buildSignature(messages), [messages]);

//   if ((window as any).DQ_DEBUG) {
//     // eslint-disable-next-line no-console
//     console.log('[DQ] Hook signature changed:', signature.slice(0, 160) + (signature.length > 160 ? '…' : ''));
//   }

//   // Include `messages` to satisfy exhaustive-deps and avoid warnings
//   return useMemo(() => reduceMessagesToDashboard(messages), [signature, messages]);
// };



// src/dq/useDashboardFromMessages.ts
import { useMemo } from 'react';
import type { ChatMessage } from '../types/chat';
import { reduceMessagesToDashboard, type DashboardState } from './dqAggregator';

/** Tiny string hash (fast & non-crypto) */
function hashLite(input: any): number {
  try {
    const s = typeof input === 'string' ? input : JSON.stringify(input);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h >>> 0;
  } catch {
    return 0;
  }
}

/**
 * Build a robust signature that changes whenever relevant message fields change:
 * - id, status
 * - number & hash of tool results
 * - number & hash of timeline tool payloads
 * - number & hash of response.events content
 * - text content hash (assistant text can carry DQ numbers)
 * - plus: hash of UI bridge objects (msg.dashboard / msg.metrics / msg.executionSummary)
 */
function buildSignature(messages: ChatMessage[]): string {
  try {
    return messages
      .map((m: any) => {
        const respTR = m?.response?.tool_result;
        const rootTR = m?.tool_result;
        const trs = m?.toolResults;

        const toolArray: any[] =
          Array.isArray(respTR) ? respTR :
          Array.isArray(trs) ? trs :
          Array.isArray(rootTR) ? rootTR :
          respTR || trs || rootTR ? [respTR || trs || rootTR] : [];

        const toolCount = toolArray.length;
        const toolHashSum = toolArray.reduce((acc: number, item: any) => acc + hashLite(item), 0);

        const timelineTools: any[] = Array.isArray(m?.timeline)
          ? m.timeline.filter((t: any) => t?.type === 'tool')
          : [];

        const timelineToolCount = timelineTools.length;
        const timelineHashSum = timelineTools.reduce((acc: number, t: any) => {
          const payload: any =
            t?.payload ?? t?.result ?? t?.data ?? t?.output ??
            (Array.isArray(t?.content) ? t.content : t?.content);
          return acc + hashLite(payload);
        }, 0);

        // Include response.events[].content[] in signature
        const eventsContent: any[] = Array.isArray(m?.response?.events)
          ? m.response.events.flatMap((e: any) =>
              Array.isArray(e?.content) ? e.content : (e?.content ? [e.content] : []))
          : [];
        const eventsToolCount = eventsContent.length;
        const eventsHashSum = eventsContent.reduce((acc: number, part: any) => acc + hashLite(part), 0);

        const textHash = hashLite(m?.text) + hashLite(m?.response?.text);
        const bridgeHash = hashLite(m?.dashboard) + hashLite(m?.metrics) + hashLite(m?.executionSummary);

        return [
          m?.id ?? '',
          m?.status ?? '',
          toolCount, toolHashSum,
          timelineToolCount, timelineHashSum,
          eventsToolCount, eventsHashSum,
          textHash, bridgeHash,
        ].join(':');
      })
      .join('|');
  } catch {
    return `N=${messages.length}`;
  }
}

export const useDashboardFromMessages = (messages: ChatMessage[]): DashboardState => {
  const signature = useMemo(() => buildSignature(messages), [messages]);

  if ((window as any).DQ_DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[DQ] Hook signature changed:', signature.slice(0, 160) + (signature.length > 160 ? '…' : ''));
  }

  // Minimal change to satisfy exhaustive-deps, behavior unchanged
  return useMemo(() => reduceMessagesToDashboard(messages), [signature, messages]);
};
