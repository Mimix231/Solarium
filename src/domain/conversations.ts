import { now, uid, type ChatSession } from './types';

/** Fork a conversation at an existing message without modifying the original. */
export function forkChatSession(source: ChatSession, messageId: string): ChatSession | null {
  const messageIndex = source.messages.findIndex((message) => message.id === messageId);
  if (messageIndex < 0) return null;

  const timestamp = now();
  return {
    id: uid(),
    parentSessionId: source.id,
    forkMessageId: messageId,
    title: `${source.title} (branch)`,
    sparkId: source.sparkId,
    modelId: source.modelId, projectId: source.projectId ?? null,
    mode: source.mode,
    createdAt: timestamp,
    updatedAt: timestamp,
    // A branch gets its own copy, even when later edits change past messages.
    messages: structuredClone(source.messages.slice(0, messageIndex + 1)),
  };
}

/**
 * Retry or edit a user turn in-place. All later turns are removed so the model
 * never sees replies from an obsolete conversational branch. Existing user
 * attachments, IDs, project and model selections remain unchanged.
 */
export function rewindChatSession(source: ChatSession, messageId: string, editedContent?: string): ChatSession | null {
  const index = source.messages.findIndex((message) => message.id === messageId && message.role === 'user');
  if (index < 0) return null;
  if (editedContent !== undefined && !editedContent.trim()) return null;

  const messages = structuredClone(source.messages.slice(0, index + 1));
  const selected = messages[index];
  if (!selected) return null;
  if (editedContent !== undefined) selected.content = editedContent.trim();

  const firstUser = messages.find((message) => message.role === 'user');
  const previousFirstUser = source.messages.find((message) => message.role === 'user');
  // Only update the auto-generated conversation title. Leave custom titles alone.
  const previousAutoTitle = previousFirstUser?.content.slice(0, 47).trim() || 'New conversation';
  const title = firstUser && previousFirstUser?.id === selected.id && source.title === previousAutoTitle
    ? (selected.content.slice(0, 47).trim() || source.title)
    : source.title;

  return { ...source, title, updatedAt: now(), messages };
}
