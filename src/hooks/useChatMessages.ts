// // src/hooks/useChatMessages.ts
// /**
//  * useChatMessages Hook (UPDATED with mode tagging and tool-name timeline)
//  * - Preserves conversation context across turns by sending prior history
//  * - Persists per-agent conversationId and messages in localStorage
//  * - Maintains SSE streaming updates (text/status/thinking/tool/charts/annotations)
//  * - NEW: Tags messages with `mode` and sends mode-filtered history
//  * - NEW: Captures toolName + toolEvent in timeline for accurate sidebar status updates
//  */

// import { useState, useCallback, useRef, useEffect } from 'react';
// import { ChatMessage } from '../types/chat';
// import { ChartContent } from '../types/chart';
// import { config } from '../config/env';
// import { extractSqlQuery, extractVerificationInfo } from '../utils/chatUtils';
// import { ERROR_TEXT, API_DEFAULTS, getApiStatusMessage } from '../constants/textConstants';
// import type { Mode } from './useAgentStatus';

// // Keep the chat trimmed to avoid memory issues
// const MAX_MESSAGES = 100;
// // Limit how many turns we send back to the backend on each request
// const MAX_TURNS_TO_SEND = 20;

// /** Convert ChatMessage[] (UI state) into backend message format. Only includes textual turns. */
// function toBackendMessages(history: ChatMessage[], modeFilter?: Mode) {
//   return history
//     .filter((m) => {
//       const isTurn = (m.sender === 'user' || m.sender === 'assistant');
//       const hasText = typeof m.text === 'string' && m.text.trim().length > 0;
//       const modeMatches = !modeFilter || !m.mode || m.mode === modeFilter; // legacy messages (no mode) allowed
//       return isTurn && hasText && modeMatches;
//     })
//     .map((m) => ({
//       role: m.sender === 'user' ? 'user' : 'assistant',
//       content: [{ type: 'text', text: m.text! }],
//     }));
// }

// /** Create or restore a per-agent conversationId from localStorage. */
// function initConversationId(agent: string): string {
//   const key = `chat:${agent}:conversationId`;
//   if (typeof window !== 'undefined') {
//     const existing = localStorage.getItem(key);
//     if (existing) return existing;
//     const id = `${agent}::${(crypto as any)?.randomUUID?.() ?? Date.now().toString()}`;
//     localStorage.setItem(key, id);
//     return id;
//   }
//   return `${agent}::${Date.now().toString()}`;
// }

// export const useChatMessages = (selectedAgent: string) => {
//   const [messages, setMessages] = useState<ChatMessage[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const abortControllerRef = useRef<AbortController | null>(null);

//   // New: conversationId persisted per agent
//   const [conversationId, setConversationId] = useState<string>(() =>
//     initConversationId(selectedAgent)
//   );

//   /** Restore persisted messages & conversationId when agent changes. */
//   useEffect(() => {
//     const convKey = `chat:${selectedAgent}:conversationId`;
//     const restoredConvId =
//       typeof window !== 'undefined' ? localStorage.getItem(convKey) : null;
//     const finalConvId = restoredConvId ?? initConversationId(selectedAgent);
//     setConversationId(finalConvId);

//     const msgsKey = `chat:${selectedAgent}:messages`;
//     if (typeof window !== 'undefined') {
//       const saved = localStorage.getItem(msgsKey);
//       if (saved) {
//         try {
//           const parsed: ChatMessage[] = JSON.parse(saved);
//           setMessages(parsed);
//         } catch {
//           setMessages([]);
//         }
//       } else {
//         setMessages([]);
//       }
//     } else {
//       setMessages([]);
//     }
//   }, [selectedAgent]);

//   /** Persist messages on every change (per agent). */
//   useEffect(() => {
//     if (typeof window !== 'undefined') {
//       const msgsKey = `chat:${selectedAgent}:messages`;
//       try {
//         localStorage.setItem(msgsKey, JSON.stringify(messages));
//       } catch {
//         // Ignore storage errors
//       }
//     }
//   }, [messages, selectedAgent]);

//   /** Send a message (accepts optional { mode } and stamps it on user+assistant). */
//   const sendMessage = useCallback(
//     async (message: string, options?: { mode?: Mode }) => {
//       if (!message.trim() || isLoading) return;

//       const mode = options?.mode ?? 'table'; // sensible default

//       // Snapshot current messages BEFORE appending placeholders
//       const previousMessages = messages;
//       const historyTurns = previousMessages.slice(-MAX_TURNS_TO_SEND);
//       const historyPayload = toBackendMessages(historyTurns, mode);

//       const messageId = Date.now().toString();

//       const userMessage: ChatMessage = {
//         id: messageId + '_user',
//         text: message.trim(),
//         sender: 'user',
//         timestamp: new Date(),
//         mode, // tag mode
//       };

//       const assistantMessageId = messageId + '_assistant';
//       const assistantMessage: ChatMessage = {
//         id: assistantMessageId,
//         text: '',
//         sender: 'assistant',
//         timestamp: new Date(),
//         status: 'thinking',
//         isStreaming: true,
//         streamingStatus: undefined,
//         thinkingSteps: [],
//         sqlQueries: [],
//         timeline: [],
//         toolsUsed: [],
//         mode, // tag mode
//       };

//       setMessages((prev) => {
//         const newMessages = [...prev, userMessage, assistantMessage];
//         return newMessages.length > MAX_MESSAGES ? newMessages.slice(-MAX_MESSAGES) : newMessages;
//       });

//       setIsLoading(true);

//       // Build request with full context + the new user turn
//       const requestBody = {
//         messages: [
//           ...historyPayload,
//           { role: 'user', content: [{ type: 'text', text: message.trim() }] },
//         ],
//         tool_choice: { type: 'auto' },
//         stream: true,
//         conversation_id: conversationId,
//         mode, // let backend branch Table/File pipeline
//       };

//       const abortController = new AbortController();
//       abortControllerRef.current = abortController;

//       try {
//         const backendEndpoint = `${config.backendUrl}/api/agents/${encodeURIComponent(
//           selectedAgent
//         )}/messages`;

//         const response = await fetch(backendEndpoint, {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             Accept: 'text/event-stream',
//           },
//           body: JSON.stringify(requestBody),
//           signal: abortController.signal,
//         });

//         if (!response.ok) {
//           let errorMessage = `${ERROR_TEXT.API_ERROR}: ${response.status} ${response.statusText}`;
//           try {
//             const contentType = response.headers.get('content-type');
//             if (contentType?.includes('application/json')) {
//               const errorData = await response.json();
//               errorMessage = errorData.errorParts
//                 ? errorData.errorParts.join('\n\n')
//                 : errorData.error ?? errorData.message ?? errorMessage;
//             }
//           } catch { /* ignore */ }
//           const error = new Error(errorMessage);
//           (error as any).fullMessage = errorMessage;
//           throw error;
//         }

