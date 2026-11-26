import type { SpicaTaskPlan } from '../../engine/intelligence/spica-task-orchestrator';

/** Original transparent vector scenery: decorative only, never a screenshot of
 * a dashboard. The surrounding controls remain accessible DOM buttons. */
export function CosmicCastleAccent(){
  return <svg className="cosmic-castle-accent" viewBox="0 0 330 150" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cosmic-castle-stone" x1="0" y1="0" x2=".75" y2="1">
        <stop offset="0%" stopColor="#bfa0fc" stopOpacity=".78"/><stop offset="52%" stopColor="#6038af" stopOpacity=".62"/><stop offset="100%" stopColor="#271a60" stopOpacity=".1"/>
      </linearGradient>
      <linearGradient id="cosmic-castle-hills" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#49359c" stopOpacity="0"/><stop offset="75%" stopColor="#aa65e7" stopOpacity=".66"/><stop offset="100%" stopColor="#5535af" stopOpacity=".25"/>
      </linearGradient>
    </defs>
    <path d="M0 151L90 128 127 140 160 104 191 133 223 87 257 119 292 76 330 124 330 150Z" fill="url(#cosmic-castle-hills)"/>
    <path d="M183 132V85L196 76 204 85V49L216 37 229 49V97H245V62L256 50 267 62V95H283V68L293 55 306 68V132Z" fill="url(#cosmic-castle-stone)" stroke="#aa84fb" strokeOpacity=".55"/>
    <path d="M196 76V56H204V34L217 5 229 34V49M245 62V41L256 16 267 41V62M283 68V51L294 26 306 51V68" fill="#ad81fc" fillOpacity=".68" stroke="#e2c3ff" strokeOpacity=".45"/>
    <path d="M211 97V84H219V97M250 83V71H257V83M292 91V78H299V91" stroke="#76f7ff" strokeWidth="3" strokeLinecap="round"/>
    <path d="M171 141Q244 117 330 147" stroke="#95efff" strokeOpacity=".35" fill="none" strokeWidth="2"/>
    <g fill="#d2ffff" opacity=".75"><circle cx="168" cy="42" r="1.5"/><circle cx="288" cy="12" r="1.4"/><circle cx="314" cy="39" r="1.1"/></g>
  </svg>;
}
/** The banner is backed by real Plan state and has real navigation actions. */
export function CosmicBuildBanner({plan,onOpenPlan,onOpenWorkbench}:{plan:SpicaTaskPlan;onOpenPlan:()=>void;onOpenWorkbench:()=>void}){
  const complete=plan.steps.filter(step=>step.state==='completed').length;
  const active=plan.steps.find(step=>step.state==='active');
  return <section className="cosmic-build-banner" aria-label="Current SPICA construction task">
    <CosmicCastleAccent/>
    <div className="cosmic-build-banner-copy">
      <span className="cosmic-build-eyebrow">SPICA · APPLICATION CONSTRUCTION</span>
      <strong>{plan.goal}</strong>
      <span className="cosmic-build-subtitle">{active?.title??'Awaiting next verified action'} · {complete}/{plan.steps.length} stages · Revision {plan.graphRevision??'—'}</span>
      <div className="cosmic-build-banner-actions">
        <button type="button" onClick={onOpenPlan} aria-label="Open full SPICA build plan">View Plan</button>
        <button type="button" onClick={onOpenWorkbench} aria-label="Open SPICA workbench">Open Workbench</button>
      </div>
    </div>
  </section>;
}
