import { useSyncExternalStore } from "react";

export type StoreSetter<T> = (
  partial:
    | Partial<T>
    | ((state: T) => Partial<T>),
) => void;

export type StoreGetter<T> = () => T;

export interface StoreHook<T> {
  <Selected>(selector: (state: T) => Selected): Selected;
  getState: StoreGetter<T>;
  setState: StoreSetter<T>;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Small deterministic external store tailored to ShadowiumUI.
 * It intentionally mirrors the tiny subset of Zustand used by the editor,
 * while keeping the project independent from another runtime dependency.
 */
export function createStore<T>() {
  return (
    initializer: (
      set: StoreSetter<T>,
      get: StoreGetter<T>,
    ) => T,
  ): StoreHook<T> => {
    const listeners = new Set<() => void>();
    let state: T;

    const get: StoreGetter<T> = () => state;

    const set: StoreSetter<T> = (partial) => {
      const patch =
        typeof partial === "function"
          ? partial(state)
          : partial;

      if (!patch || Object.keys(patch).length === 0) {
        return;
      }

      state = {
        ...state,
        ...patch,
      };

      for (const listener of listeners) {
        listener();
      }
    };

    const subscribe = (listener: () => void): (() => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    };

    state = initializer(set, get);

    const useStore = (<Selected>(
      selector: (current: T) => Selected,
    ): Selected =>
      useSyncExternalStore(
        subscribe,
        () => selector(state),
        () => selector(state),
      )) as StoreHook<T>;

    useStore.getState = get;
    useStore.setState = set;
    useStore.subscribe = subscribe;

    return useStore;
  };
}