//         const reader = response.body?.getReader();
//         if (!reader) {
//           const errorMessage = ERROR_TEXT.NO_READABLE_STREAM;
//           const error = new Error(errorMessage);
//           (error as any).fullMessage = errorMessage;
//           throw error;
//         }

//         const decoder = new TextDecoder();
//         let assistantText = '';
//         let currentEvent = '';

//         while (true) {
//           const { done, value } = await reader.read();
//           if (done) break;

//           const chunk = decoder.decode(value, { stream: true });
//           const lines = chunk.split('\n');

//           for (const line of lines) {
//             if (line.startsWith('event: ')) {
//               currentEvent = line.slice(7).trim();
//             } else if (line.startsWith('data: ')) {
//               const dataStr = line.slice(6).trim();
//               if (!dataStr || dataStr === '[DONE]') continue;

//               try {
//                 const data = JSON.parse(dataStr);

//                 if (currentEvent === 'response.text.delta' && data.text) {
//                   assistantText += data.text;
//                   const currentText = assistantText;
//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? { ...msg, text: currentText, status: 'thinking' as const, isStreaming: true }
//                         : msg
//                     )
//                   );
//                 } else if (currentEvent === 'response.status' && data.message) {
//                   const statusMessage = getApiStatusMessage(data.message);
//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? {
//                             ...msg,
//                             status: 'thinking' as const,
//                             streamingStatus: statusMessage,
//                             thinkingSteps: (msg.thinkingSteps ?? []).includes(statusMessage)
//                               ? msg.thinkingSteps
//                               : [...(msg.thinkingSteps ?? []), statusMessage],
//                             timeline: [
//                               ...(msg.timeline ?? []),
//                               { type: 'status', content: statusMessage, timestamp: new Date() },
//                             ],
//                           }
//                         : msg
//                     )
//                   );
//                 } else if (currentEvent === 'response.tool_start') {
//                   // Optional: if backend emits tool_start, record it for 'running' status
//                   const toolName: string | undefined =
//                     data?.tool_name || data?.name || data?.tool?.name || data?.tool?.tool_name || data?.result?.tool_name;

//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? {
//                             ...msg,
//                             toolsUsed: [...(msg.toolsUsed ?? []), { name: toolName, event: 'start', at: new Date() }],
//                             timeline: [
//                               ...(msg.timeline ?? []),
//                               {
//                                 type: 'tool',
//                                 content: toolName ? `Tool ${toolName} started` : 'Tool started',
//                                 timestamp: new Date(),
//                                 toolName,
//                                 toolEvent: 'start',
//                               } as any,
//                             ],
//                           }
//                         : msg
//                     )
//                   );
//                 } else if (currentEvent === 'response.tool_result') {
//                   // Capture tool result for deterministic sidebar update
//                   const toolName: string | undefined =
//                     data?.tool_name || data?.name || data?.tool?.name || data?.tool?.tool_name || data?.result?.tool_name;

//                   const toolStatus = API_DEFAULTS.PROCESSING_RESULTS;
//                   const sqlQuery = extractSqlQuery(data);
//                   const verificationInfo = extractVerificationInfo(data);

//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? {
//                             ...msg,
//                             status: 'thinking' as const,
//                             streamingStatus: toolStatus,
//                             thinkingSteps: (msg.thinkingSteps ?? []).includes(toolStatus)
//                               ? msg.thinkingSteps
//                               : [...(msg.thinkingSteps ?? []), toolStatus],

//                             toolsUsed: [...(msg.toolsUsed ?? []), { name: toolName, event: 'result', at: new Date() }],

//                             sqlQueries: sqlQuery
//                               ? [
//                                   ...(msg.sqlQueries ?? []),
//                                   { sql: sqlQuery, verification: verificationInfo ?? undefined },
//                                 ]
//                               : msg.sqlQueries,

//                             timeline: [
//                               ...(msg.timeline ?? []),
//                               {
//                                 type: 'tool',
//                                 content: toolName ? `Tool ${toolName} completed` : 'Tool completed',
//                                 timestamp: new Date(),
//                                 toolName,
//                                 toolEvent: 'result',
//                               } as any,
//                               ...(sqlQuery
//                                 ? [{ type: 'sql' as const, content: sqlQuery, timestamp: new Date() }]
//                                 : []),
//                             ],
//                           }
//                         : msg
//                     )
//                   );
//                 } else if (currentEvent === 'response.tool_error') {
//                   // Optional: error event
//                   const toolName: string | undefined =
//                     data?.tool_name || data?.name || data?.tool?.name || data?.tool?.tool_name || data?.result?.tool_name;

//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? {
//                             ...msg,
//                             toolsUsed: [...(msg.toolsUsed ?? []), { name: toolName, event: 'error', at: new Date() }],
//                             timeline: [
//                               ...(msg.timeline ?? []),
//                               {
//                                 type: 'tool',
//                                 content: toolName ? `Tool ${toolName} error` : 'Tool error',
//                                 timestamp: new Date(),
//                                 toolName,
//                                 toolEvent: 'error',
//                               } as any,
//                             ],
//                           }
//                         : msg
//                     )
//                   );
//                 } else if (currentEvent === 'response.thinking' && data.thinking && data.thinking.text) {
//                   const thinkingText = data.thinking.text.trim();
//                   if (thinkingText) {
//                     setMessages((prev) =>
//                       prev.map((msg) =>
//                         msg.id === assistantMessageId
//                           ? {
//                               ...msg,
//                               status: 'thinking' as const,
//                               thinkingTexts: [...(msg.thinkingTexts ?? []), thinkingText],
//                               timeline: [
//                                 ...(msg.timeline ?? []),
//                                 { type: 'thinking', content: thinkingText, timestamp: new Date() },
//                               ],
//                             }
//                           : msg
//                       )
//                     );
//                   }
//                 } else if (currentEvent === 'response.thinking.delta' && data.text) {
//                   const deltaText = data.text;
//                   if (deltaText) {
//                     setMessages((prev) =>
//                       prev.map((msg) => {
//                         if (msg.id === assistantMessageId) {
//                           const currentThinkingTexts = msg.thinkingTexts ?? [];
//                           const lastIndex = currentThinkingTexts.length - 1;
//                           if (lastIndex >= 0) {
//                             const updatedThinkingTexts = [...currentThinkingTexts];
//                             updatedThinkingTexts[lastIndex] = updatedThinkingTexts[lastIndex] + deltaText;
//                             return { ...msg, status: 'thinking' as const, thinkingTexts: updatedThinkingTexts };
//                           } else {
//                             return {
//                               ...msg,
//                               status: 'thinking' as const,
//                               thinkingTexts: [deltaText],
//                               timeline: [
//                                 ...(msg.timeline ?? []),
//                                 { type: 'thinking', content: 'Processing thinking...', timestamp: new Date() },
//                               ],
//                             };
//                           }
//                         }
//                         return msg;
//                       })
//                     );
//                   }
//                 } else if (currentEvent === 'response.chart') {
//                   if (data.chart_spec) {
//                     try {
//                       const chartSpec = JSON.parse(data.chart_spec);
//                       const chartContent: ChartContent = { type: 'vega-lite' as const, chart_spec: chartSpec };
//                       setMessages((prev) =>
//                         prev.map((msg) =>
//                           msg.id === assistantMessageId
//                             ? {
//                                 ...msg,
//                                 charts: [...(msg.charts ?? []), chartContent],
//                                 timeline: [
//                                   ...(msg.timeline ?? []),
//                                   { type: 'chart', content: 'Chart visualization added', timestamp: new Date() },
//                                 ],
//                               }
//                             : msg
//                         )
//                       );
//                     } catch { /* ignore malformed chart */ }
//                   }
//                 } else if (currentEvent === 'response.text.annotation') {
//                   if (data) {
//                     try {
//                       const annotationData = data.annotation ?? data;
//                       const annotation = {
//                         type: annotationData.type ?? 'citation',
//                         start_index: data.start_index,
//                         end_index: data.end_index,
//                         annotation_index: data.annotation_index,
//                         content_index: data.content_index,
//                         text: annotationData.text,
//                         url: annotationData.doc_id,
//                         title: annotationData.doc_title,
//                         source: annotationData.source,
//                         doc_id: annotationData.doc_id,
//                         search_result_id: annotationData.search_result_id,
//                         index: annotationData.index,
//                       };
//                       setMessages((prev) =>
//                         prev.map((msg) =>
//                           msg.id === assistantMessageId
//                             ? {
//                                 ...msg,
//                                 annotations: [...(msg.annotations ?? []), annotation],
//                                 timeline: [
//                                   ...(msg.timeline ?? []),
//                                   {
//                                     type: 'annotation',
//                                     content: `Citation: ${annotation.title ?? 'Reference'}`,
//                                     timestamp: new Date(),
//                                   },
//                                 ],
//                               }
//                             : msg
//                         )
//                       );
//                     } catch { /* ignore malformed annotation */ }
//                   }
//                 }
//               } catch { /* ignore malformed streaming json */ }
//             }
//           }
//         }

