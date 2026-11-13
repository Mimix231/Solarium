import { styleProperties, type StyleChange, type StyleValue } from '../spica/appearance';
import type { Collection, CollectionField, GraphEdit } from '../spica/graph';
import './spica-preview.css';

type Review = {
  graph: { fromRevision: number; toRevision: number; addedFields: CollectionField[] };
  appearance?: StyleChange[];
  behavior?: { collections: Collection[]; grants?: string[] };
  database?: string;
};

function Value({ value }: { value: StyleValue | null }) {
  return <span className="spica-review-value">
    {typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) && <span className="spica-swatch" style={{ backgroundColor: value }} aria-hidden="true" />}
    {value ?? 'Inherited'}
  </span>;
}

export function SpicaEditReview({ args }: { args: Record<string, unknown> }) {
  const review = args.review as Review | undefined;
  const edits = Array.isArray(args.edits) ? args.edits as GraphEdit[] : [];
  const added = new Set(edits.flatMap(edit => edit.op === 'add_collection' ? [edit.collection.id] : []));
  const grants = edits.flatMap(edit => {
    if (edit.op === 'set_capability') return [{ id: edit.capability, enabled: edit.enabled }];
    if (edit.op === 'grant_capability' || edit.op === 'revoke_capability') return [{ id: edit.capability, enabled: edit.op === 'grant_capability' }];
    return [];
  });
  return <div className="spica-edit-review">
    {review && <>
      <p>Graph revision {review.graph.fromRevision} → {review.graph.toRevision}</p>
      {review.appearance?.length ? <ul aria-label="Proposed appearance changes">
        {review.appearance.map(change => <li key={`${change.target}/${change.state}/${change.property}`}>
          <strong>{change.label}</strong>
          <span>{styleProperties[change.property].label}{change.state !== 'base' && ` · ${change.state}`}</span>
          <div><Value value={change.before} /><span aria-label="changes to">→</span><Value value={change.after} /></div>
        </li>)}
      </ul> : null}
      {review.graph.addedFields.length > 0 && <>
        <ul aria-label="Proposed collection fields">{review.graph.addedFields.map(field => <li key={field.key}>
          <strong>{field.label} ({field.key})</strong><span>{field.type} · Default {JSON.stringify(field.initial)}</span>
        </li>)}</ul>
        <p>{review.database}</p>
      </>}
      {review.behavior?.collections.filter(collection => added.has(collection.id)).map(collection => <div key={collection.id}>
        <strong>New collection · {collection.label}</strong>
        <ul>{collection.fields.map(field => <li key={field.key}>{field.label} ({field.key}) · {field.type} · Default {JSON.stringify(field.initial)}</li>)}</ul>
      </div>)}
      {grants.length > 0 && <ul aria-label="Proposed app capability changes">
        {grants.map(edit => <li key={edit.id}>{edit.enabled ? 'Grant' : 'Remove'} {edit.id}</li>)}
      </ul>}
    </>}
    <details open={review ? undefined : true}>
      <summary>Graph edit details</summary>
      <pre>{JSON.stringify(args.edits, null, 2)}</pre>
    </details>
  </div>;
}
