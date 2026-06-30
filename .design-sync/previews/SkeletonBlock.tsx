import { SkeletonBlock } from 'mythique-ds';

export const LoadingCard = () => (
  <div
    style={{
      width: 320,
      padding: 20,
      background: '#f5ebdc',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}
  >
    <SkeletonBlock width={180} height={150} borderRadius={10} />
    <SkeletonBlock width={'80%'} height={16} borderRadius={6} />
    <SkeletonBlock width={'55%'} height={16} borderRadius={6} />
  </div>
);

export const Lines = () => (
  <div
    style={{
      width: 320,
      padding: 20,
      background: '#f5ebdc',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}
  >
    <SkeletonBlock width={'100%'} height={14} />
    <SkeletonBlock width={'92%'} height={14} />
    <SkeletonBlock width={'70%'} height={14} />
  </div>
);