//         // Mark message as complete
//         setMessages((prev) =>
//           prev.map((msg) =>
//             msg.id === assistantMessageId
//               ? {
//                   ...msg,
//                   text: assistantText && assistantText.length > 0
//                     ? assistantText
//                     : ERROR_TEXT.RESPONSE_COMPLETED,
//                   status: 'sent' as const,
//                   isStreaming: false,
//                   streamingStatus: undefined,
//                 }
//               : msg
//           )
//         );

//         return { success: true, assistantMessageId };
//       } catch (error) {
//         if (error instanceof Error && error.name === 'AbortError') {
//           setMessages((prev) =>
//             prev.map((msg) =>
//               msg.id === assistantMessageId
//                 ? {
//                     ...msg,
//                     text: '',
//                     status: 'error' as const,
//                     error: `${ERROR_TEXT.ERROR_PREFIX}\n\n${ERROR_TEXT.USER_CANCELED}`,
//                     isStreaming: false,
//                     streamingStatus: undefined,
//                   }
//                 : msg
//             )
//           );
//         } else {
//           let errorMessage: string;
//           if (
//             error instanceof TypeError &&
//             (error.message.includes('network') ||
//              error.message.includes('fetch') ||
//              error.message.includes('Failed to fetch'))
//           ) {
//             errorMessage = `${ERROR_TEXT.ERROR_PREFIX}\n\nConnection lost during streaming.\n\n💡 Tip: The backend server at ${config.backendUrl} stopped or crashed, network connection was interrupted, or the backend server is no longer running.`;
//           } else {
//             errorMessage = error instanceof Error
//               ? ((error as any).fullMessage ?? error.message)
//               : ERROR_TEXT.UNKNOWN_ERROR;
//           }
//           setMessages((prev) =>
//             prev.map((msg) =>
//               msg.id === assistantMessageId
//                 ? {
//                     ...msg,
//                     text: '',
//                     status: 'error' as const,
//                     error: errorMessage,
//                     isStreaming: false,
//                     streamingStatus: undefined,
//                   }
//                 : msg
//             )
//           );
//         }
//         return { success: false, error };
//       } finally {
//         setIsLoading(false);
//         abortControllerRef.current = null;
//       }
//     },
//     [isLoading, messages, selectedAgent, conversationId]
//   );

//   const cancelRequest = useCallback(() => {
//     if (abortControllerRef.current && isLoading) {
//       abortControllerRef.current.abort();
//     }
//   }, [isLoading]);

//   const clearMessages = useCallback(() => {
//     if (abortControllerRef.current && isLoading) {
//       abortControllerRef.current.abort();
//     }
//     setMessages([]);
//     setIsLoading(false);
//     abortControllerRef.current = null;
//   }, [isLoading]);

//   return {
//     messages,
//     isLoading,
//     sendMessage,     // now supports sendMessage(text, { mode })
//     cancelRequest,
//     clearMessages,
//     conversationId,
//   };
// };


// trying dashboard at 31



// src/hooks/useChatMessages.ts
/**
 * useChatMessages Hook (UPDATED with mode tagging and tool-name timeline)
 * - Preserves conversation context across turns by sending prior history
 * - Persists per-agent conversationId and messages in localStorage
 * - Maintains SSE streaming updates (text/status/thinking/tool/charts/annotations)
 * - NEW: Tags messages with `mode` and sends mode-filtered history
 * - NEW: Captures toolName + toolEvent in timeline for accurate sidebar status updates
 * - NEW: Persists raw tool_result payloads as `toolPayloads` for dashboard aggregation
 */

// import { useState, useCallback, useRef, useEffect } from 'react';
// import { ChatMessage } from '../types/chat';
// import { ChartContent } from '../types/chart';
// import { config } from '../config/env';
// import { extractSqlQuery, extractVerificationInfo } from '../utils/chatUtils';
// import { ERROR_TEXT, API_DEFAULTS, getApiStatusMessage } from '../constants/textConstants';
// import type { Mode } from './useAgentStatus';

// // Keep the chat trimmed to avoid memory issues
// const MAX_MESSAGES = 100;
// // Limit how many turns we send back to the backend on each request
// const MAX_TURNS_TO_SEND = 20;

// /** Convert ChatMessage[] (UI state) into backend message format. Only includes textual turns. */
// function toBackendMessages(history: ChatMessage[], modeFilter?: Mode) {
//   return history
//     .filter((m) => {
//       const isTurn = (m.sender === 'user' || m.sender === 'assistant');
//       const hasText = typeof m.text === 'string' && m.text.trim().length > 0;
//       const modeMatches = !modeFilter || !m.mode || m.mode === modeFilter; // legacy messages (no mode) allowed
//       return isTurn && hasText && modeMatches;
//     })
//     .map((m) => ({
//       role: m.sender === 'user' ? 'user' : 'assistant',
//       content: [{ type: 'text', text: m.text! }],
//     }));
// }

