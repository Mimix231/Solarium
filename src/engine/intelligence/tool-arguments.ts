/**
 * Transport-only normalization for model-emitted tool arguments. The intention
 * and every user-controlled value are preserved. Do not add missing facts,
 * guess an enum, truncate text, drop unknown keys or retry a side effect here.
 */
export function decodeModelToolArguments(
  candidate: unknown,
  acceptedKeys: readonly string[],
  optionalKeys: readonly string[],
): { value: unknown; adjustments: string[] } {
  const adjustments: string[] = [];
  let value: unknown = candidate;
  if (typeof value === 'string') {
    let text = value.trim();
    const fenced = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i.exec(text);
    if (fenced) { text = fenced[1]!.trim(); adjustments.push('Removed one complete JSON code fence.'); }
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed === 'string' && attempt === 0 && /^[\s]*\{/.test(parsed)) {
          text = parsed;
          adjustments.push('Decoded a JSON-string-encoded argument object.');
          continue;
        }
        value = parsed;
      } catch { value = text; }
      break;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { value, adjustments };
  let object = value as Record<string, unknown>;
  // Some chat templates wrap the arguments in a single `arguments` key.
  // Unwrap only when that key is not itself part of the advertised contract.
  if (!acceptedKeys.includes('arguments') && Object.keys(object).length === 1 &&
      object.arguments && typeof object.arguments === 'object' && !Array.isArray(object.arguments)) {
    object = object.arguments as Record<string, unknown>;
    adjustments.push('Unwrapped the tool transport arguments envelope.');
  }
  // An optional null that has no null branch means the field was not supplied.
  // Do not touch required properties, nested values, or explicitly nullable fields.
  const nullOptional = optionalKeys.filter(key => Object.hasOwn(object,key) && object[key] === null);
  if (nullOptional.length) {
    object = { ...object };
    for (const key of nullOptional) delete object[key];
    adjustments.push(`Omitted non-nullable optional null field(s): ${nullOptional.join(', ')}.`);
  }
  return { value: object, adjustments };
}
