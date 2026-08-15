// Both halves of this route re-export ONE shared module, and neither re-exports
// the other. `export { default } from './notifications'` in the web half looked
// like it pointed at this file; on web Metro resolved it back to
// notifications.web.tsx itself, which made that module's `default` getter return
// its own `default` and killed static rendering for the whole app. See the note
// in NotificationsScreen.tsx.
export { default } from '../src/components/notifications/NotificationsScreen';