// /** Create or restore a per-agent conversationId from localStorage. */
// function initConversationId(agent: string): string {
//   const key = `chat:${agent}:conversationId`;
//   if (typeof window !== 'undefined') {
//     const existing = localStorage.getItem(key);
//     if (existing) return existing;
//     const id = `${agent}::${(crypto as any)?.randomUUID?.() ?? Date.now().toString()}`;
//     localStorage.setItem(key, id);
//     return id;
//   }
//   return `${agent}::${Date.now().toString()}`;
// }

// export const useChatMessages = (selectedAgent: string) => {
//   const [messages, setMessages] = useState<ChatMessage[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const abortControllerRef = useRef<AbortController | null>(null);

//   // New: conversationId persisted per agent
//   const [conversationId, setConversationId] = useState<string>(() =>
//     initConversationId(selectedAgent)
//   );

//   /** Restore persisted messages & conversationId when agent changes. */
//   useEffect(() => {
//     const convKey = `chat:${selectedAgent}:conversationId`;
//     const restoredConvId =
//       typeof window !== 'undefined' ? localStorage.getItem(convKey) : null;
//     const finalConvId = restoredConvId ?? initConversationId(selectedAgent);
//     setConversationId(finalConvId);

//     const msgsKey = `chat:${selectedAgent}:messages`;
//     if (typeof window !== 'undefined') {
//       const saved = localStorage.getItem(msgsKey);
//       if (saved) {
//         try {
//           const parsed: ChatMessage[] = JSON.parse(saved);
//           // (Optional hydration) Convert timestamp strings back to Date objects, if needed:
//           // const hydrated = parsed.map(m => ({ ...m, timestamp: m.timestamp ? new Date(m.timestamp) : undefined }));
//           setMessages(parsed);
//         } catch {
//           setMessages([]);
//         }
//       } else {
//         setMessages([]);
//       }
//     } else {
//       setMessages([]);
//     }
//   }, [selectedAgent]);

//   /** Persist messages on every change (per agent). */
//   useEffect(() => {
//     if (typeof window !== 'undefined') {
//       const msgsKey = `chat:${selectedAgent}:messages`;
//       try {
//         localStorage.setItem(msgsKey, JSON.stringify(messages));
//       } catch {
//         // Ignore storage errors
//       }
//     }
//   }, [messages, selectedAgent]);

//   /** Send a message (accepts optional { mode } and stamps it on user+assistant). */
//   const sendMessage = useCallback(
//     async (message: string, options?: { mode?: Mode }) => {
//       if (!message.trim() || isLoading) return;

//       const mode = options?.mode ?? 'table'; // sensible default

//       // Snapshot current messages BEFORE appending placeholders
//       const previousMessages = messages;
//       const historyTurns = previousMessages.slice(-MAX_TURNS_TO_SEND);
//       const historyPayload = toBackendMessages(historyTurns, mode);

//       const messageId = Date.now().toString();

//       const userMessage: ChatMessage = {
//         id: messageId + '_user',
//         text: message.trim(),
//         sender: 'user',
//         timestamp: new Date(),
//         mode, // tag mode
//       };

//       const assistantMessageId = messageId + '_assistant';
//       const assistantMessage: ChatMessage = {
//         id: assistantMessageId,
//         text: '',
//         sender: 'assistant',
//         timestamp: new Date(),
//         status: 'thinking',
//         isStreaming: true,
//         streamingStatus: undefined,
//         thinkingSteps: [],
//         sqlQueries: [],
//         timeline: [],
//         toolsUsed: [],
//         mode, // tag mode
//         // NEW: we will push raw tool_result payloads here as they arrive
//         // toolPayloads?: any[]  (added dynamically below)
//       };

//       setMessages((prev) => {
//         const newMessages = [...prev, userMessage, assistantMessage];
//         return newMessages.length > MAX_MESSAGES ? newMessages.slice(-MAX_MESSAGES) : newMessages;
//       });
//       setIsLoading(true);

//       // Build request with full context + the new user turn
//       const requestBody = {
//         messages: [
//           ...historyPayload,
//           { role: 'user', content: [{ type: 'text', text: message.trim() }] },
//         ],
//         tool_choice: { type: 'auto' },
//         stream: true,
//         conversation_id: conversationId,
//         mode, // let backend branch Table/File pipeline
//       };

//       const abortController = new AbortController();
//       abortControllerRef.current = abortController;

//       try {
//         const backendEndpoint = `${config.backendUrl}/api/agents/${encodeURIComponent(
//           selectedAgent
//         )}/messages`;

//         const response = await fetch(backendEndpoint, {
//           method: 'POST',
//           headers: {
//             'Content-Type': 'application/json',
//             Accept: 'text/event-stream',
//           },
//           body: JSON.stringify(requestBody),
//           signal: abortController.signal,
//         });

//         if (!response.ok) {
//           let errorMessage = `${ERROR_TEXT.API_ERROR}: ${response.status} ${response.statusText}`;
//           try {
//             const contentType = response.headers.get('content-type');
//             if (contentType?.includes('application/json')) {
//               const errorData = await response.json();
//               errorMessage = errorData.errorParts
//                 ? errorData.errorParts.join('\n\n')
//                 : errorData.error ?? errorData.message ?? errorMessage;
//             }
//           } catch { /* ignore */ }
//           const error = new Error(errorMessage);
//           (error as any).fullMessage = errorMessage;
//           throw error;
//         }

//         const reader = response.body?.getReader();
//         if (!reader) {
//           const errorMessage = ERROR_TEXT.NO_READABLE_STREAM;
//           const error = new Error(errorMessage);
//           (error as any).fullMessage = errorMessage;
//           throw error;
//         }

//         const decoder = new TextDecoder();
//         let assistantText = '';
//         let currentEvent = '';

//         while (true) {
//           const { done, value } = await reader.read();
//           if (done) break;

//           const chunk = decoder.decode(value, { stream: true });
//           const lines = chunk.split('\n');

//           for (const line of lines) {
//             if (line.startsWith('event: ')) {
//               currentEvent = line.slice(7).trim();
//             } else if (line.startsWith('data: ')) {
//               const dataStr = line.slice(6).trim();
//               if (!dataStr || dataStr === '[DONE]') continue;

//               try {
//                 const data = JSON.parse(dataStr);

//                 // ---- Text delta ----
//                 if (currentEvent === 'response.text.delta' && data.text) {
//                   assistantText += data.text;
//                   const currentText = assistantText;
//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? { ...msg, text: currentText, status: 'thinking' as const, isStreaming: true }
//                         : msg
//                     )
//                   );
//                 }

