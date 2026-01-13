// /**
//  * Chat-related type definitions
//  * Centralized types for the chat interface
//  */

// export interface SqlQueryWithVerification {
//   sql: string;
//   verification?: {
//     verified_query_used?: boolean;
//     query_verified?: boolean;
//     validated?: boolean;
//     verification?: any;
//   };
// }

// export interface TextAnnotation {
//   type: string;
//   start_index?: number;
//   end_index?: number;
//   annotation_index?: number;
//   content_index?: number;
//   text?: string;
//   url?: string;
//   title?: string;
//   source?: string;
//   doc_id?: string;
//   doc_title?: string;
//   search_result_id?: string;
//   index?: number;
//   [key: string]: any; // Allow additional properties
// }

// export interface ChatMessage {
//   id: string;
//   text: string;
//   sender: 'user' | 'assistant';
//   timestamp: Date;
//   status?: 'sending' | 'sent' | 'error' | 'thinking';
//   error?: string;
//   isStreaming?: boolean;
//   streamingStatus?: string;
//   thinkingSteps?: string[];
//   thinkingTexts?: string[];
//   sqlQueries?: SqlQueryWithVerification[];
//   charts?: any[]; // Using any[] for now, can be refined based on chart types
//   annotations?: TextAnnotation[]; // Metadata about the response text (citations, sources, etc.)
//   timeline?: Array<{
//     type: 'status' | 'thinking' | 'tool' | 'sql' | 'chart' | 'annotation';
//     content: string;
//     timestamp?: Date;
//     contentIndex?: number;
//   }>;
//   toolsUsed?: string[];
// }

// export interface AccordionState {
//   collapsed: Set<string>;
//   toggle: (id: string) => void;
// }




// // src/types/chat.ts
// export interface ChatMessageModel {
//   id: string;
//   sender: 'user' | 'assistant' | 'system';
//   text?: string;
//   status: 'thinking' | 'sent' | 'error';
//   isStreaming?: boolean;

//   // NEW:
//   mode?: 'table' | 'file';    // which pane this message belongs to

//   // ... keep your other fields (sqlQueries, charts, annotations, error, etc.)
// }




//before trying dashboard


// src/types/chat.ts
// Message model used by the chat UI and streaming updates.
// Includes optional `mode` so messages can belong to "table" or "file" flows.

// import type { ChartContent } from './chart';

// export type ChatSender = 'user' | 'assistant' | 'system';
// export type ChatStatus = 'thinking' | 'sent' | 'error';
// export type ChatTimelineType = 'status' | 'tool' | 'sql' | 'thinking' | 'chart' | 'annotation';

// /** Optional per-message mode for Table/File panes */
// export type ChatMode = 'table' | 'file';

// /** Optional verification info attached to a SQL entry */
// export interface SqlVerificationInfo {
//   label?: string;
//   isVerified?: boolean;
//   note?: string;
//   // Keep loose to tolerate different shapes coming from extractVerificationInfo(...)
//   [key: string]: any;
// }

// /** One SQL entry shown under the "Executed SQL" section */
// export interface SqlEntry {
//   sql: string;
//   verification?: SqlVerificationInfo;
// }

// /** Timeline entry used by the UI to show incremental events */
// export interface TimelineEntry {
//   type: ChatTimelineType;
//   content: string;
//   timestamp: Date;

//   // NEW: optional meta for tool mapping
//   toolName?: string;
//   toolEvent?: 'start' | 'result' | 'error';
// }

// /** Annotation/citation item (shape aligned to your streaming handler) */
// export interface AnnotationItem {
//   type: string;
//   start_index?: number;
//   end_index?: number;
//   annotation_index?: number;
//   content_index?: number;
//   text?: string;
//   url?: string;
//   title?: string;
//   source?: string;
//   doc_id?: string;
//   search_result_id?: string;
//   index?: number;
//   // Allow extra fields without breaking typing
//   [key: string]: any;
// }

// /** Compatibility exports expected by existing components */
// export type TextAnnotation = AnnotationItem;
// export type SqlQueryWithVerification = SqlEntry;

