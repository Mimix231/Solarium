import AutoStoriesRounded from '@mui/icons-material/AutoStoriesRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import Fade from '@mui/material/Fade';
import type { WritingInterlude } from '../writing/long-task';

const stages = [
  { key: 'saving', label: 'Save draft' },
  { key: 'recalling', label: 'Carry cast and continuity' },
  { key: 'planning', label: 'Plan the next beat' },
] as const;

export function ChapterContinuation({ detail, active }: { detail: WritingInterlude | undefined; active: boolean }) {
  if (!detail) return null;
  const repair = detail.stage === 'repairing';
  const title=repair?'Revising the draft':detail.operation==='plan'?'Continuing chapter planning':
    detail.operation==='review'?'Checking the saved passage':'Continuing this scene';
  const current = detail.stage === 'ready' ? stages.length : stages.findIndex(stage => stage.key === detail.stage);
  const text = repair ? 'Refining a passage in this scene' : detail.cause === 'capacity'
    ? detail.operation?'The current work is saved. The Spark is using a shorter reference packet.':
      'The model reached its current limit. The scene will pick up from here.'
    : 'This scene still has an action to complete.';
  return <Fade in={active} timeout={{ enter: 260, exit: 220 }} mountOnEnter unmountOnExit>
    <aside role="status" aria-live="polite" className="chapter-continuation" data-stage={detail.stage} aria-label={repair ? 'Live prose revision' : 'Scene continuation'}>
      <div className="chapter-continuation-icon"><AutoStoriesRounded aria-hidden="true" fontSize="small" /></div>
      <div className="chapter-continuation-content">
        <h2>{title}</h2>
        <p>{text}</p>
        {!repair && <ol className="chapter-continuation-steps">
          {stages.map((stage, i) => <li key={stage.key} data-passed={i < current} aria-current={i === current ? 'step' : undefined}>
            <span className="chapter-step-mark" aria-hidden="true">{i < current && <CheckRounded />}</span>{stage.label}
          </li>)}
        </ol>}
        <div className="chapter-continuation-context">
          <span>{detail.savedCharacters.toLocaleString()} characters saved</span>
          {detail.characterNames.length > 0 && <span>{detail.characterNames.slice(0, 6).join(', ')}</span>}
        </div>
        {detail.facts?.length ? <p className="chapter-continuation-memory">{detail.facts.at(-1)}</p> : null}
        {detail.nextBeat && <div className="chapter-continuation-beat"><strong>Next in {detail.title}</strong><p>{detail.nextBeat}</p></div>}
      </div>
    </aside>
  </Fade>;
}
