import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import { profileFields } from '../stories/fiction';
import type { FictionProfileProgress } from '../stories/profile-preview';

export function FictionProfileDrafts({ progress }: { progress: FictionProfileProgress }) {
  const profile = progress.profiles.at(-1);
  if (!profile) return null;
  const title = progress.phase === 'saved' ? 'Cast profiles saved' : progress.phase === 'failed' ? 'Profile update needs attention' :
    progress.phase === 'saving' ? 'Saving cast profiles' : 'Writing character profile';
  return <section className="fiction-profile-draft" aria-label={title} data-profile-phase={progress.phase}>
    <header>
      <BadgeOutlined aria-hidden="true" />
      <div>
        <p role="status">{title}{progress.point ? ' · '+progress.point : ''}</p>
        <h3>{profile.name}</h3>
      </div>
    </header>
    {progress.profiles.length>1 && <p className="fiction-profile-draft-cast">{progress.profiles.map(item=>item.name).join(' · ')}</p>}
    <dl>
      {profileFields.filter(field=>profile.sections[field]).map(field=><div key={field}>
        <dt>{field==='constraints'?'AU boundaries':field}</dt>
        <dd>{profile.sections[field]}</dd>
      </div>)}
    </dl>
  </section>;
}
