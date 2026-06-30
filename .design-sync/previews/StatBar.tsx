import { StatBar } from 'mythique-ds';

const card = { width: 340, padding: 20, background: '#f5ebdc', borderRadius: 12 } as const;

export const Attributes = () => (
  <div style={card}>
    <StatBar label="Strength" value="83" color="#E77333" />
    <StatBar label="Intelligence" value="64" color="#15A1AB" />
    <StatBar label="Speed" value="91" color="#63A936" />
    <StatBar label="Durability" value="77" color="#F9B222" />
    <StatBar label="Combat" value="58" color="#B5302B" />
  </div>
);

export const SingleStat = () => (
  <div style={card}>
    <StatBar label="Power" value="100" color="#E77333" />
  </div>
);