//                 // ---- Status ----
//                 else if (currentEvent === 'response.status' && data.message) {
//                   const statusMessage = getApiStatusMessage(data.message);
//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? {
//                             ...msg,
//                             status: 'thinking' as const,
//                             streamingStatus: statusMessage,
//                             thinkingSteps: (msg.thinkingSteps ?? []).includes(statusMessage)
//                               ? msg.thinkingSteps
//                               : [...(msg.thinkingSteps ?? []), statusMessage],
//                             timeline: [
//                               ...(msg.timeline ?? []),
//                               { type: 'status', content: statusMessage, timestamp: new Date() },
//                             ],
//                           }
//                         : msg
//                     )
//                   );
//                 }

//                 // ---- Tool start ----
//                 else if (currentEvent === 'response.tool_start') {
//                   const toolName: string | undefined =
//                     data?.tool_name
//                     ?? data?.name
//                     ?? data?.tool?.name
//                     ?? data?.tool?.tool_name
//                     ?? data?.result?.tool_name;

//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? {
//                             ...msg,
//                             toolsUsed: [...(msg.toolsUsed ?? []), { name: toolName, event: 'start', at: new Date() }],
//                             timeline: [
//                               ...(msg.timeline ?? []),
//                               {
//                                 type: 'tool',
//                                 content: toolName ? `Tool ${toolName} started` : 'Tool started',
//                                 timestamp: new Date(),
//                                 toolName,
//                                 toolEvent: 'start',
//                               } as any,
//                             ],
//                           }
//                         : msg
//                     )
//                   );
//                 }

//                 // ---- Tool result (★ NEW: persist raw payload) ----
//                 else if (currentEvent === 'response.tool_result') {
//                   const toolName: string | undefined =
//                     data?.tool_name
//                     ?? data?.name
//                     ?? data?.tool?.name
//                     ?? data?.tool?.tool_name
//                     ?? data?.result?.tool_name;

//                   // ★ NEW: persist raw payload so we can aggregate for the dashboard later
//                   const toolPayload = { tool: toolName, ...data };

//                   const toolStatus = API_DEFAULTS.PROCESSING_RESULTS;
//                   const sqlQuery = extractSqlQuery(data);
//                   const verificationInfo = extractVerificationInfo(data);

//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? {
//                             ...msg,
//                             status: 'thinking' as const,
//                             streamingStatus: toolStatus,
//                             thinkingSteps: (msg.thinkingSteps ?? []).includes(toolStatus)
//                               ? msg.thinkingSteps
//                               : [...(msg.thinkingSteps ?? []), toolStatus],
//                             toolsUsed: [...(msg.toolsUsed ?? []), { name: toolName, event: 'result', at: new Date() }],
//                             // ★ NEW: collect toolPayloads (array) for later reduction
//                             toolPayloads: [...(msg as any).toolPayloads ?? [], toolPayload],
//                             sqlQueries: sqlQuery
//                               ? [
//                                   ...(msg.sqlQueries ?? []),
//                                   { sql: sqlQuery, verification: verificationInfo ?? undefined },
//                                 ]
//                               : msg.sqlQueries,
//                             timeline: [
//                               ...(msg.timeline ?? []),
//                               {
//                                 type: 'tool',
//                                 content: toolName ? `Tool ${toolName} completed` : 'Tool completed',
//                                 timestamp: new Date(),
//                                 toolName,
//                                 toolEvent: 'result',
//                               } as any,
//                               ...(sqlQuery
//                                 ? [{ type: 'sql' as const, content: sqlQuery, timestamp: new Date() }]
//                                 : []),
//                             ],
//                           }
//                         : msg
//                     )
//                   );
//                 }

//                 // ---- Tool error ----
//                 else if (currentEvent === 'response.tool_error') {
//                   const toolName: string | undefined =
//                     data?.tool_name
//                     ?? data?.name
//                     ?? data?.tool?.name
//                     ?? data?.tool?.tool_name
//                     ?? data?.result?.tool_name;

//                   setMessages((prev) =>
//                     prev.map((msg) =>
//                       msg.id === assistantMessageId
//                         ? {
//                             ...msg,
//                             toolsUsed: [...(msg.toolsUsed ?? []), { name: toolName, event: 'error', at: new Date() }],
//                             timeline: [
//                               ...(msg.timeline ?? []),
//                               {
//                                 type: 'tool',
//                                 content: toolName ? `Tool ${toolName} error` : 'Tool error',
//                                 timestamp: new Date(),
//                                 toolName,
//                                 toolEvent: 'error',
//                               } as any,
//                             ],
//                           }
//                         : msg
//                     )
//                   );
//                 }

//                 // ---- Thinking (full block) ----
//                 else if (currentEvent === 'response.thinking' && data.thinking && data.thinking.text) {
//                   const thinkingText = data.thinking.text.trim();
//                   if (thinkingText) {
//                     setMessages((prev) =>
//                       prev.map((msg) =>
//                         msg.id === assistantMessageId
//                           ? {
//                               ...msg,
//                               status: 'thinking' as const,
//                               thinkingTexts: [...(msg.thinkingTexts ?? []), thinkingText],
//                               timeline: [
//                                 ...(msg.timeline ?? []),
//                                 { type: 'thinking', content: thinkingText, timestamp: new Date() },
//                               ],
//                             }
//                           : msg
//                       )
//                     );
//                   }
//                 }

//                 // ---- Thinking delta ----
//                 else if (currentEvent === 'response.thinking.delta' && data.text) {
//                   const deltaText = data.text;
//                   if (deltaText) {
//                     setMessages((prev) =>
//                       prev.map((msg) => {
//                         if (msg.id === assistantMessageId) {
//                           const currentThinkingTexts = msg.thinkingTexts ?? [];
//                           const lastIndex = currentThinkingTexts.length - 1;
//                           if (lastIndex >= 0) {
//                             const updatedThinkingTexts = [...currentThinkingTexts];
//                             updatedThinkingTexts[lastIndex] = updatedThinkingTexts[lastIndex] + deltaText;
//                             return { ...msg, status: 'thinking' as const, thinkingTexts: updatedThinkingTexts };
//                           } else {
//                             return {
//                               ...msg,
//                               status: 'thinking' as const,
//                               thinkingTexts: [deltaText],
//                               timeline: [
//                                 ...(msg.timeline ?? []),
//                                 { type: 'thinking', content: 'Processing thinking...', timestamp: new Date() },
//                               ],
//                             };
//                           }
//                         }
//                         return msg;
//                       })
//                     );
//                   }
//                 }

