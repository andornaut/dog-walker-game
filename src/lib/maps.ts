// A Map or WeakMap, as getOrInsert uses it.
interface KeyedStore<Key, Value> {
  get(key: Key): Value | undefined;
  set(key: Key, value: Value): unknown;
}

// The value store holds for key, made by create and stored the first time it is asked for.
export function getOrInsert<Key, Value>(
  store: KeyedStore<Key, Value>,
  key: Key,
  create: () => Value,
): Value {
  let value = store.get(key);
  if (value === undefined) {
    value = create();
    store.set(key, value);
  }
  return value;
}
