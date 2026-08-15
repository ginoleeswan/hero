// expo-router resolves by platform extension and throws if a route has only one
// half of the pair. The inbox is a list either way, so both halves re-export the
// same shared module — NOT each other. See the note in NotificationsScreen.tsx
// for why './notifications' here was a self-reference rather than a pointer at
// the native file.
export { default } from '../src/components/notifications/NotificationsScreen';