//                 // ---- Chart spec ----
//                 else if (currentEvent === 'response.chart') {
//                   if (data.chart_spec) {
//                     try {
//                       const chartSpec = JSON.parse(data.chart_spec);
//                       const chartContent: ChartContent = { type: 'vega-lite' as const, chart_spec: chartSpec };
//                       setMessages((prev) =>
//                         prev.map((msg) =>
//                           msg.id === assistantMessageId
//                             ? {
//                                 ...msg,
//                                 charts: [...(msg.charts ?? []), chartContent],
//                                 timeline: [
//                                   ...(msg.timeline ?? []),
//                                   { type: 'chart', content: 'Chart visualization added', timestamp: new Date() },
//                                 ],
//                               }
//                             : msg
//                         )
//                       );
//                     } catch { /* ignore malformed chart */ }
//                   }
//                 }

//                 // ---- Text annotation ----
//                 else if (currentEvent === 'response.text.annotation') {
//                   if (data) {
//                     try {
//                       const annotationData = data.annotation ?? data;
//                       const annotation = {
//                         type: annotationData.type ?? 'citation',
//                         start_index: data.start_index,
//                         end_index: data.end_index,
//                         annotation_index: data.annotation_index,
//                         content_index: data.content_index,
//                         text: annotationData.text,
//                         url: annotationData.doc_id,
//                         title: annotationData.doc_title,
//                         source: annotationData.source,
//                         doc_id: annotationData.doc_id,
//                         search_result_id: annotationData.search_result_id,
//                         index: annotationData.index,
//                       };
//                       setMessages((prev) =>
//                         prev.map((msg) =>
//                           msg.id === assistantMessageId
//                             ? {
//                                 ...msg,
//                                 annotations: [...(msg.annotations ?? []), annotation],
//                                 timeline: [
//                                   ...(msg.timeline ?? []),
//                                   {
//                                     type: 'annotation',
//                                     content: `Citation: ${annotation.title ?? 'Reference'}`,
//                                     timestamp: new Date(),
//                                   },
//                                 ],
//                               }
//                             : msg
//                         )
//                       );
//                     } catch { /* ignore malformed annotation */ }
//                   }
//                 }
//               } catch { /* ignore malformed streaming json */ }
//             }
//           }
//         }

//         // Mark message as complete
//         setMessages((prev) =>
//           prev.map((msg) =>
//             msg.id === assistantMessageId
//               ? {
//                   ...msg,
//                   text: assistantText && assistantText.length > 0
//                     ? assistantText
//                     : ERROR_TEXT.RESPONSE_COMPLETED,
//                   status: 'sent' as const,
//                   isStreaming: false,
//                   streamingStatus: undefined,
//                 }
//               : msg
//           )
//         );

//         return { success: true, assistantMessageId };
//       } catch (error) {
//         if (error instanceof Error && error.name === 'AbortError') {
//           setMessages((prev) =>
//             prev.map((msg) =>
//               msg.id === assistantMessageId
//                 ? {
//                     ...msg,
//                     text: '',
//                     status: 'error' as const,
//                     error: `${ERROR_TEXT.ERROR_PREFIX}\n\n${ERROR_TEXT.USER_CANCELED}`,
//                     isStreaming: false,
//                     streamingStatus: undefined,
//                   }
//                 : msg
//             )
//           );
//         } else {
//           let errorMessage: string;
//           if (
//             error instanceof TypeError &&
//             (error.message.includes('network')
//               || error.message.includes('fetch')
//               || error.message.includes('Failed to fetch'))
//           ) {
//             errorMessage = `${ERROR_TEXT.ERROR_PREFIX}\n\nConnection lost during streaming.\n\n💡 Tip: The backend server at ${config.backendUrl} stopped or crashed, network connection was interrupted, or the backend server is no longer running.`;
//           } else {
//             errorMessage = error instanceof Error
//               ? ((error as any).fullMessage ?? error.message)
//               : ERROR_TEXT.UNKNOWN_ERROR;
//           }
//           setMessages((prev) =>
//             prev.map((msg) =>
//               msg.id === assistantMessageId
//                 ? {
//                     ...msg,
//                     text: '',
//                     status: 'error' as const,
//                     error: errorMessage,
//                     isStreaming: false,
//                     streamingStatus: undefined,
//                   }
//                 : msg
//             )
//           );
//         }
//         return { success: false, error };
//       } finally {
//         setIsLoading(false);
//         abortControllerRef.current = null;
//       }
//     },
//     [isLoading, messages, selectedAgent, conversationId]
//   );

//   const cancelRequest = useCallback(() => {
//     if (abortControllerRef.current && isLoading) {
//       abortControllerRef.current.abort();
//     }
//   }, [isLoading]);

//   const clearMessages = useCallback(() => {
//     if (abortControllerRef.current && isLoading) {
//       abortControllerRef.current.abort();
//     }
//     setMessages([]);
//     setIsLoading(false);
//     abortControllerRef.current = null;
//   }, [isLoading]);

//   return {
//     messages,
//     isLoading,
//     sendMessage, // now supports sendMessage(text, { mode })
//     cancelRequest,
//     clearMessages,
//     conversationId,
//   };
// };

// tryin dashboard on 2nd


// src/hooks/useChatMessages.ts
/**
 * useChatMessages Hook (UPDATED with mode tagging and tool-name timeline)
 * - Preserves conversation context across turns by sending prior history
 * - Persists per-agent conversationId and messages in localStorage
 * - Maintains SSE streaming updates (text/status/thinking/tool/charts/annotations)
 * - NEW: Tags messages with `mode` and sends mode-filtered history
 * - NEW: Captures toolName + toolEvent in timeline for accurate sidebar status updates
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/chat';
import { ChartContent } from '../types/chart';
import { config } from '../config/env';
import { extractSqlQuery, extractVerificationInfo } from '../utils/chatUtils';
import { ERROR_TEXT, API_DEFAULTS, getApiStatusMessage } from '../constants/textConstants';
import type { Mode } from './useAgentStatus';

const MAX_MESSAGES = 100;
const MAX_TURNS_TO_SEND = 20;

/** Convert ChatMessage[] (UI state) into backend message format. Only includes textual turns. */
function toBackendMessages(history: ChatMessage[], modeFilter?: Mode) {
  return history
    .filter((m) => {
      const isTurn = (m.sender === 'user' || m.sender === 'assistant');
      const hasText = typeof m.text === 'string' && m.text.trim().length > 0;
      const modeMatches = !modeFilter || !m.mode || m.mode === modeFilter;
      return isTurn && hasText && modeMatches;
    })
    .map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: [{ type: 'text', text: m.text! }],
    }));
}

/** Create or restore a per-agent conversationId from localStorage. */
function initConversationId(agent: string): string {
  const key = `chat:${agent}:conversationId`;
  if (typeof window !== 'undefined') {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = `${agent}::${(crypto as any)?.randomUUID?.() ?? Date.now().toString()}`;
    localStorage.setItem(key, id);
    return id;
  }
  return `${agent}::${Date.now().toString()}`;
}

