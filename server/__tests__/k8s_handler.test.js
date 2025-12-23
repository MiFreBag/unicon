jest.mock('@kubernetes/client-node', () => {
  class KubeConfig {
    loadFromString() {}
    loadFromFile() {}
    loadFromDefault() {}
    setCurrentContext(ctx) { this._ctx = ctx; }
    getCurrentContext() { return this._ctx || 'mock-ctx'; }
    getContexts() { return [{ name: 'mock-ctx' }, { name: 'other-ctx' }]; }
    makeApiClient(cls) { return new CoreV1Api(); }
  }
  class CoreV1Api {
    async listNamespace() { return { body: { items: [{ metadata: { name: 'default' } }, { metadata: { name: 'kube-system' } }] } }; }
    async listNamespacedPod(ns) {
      return { body: { items: [{ metadata: { name: 'p1', namespace: ns }, status: { phase: 'Running' }, spec: { containers: [{ name: 'c1' }] } }] } };
    }
  }
  class Log {
    constructor(kc) {}
    async log(ns, pod, container, stream, _tty, follow, tailLines) {
      process.nextTick(() => { stream.emit('data', Buffer.from('log-line\n')); });
      return { abort: () => {} };
    }
  }
  class Exec {
    constructor(kc) {}
    async exec(ns, pod, container, command, stdout, stderr, stdin, tty) {
      process.nextTick(() => { stdout.emit('data', Buffer.from('exec-out')); });
    }
  }
  return { KubeConfig, CoreV1Api, Log, Exec };
});

global.broadcast = jest.fn();

const K8sHandler = require('../handlers/k8s_handler');

describe('K8sHandler', () => {
  test('connect, list namespaces, list pods, logs and exec', async () => {
    const h = new K8sHandler('k-1', { context: 'mock-ctx', namespace: 'default' });
    const connRes = await h.connect();
    expect(connRes.success).toBe(true);

    const nsRes = await h.listNamespaces();
    expect(nsRes.success).toBe(true);
    expect(nsRes.data.namespaces).toContain('default');

    const podsRes = await h.listPods('default');
    expect(podsRes.success).toBe(true);
    expect(podsRes.data.pods[0].name).toBe('p1');

    const logsStart = await h.logsStart({ namespace: 'default', pod: 'p1' });
    expect(logsStart.success).toBe(true);
    // broadcast called with a log line
    await new Promise((r) => setTimeout(r, 10));
    expect(global.broadcast).toHaveBeenCalled();

    await h.logsStop({ id: logsStart.data.id });

    const execOpen = await h.execOpen({ namespace: 'default', pod: 'p1', command: ['/bin/sh'], tty: true });
    expect(execOpen.success).toBe(true);
    await h.execInput({ id: execOpen.data.id, data: 'echo x\n' });
    await h.execClose({ id: execOpen.data.id });

    const disc = await h.disconnect();
    expect(disc.success).toBe(true);
  });
});
