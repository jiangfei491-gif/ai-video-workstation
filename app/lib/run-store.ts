/**
 * 极简可订阅状态容器（模块级单例用）。
 * 长任务（流式/批量）放在组件外的单例里跑，组件用 useSyncExternalStore 订阅——
 * 这样切换/离开页面不会中断任务，回来还能看到进度与结果。
 */
export interface RunStore<S> {
  get: () => S;
  set: (patch: Partial<S>) => void;
  subscribe: (cb: () => void) => () => void;
}

export function createRunStore<S>(initial: S): RunStore<S> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch: Partial<S>) => {
      state = { ...state, ...patch };
      for (const l of listeners) l();
    },
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