export const useChatMessages = (selectedAgent: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [conversationId, setConversationId] = useState<string>(() =>
    initConversationId(selectedAgent)
  );

  /** Restore persisted messages & conversationId when agent changes. */
  useEffect(() => {
    const convKey = `chat:${selectedAgent}:conversationId`;
    const restoredConvId =
      typeof window !== 'undefined' ? localStorage.getItem(convKey) : null;
    const finalConvId = restoredConvId ?? initConversationId(selectedAgent);
    setConversationId(finalConvId);

    const msgsKey = `chat:${selectedAgent}:messages`;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(msgsKey);
      if (saved) {
        try {
          const parsed: ChatMessage[] = JSON.parse(saved);
          setMessages(parsed);
        } catch {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [selectedAgent]);

  /** Persist messages on every change (per agent). */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const msgsKey = `chat:${selectedAgent}:messages`;
      try {
        localStorage.setItem(msgsKey, JSON.stringify(messages));
      } catch {
        // Ignore storage errors
      }
    }
  }, [messages, selectedAgent]);

  /** Send a message (accepts optional { mode } and stamps it on user+assistant). */
  const sendMessage = useCallback(
    async (message: string, options?: { mode?: Mode }) => {
      if (!message.trim() || isLoading) return;
      const mode = options?.mode ?? 'table';

      const previousMessages = messages;
      const historyTurns = previousMessages.slice(-MAX_TURNS_TO_SEND);
      const historyPayload = toBackendMessages(historyTurns, mode);

      const messageId = Date.now().toString();

      const userMessage: ChatMessage = {
        id: messageId + '_user',
        text: message.trim(),
        sender: 'user',
        timestamp: new Date(),
        mode,
      };

      const assistantMessageId = messageId + '_assistant';
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        text: '',
        sender: 'assistant',
        timestamp: new Date(),
        status: 'thinking',
        isStreaming: true,
        streamingStatus: undefined,
        thinkingSteps: [],
        sqlQueries: [],
        timeline: [],
        toolsUsed: [],
        mode,
      };

      setMessages((prev) => {
        const newMessages = [...prev, userMessage, assistantMessage];
        return newMessages.length > MAX_MESSAGES ? newMessages.slice(-MAX_MESSAGES) : newMessages;
      });
      setIsLoading(true);

      const requestBody = {
        messages: [
          ...historyPayload,
          { role: 'user', content: [{ type: 'text', text: message.trim() }] },
        ],
        tool_choice: { type: 'auto' },
        stream: true,
        conversation_id: conversationId,
        mode,
      };

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const backendEndpoint = `${config.backendUrl}/api/agents/${encodeURIComponent(
          selectedAgent
        )}/messages`;
        const response = await fetch(backendEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        if (!response.ok) {
          let errorMessage = `${ERROR_TEXT.API_ERROR}: ${response.status} ${response.statusText}`;
          try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
              const errorData = await response.json();
              errorMessage = errorData.errorParts
                ? errorData.errorParts.join('\n\n')
                : errorData.error ?? errorData.message ?? errorMessage;
            }
          } catch { /* ignore */ }
          const error = new Error(errorMessage);
          (error as any).fullMessage = errorMessage;
          throw error;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          const errorMessage = ERROR_TEXT.NO_READABLE_STREAM;
          const error = new Error(errorMessage);
          (error as any).fullMessage = errorMessage;
          throw error;
        }

        const decoder = new TextDecoder();
        let assistantText = '';
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (!dataStr || dataStr === '[DONE]') continue;

              try {
                const data = JSON.parse(dataStr);

                // --- streaming text
                if (currentEvent === 'response.text.delta' && data.text) {
                  assistantText += data.text;
                  const currentText = assistantText;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, text: currentText, status: 'thinking' as const, isStreaming: true }
                        : msg
                    )
                  );
                }

                // --- status
                else if (currentEvent === 'response.status' && data.message) {
                  const statusMessage = getApiStatusMessage(data.message);
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            status: 'thinking' as const,
                            streamingStatus: statusMessage,
                            thinkingSteps: (msg.thinkingSteps ?? []).includes(statusMessage)
                              ? msg.thinkingSteps
                              : [...(msg.thinkingSteps ?? []), statusMessage],
                            timeline: [
                              ...(msg.timeline ?? []),
                              { type: 'status', content: statusMessage, timestamp: new Date() },
                            ],
                          }
                        : msg
                    )
                  );
                }

                // --- tool start
                else if (currentEvent === 'response.tool_start') {
                  const toolName: string | undefined =
                    data?.tool_name ??
                    data?.name ??
                    data?.tool?.name ??
                    data?.tool?.tool_name ??
                    data?.result?.tool_name;

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            toolsUsed: [
                              ...(msg.toolsUsed ?? []),
                              { name: toolName, event: 'start', at: new Date() },
                            ],
                            timeline: [
                              ...(msg.timeline ?? []),
                              {
                                type: 'tool',
                                content: toolName ? `Tool ${toolName} started` : 'Tool started',
                                timestamp: new Date(),
                                toolName,
                                toolEvent: 'start',
                              } as any,
                            ],
                          }
                        : msg
                    )
                  );
                }

                // --- tool result (PATCHED: persist JSON payload)
                else if (currentEvent === 'response.tool_result') {
                  const toolName: string | undefined =
                    data?.tool_name ??
                    data?.name ??
                    data?.tool?.name ??
                    data?.tool?.tool_name ??
                    data?.result?.tool_name;

                  const toolStatus = API_DEFAULTS.PROCESSING_RESULTS;
                  const sqlQuery = extractSqlQuery(data);
                  const verificationInfo = extractVerificationInfo(data);

                  // ✅ NEW: normalize the tool payload we want to persist
                  const toolPayload = data?.result ?? data?.output ?? data?.payload ?? data;

                  setMessages((prev) =>
                    prev.map((msg) => {
                      if (msg.id !== assistantMessageId) return msg;

                      // ✅ NEW: attach structured JSON to the timeline tool event
                      const nextTimeline = [
                        ...(msg.timeline ?? []),
                        {
                          type: 'tool',
                          content: toolName ? `Tool ${toolName} completed` : 'Tool completed',
                          timestamp: new Date(),
                          toolName,
                          toolEvent: 'result',
                          payload: toolPayload, // <-- dashboard reads this
                        } as any,
                        ...(sqlQuery
                          ? [{ type: 'sql' as const, content: sqlQuery, timestamp: new Date() }]
                          : []),
                      ];

                      // ✅ NEW: also cache under response.tool_result (array)
                      const nextResponse = {
                        ...((msg as any).response ?? {}),
                        tool_result: [
                          ...(((msg as any).response?.tool_result as any[]) ?? []),
                          toolPayload, // <-- dashboard reads this too
                        ],
                      };

                      return {
                        ...msg,
                        status: 'thinking' as const,
                        streamingStatus: toolStatus,
                        thinkingSteps: (msg.thinkingSteps ?? []).includes(toolStatus)
                          ? msg.thinkingSteps
                          : [...(msg.thinkingSteps ?? []), toolStatus],
                        toolsUsed: [
                          ...(msg.toolsUsed ?? []),
                          { name: toolName, event: 'result', at: new Date() },
                        ],
                        sqlQueries: sqlQuery
                          ? [
                              ...(msg.sqlQueries ?? []),
                              { sql: sqlQuery, verification: verificationInfo ?? undefined },
                            ]
                          : msg.sqlQueries,
                        timeline: nextTimeline,
                        response: nextResponse,
                      };
                    })
                  );
                }

                // --- tool error
                else if (currentEvent === 'response.tool_error') {
                  const toolName: string | undefined =
                    data?.tool_name ??
                    data?.name ??
                    data?.tool?.name ??
                    data?.tool?.tool_name ??
                    data?.result?.tool_name;

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            toolsUsed: [
                              ...(msg.toolsUsed ?? []),
                              { name: toolName, event: 'error', at: new Date() },
                            ],
                            timeline: [
                              ...(msg.timeline ?? []),
                              {
                                type: 'tool',
                                content: toolName ? `Tool ${toolName} error` : 'Tool error',
                                timestamp: new Date(),
                                toolName,
                                toolEvent: 'error',
                              } as any,
                            ],
                          }
                        : msg
                    )
                  );
                }

                // --- thinking block
                else if (currentEvent === 'response.thinking' && data.thinking && data.thinking.text) {
                  const thinkingText = data.thinking.text.trim();
                  if (thinkingText) {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? {
                              ...msg,
                              status: 'thinking' as const,
                              thinkingTexts: [...(msg.thinkingTexts ?? []), thinkingText],
                              timeline: [
                                ...(msg.timeline ?? []),
                                { type: 'thinking', content: thinkingText, timestamp: new Date() },
                              ],
                            }
                          : msg
                      )
                    );
                  }
                }

                // --- thinking delta
                else if (currentEvent === 'response.thinking.delta' && data.text) {
                  const deltaText = data.text;
                  if (deltaText) {
                    setMessages((prev) =>
                      prev.map((msg) => {
                        if (msg.id === assistantMessageId) {
                          const currentThinkingTexts = msg.thinkingTexts ?? [];
                          const lastIndex = currentThinkingTexts.length - 1;
                          if (lastIndex >= 0) {
                            const updatedThinkingTexts = [...currentThinkingTexts];
                            updatedThinkingTexts[lastIndex] =
                              updatedThinkingTexts[lastIndex] + deltaText;
                            return { ...msg, status: 'thinking' as const, thinkingTexts: updatedThinkingTexts };
                          }
                          return {
                            ...msg,
                            status: 'thinking' as const,
                            thinkingTexts: [deltaText],
                            timeline: [
                              ...(msg.timeline ?? []),
                              { type: 'thinking', content: 'Processing thinking...', timestamp: new Date() },
                            ],
                          };
                        }
                        return msg;
                      })
                    );
                  }
                }

                // --- chart
                else if (currentEvent === 'response.chart') {
                  if (data.chart_spec) {
                    try {
                      const chartSpec = JSON.parse(data.chart_spec);
                      const chartContent: ChartContent = { type: 'vega-lite' as const, chart_spec: chartSpec };
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === assistantMessageId
                            ? {
                                ...msg,
                                charts: [...(msg.charts ?? []), chartContent],
                                timeline: [
                                  ...(msg.timeline ?? []),
                                  { type: 'chart', content: 'Chart visualization added', timestamp: new Date() },
                                ],
                              }
                            : msg
                        )
                      );
                    } catch { /* ignore malformed chart */ }
                  }
                }

                // --- text annotation
                else if (currentEvent === 'response.text.annotation') {
                  if (data) {
                    try {
                      const annotationData = data.annotation ?? data;
                      const annotation = {
                        type: annotationData.type ?? 'citation',
                        start_index: data.start_index,
                        end_index: data.end_index,
                        annotation_index: data.annotation_index,
                        content_index: data.content_index,
                        text: annotationData.text,
                        url: annotationData.doc_id,
                        title: annotationData.doc_title,
                        source: annotationData.source,
                        doc_id: annotationData.doc_id,
                        search_result_id: annotationData.search_result_id,
                        index: annotationData.index,
                      };
                      setMessages((prev) =>
                        prev.map((msg) =>
                          msg.id === assistantMessageId
                            ? {
                                ...msg,
                                annotations: [...(msg.annotations ?? []), annotation],
                                timeline: [
                                  ...(msg.timeline ?? []),
                                  {
                                    type: 'annotation',
                                    content: `Citation: ${annotation.title ?? 'Reference'}`,
                                    timestamp: new Date(),
                                  },
                                ],
                              }
                            : msg
                        )
                      );
                    } catch { /* ignore malformed annotation */ }
                  }
                }
              } catch { /* ignore malformed streaming json */ }
            }
          }
        }

        // Mark message as complete
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  text: assistantText && assistantText.length > 0
                    ? assistantText
                    : ERROR_TEXT.RESPONSE_COMPLETED,
                  status: 'sent' as const,
                  isStreaming: false,
                  streamingStatus: undefined,
                }
              : msg
          )
        );
        return { success: true, assistantMessageId };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    text: '',
                    status: 'error' as const,
                    error: `${ERROR_TEXT.ERROR_PREFIX}\n\n${ERROR_TEXT.USER_CANCELED}`,
                    isStreaming: false,
                    streamingStatus: undefined,
                  }
                : msg
            )
          );
        } else {
          let errorMessage: string;
          if (
            error instanceof TypeError &&
            (error.message.includes('network') ||
             error.message.includes('fetch') ||
             error.message.includes('Failed to fetch'))
          ) {
            errorMessage = `${ERROR_TEXT.ERROR_PREFIX}\n\nConnection lost during streaming.\n\n💡 Tip: The backend server at ${config.backendUrl} stopped or crashed, network connection was interrupted, or the backend server is no longer running.`;
          } else {
            errorMessage = error instanceof Error
              ? ((error as any).fullMessage ?? error.message)
              : ERROR_TEXT.UNKNOWN_ERROR;
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    text: '',
                    status: 'error' as const,
                    error: errorMessage,
                    isStreaming: false,
                    streamingStatus: undefined,
                  }
                : msg
            )
          );
        }
        return { success: false, error };
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [isLoading, messages, selectedAgent, conversationId]
  );

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current && isLoading) {
      abortControllerRef.current.abort();
    }
  }, [isLoading]);

  const clearMessages = useCallback(() => {
    if (abortControllerRef.current && isLoading) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setIsLoading(false);
    abortControllerRef.current = null;
  }, [isLoading]);

  return {
    messages,
    isLoading,
    sendMessage,     // supports sendMessage(text, { mode })
    cancelRequest,
    clearMessages,
    conversationId,
  };
};
