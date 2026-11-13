import { useMemo, useState } from 'react';
import { compileGameScene, gameDirections, moveGame, type GameDirection, type GameScene } from '../game';

const keys: Record<string, GameDirection> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
};

export function GameApp({ scene }: { scene: GameScene }) {
  const level = useMemo(() => compileGameScene(scene), [scene]);
  const [position, setPosition] = useState(level.start);
  const won = position.x === level.goal.x && position.y === level.goal.y;
  function move(direction: GameDirection) {
    setPosition(current => current.x === level.goal.x && current.y === level.goal.y ? current : moveGame(level, current, direction));
  }
  return <div className="spica-game" data-spica-part="game-viewport" data-spica-game data-player-x={position.x}
    data-player-y={position.y} data-goal-reached={won} tabIndex={0} aria-label="Playable top-down scene"
    onKeyDown={event => {
      const direction = keys[event.key];
      if (!Object.hasOwn(keys, event.key) || !direction || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      move(direction);
    }}>
    <svg viewBox={`-0.5 -0.5 ${level.width} ${level.height}`} role="img" aria-label="Player, walls, and goal">
      <rect x={-0.5} y={-0.5} width={level.width} height={level.height} fill="var(--surface)" />
      {level.walls.map(({ center }) => <rect key={`${center.x}/${center.y}`} x={center.x - .47} y={center.y - .47} width={.94} height={.94}
        rx={.12} fill="var(--line)" />)}
      <circle cx={level.goal.x} cy={level.goal.y} r={.24} fill="var(--accent)" />
      <rect x={position.x - .31} y={position.y - .31} width={.62} height={.62} rx={.16} fill="var(--ink)" />
    </svg>
    <p role="status">{won ? 'Goal reached' : 'Use the arrow keys or direction buttons to reach the goal.'}</p>
    <div className="spica-app-actions">
      {gameDirections.map(direction => <button key={direction} type="button" disabled={won} onClick={() => move(direction)}>
        {direction[0]!.toUpperCase() + direction.slice(1)}
      </button>)}
      <button type="button" onClick={() => setPosition(level.start)}>Reset scene</button>
    </div>
  </div>;
}
