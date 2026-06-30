import { GettingStartedCard } from 'mythique-ds';
const noop = () => {};

export const InProgress = () => (
  <div style={{ width: 380, padding: 16, background: '#f5ebdc' }}>
    <GettingStartedCard
      steps={[
        { id: 'save', icon: 'heart', label: 'Save your first hero', done: true, onPress: noop },
        { id: 'vote', icon: 'flash', label: 'Vote in the Arena', done: false, onPress: noop },
        { id: 'team', icon: 'people', label: 'Build a team', done: false, onPress: noop },
        {
          id: 'compare',
          icon: 'git-compare',
          label: 'Compare two heroes',
          done: false,
          onPress: noop,
        },
      ]}
    />
  </div>
);

export const AlmostDone = () => (
  <div style={{ width: 380, padding: 16, background: '#f5ebdc' }}>
    <GettingStartedCard
      steps={[
        { id: 'save', icon: 'heart', label: 'Save your first hero', done: true, onPress: noop },
        { id: 'vote', icon: 'flash', label: 'Vote in the Arena', done: true, onPress: noop },
        { id: 'team', icon: 'people', label: 'Build a team', done: false, onPress: noop },
      ]}
    />
  </div>
);