// /** Core message type used everywhere */
// export interface ChatMessage {
//   id: string;
//   sender: ChatSender;

//   // Text & status
//   text?: string;
//   status?: ChatStatus;
//   isStreaming?: boolean;
//   streamingStatus?: string;
//   timestamp?: Date;

//   // NEW: per-message mode (so we can render/compute per Pane)
//   mode?: ChatMode; // 'table' | 'file'

//   // Thinking (plan/status lines + incremental deltas)
//   thinkingSteps?: string[];
//   thinkingTexts?: string[];

//   // Structured outputs
//   sqlQueries?: SqlEntry[];
//   charts?: ChartContent[];
//   annotations?: AnnotationItem[];

//   // Timeline of events
//   timeline?: TimelineEntry[];

//   // Misc
//   toolsUsed?: Array<{ name?: string; event?: string; at?: Date }>;
//   error?: string;

//   // Allow unknown extras to avoid brittle type errors during streaming
//   [key: string]: any;
// }


// trying dashboard


// src/types/chat.ts
// Message model used by the chat UI and streaming updates.
// Includes optional `mode` so messages can belong to "table" or "file" flows.

import type { ChartContent } from './chart';

export type ChatSender = 'user' | 'assistant' | 'system';
export type ChatStatus = 'thinking' | 'sent' | 'error';
export type ChatTimelineType = 'status' | 'tool' | 'sql' | 'thinking' | 'chart' | 'annotation';

/** Optional per-message mode for Table/File panes */
export type ChatMode = 'table' | 'file';

/** Optional verification info attached to a SQL entry */
export interface SqlVerificationInfo {
  label?: string;
  isVerified?: boolean;
  note?: string;
  // Keep loose to tolerate different shapes coming from extractVerificationInfo(...)
  [key: string]: any;
}

/** One SQL entry shown under the "Executed SQL" section */
export interface SqlEntry {
  sql: string;
  verification?: SqlVerificationInfo;
}

/** Timeline entry used by the UI to show incremental events */
export interface TimelineEntry {
  type: ChatTimelineType;
  content: string;
  timestamp: Date;

  // Meta for tool mapping
  toolName?: string;
  toolEvent?: 'start' | 'result' | 'error';

  // NEW: allow structured tool payloads (JSON) to be attached for the dashboard
  payload?: unknown;
  result?: unknown;
  data?: unknown;
  output?: unknown;

  // NEW: accept extra fields without breaking strict typing
  [key: string]: any;
}

/** Annotation/citation item (shape aligned to your streaming handler) */
export interface AnnotationItem {
  type: string;
  start_index?: number;
  end_index?: number;
  annotation_index?: number;
  content_index?: number;
  text?: string;
  url?: string;
  title?: string;
  source?: string;
  doc_id?: string;
  search_result_id?: string;
  index?: number;
  // Allow extra fields without breaking typing
  [key: string]: any;
}

/** Compatibility exports expected by existing components */
export type TextAnnotation = AnnotationItem;
export type SqlQueryWithVerification = SqlEntry;

/** Core message type used everywhere */
export interface ChatMessage {
  id: string;
  sender: ChatSender;

  // Text & status
  text?: string;
  status?: ChatStatus;
  isStreaming?: boolean;
  streamingStatus?: string;
  timestamp?: Date;

  // NEW: per-message mode (so we can render/compute per Pane)
  mode?: ChatMode; // 'table' | 'file'

  // Thinking (plan/status lines + incremental deltas)
  thinkingSteps?: string[];
  thinkingTexts?: string[];

  // Structured outputs
  sqlQueries?: SqlEntry[];
  charts?: ChartContent[];
  annotations?: AnnotationItem[];

  // Timeline of events
  timeline?: TimelineEntry[];

  // Misc
  toolsUsed?: Array<{ name?: string; event?: string; at?: Date }>;
  error?: string;

  // Allow unknown extras to avoid brittle type errors during streaming
  [key: string]: any;
}
