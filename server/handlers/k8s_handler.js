// server/handlers/k8s_handler.js
const k8s = require('@kubernetes/client-node');

class K8sHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config || {};
    this.kc = null;
    this.core = null;
    this.currentContext = null;
    this.logStreams = new Map(); // id -> { cancel }
    this.execSessions = new Map(); // id -> { stdin, stdout, stderr }
  }

  async connect() {
    this.kc = new k8s.KubeConfig();
    const { kubeconfig, kubeconfigPath, context } = this.config;
    try {
      if (kubeconfig && typeof kubeconfig === 'string' && kubeconfig.trim()) {
        this.kc.loadFromString(kubeconfig);
      } else if (kubeconfigPath && typeof kubeconfigPath === 'string' && kubeconfigPath.trim()) {
        this.kc.loadFromFile(kubeconfigPath);
      } else {
        this.kc.loadFromDefault();
      }
      if (context) this.kc.setCurrentContext(context);
      this.core = this.kc.makeApiClient(k8s.CoreV1Api);
      this.currentContext = this.kc.getCurrentContext();
      return { success: true, data: { context: this.currentContext } };
    } catch (e) {
      throw new Error(`K8s config load failed: ${e.message}`);
    }
  }

  async disconnect() {
    // Stop any running streams
    for (const { cancel } of this.logStreams.values()) {
      try { cancel && cancel(); } catch (_) {}
    }
    this.logStreams.clear();
    for (const { stdin } of this.execSessions.values()) {
      try { stdin && stdin.end(); } catch (_) {}
    }
    this.execSessions.clear();
    return { success: true };
  }

  listContexts() {
    const contexts = this.kc.getContexts() || [];
    const current = this.kc.getCurrentContext();
    return { success: true, data: { contexts, current } };
  }

  useContext(name) {
    this.kc.setCurrentContext(name);
    this.currentContext = name;
    this.core = this.kc.makeApiClient(k8s.CoreV1Api);
    return { success: true, data: { current: name } };
  }

  async listNamespaces() {
    const res = await this.core.listNamespace();
    const items = (res.body.items || []).map(ns => ns.metadata?.name);
    return { success: true, data: { namespaces: items } };
  }

  async listPods(namespace = this.config.namespace || 'default') {
    const res = await this.core.listNamespacedPod(namespace);
    const pods = (res.body.items || []).map(p => ({
      name: p.metadata?.name,
      namespace: p.metadata?.namespace,
      phase: p.status?.phase,
      containers: (p.spec?.containers || []).map(c => c.name),
    }));
    return { success: true, data: { pods } };
  }

  async logsStart({ namespace = this.config.namespace || 'default', pod, container, tailLines = 200 }) {
    if (!pod) throw new Error('pod required');
    const log = new k8s.Log(this.kc);
    const stream = new (require('stream').PassThrough)();
    const id = `${pod}-${Date.now()}`;
    stream.on('data', (chunk) => {
      const line = chunk.toString();
      this._broadcast({ type: 'k8s', data: { event: 'logLine', connectionId: this.connectionId, id, pod, container, line } });
    });
    const cancel = await log.log(namespace, pod, container || undefined, stream, undefined, true, tailLines, false).catch((e) => { throw new Error(`logs failed: ${e.message}`); });
    // @kubernetes/client-node returns a request; set cancel function
    const abort = () => {
      try { cancel && cancel.abort && cancel.abort(); } catch (_) {}
      try { stream.end(); } catch (_) {}
    };
    this.logStreams.set(id, { cancel: abort });
    return { success: true, data: { id } };
  }

  async logsStop({ id }) {
    const s = this.logStreams.get(id);
    if (s && s.cancel) s.cancel();
    this.logStreams.delete(id);
    return { success: true };
  }

  async execOpen({ namespace = this.config.namespace || 'default', pod, container, command = ['/bin/sh'], tty = true }) {
    if (!pod) throw new Error('pod required');
    const exec = new k8s.Exec(this.kc);
    const { PassThrough } = require('stream');
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const stdin = new PassThrough();
    const id = `${pod}-exec-${Date.now()}`;
    const onData = (buf, streamName) => {
      this._broadcast({ type: 'k8s', data: { event: 'execOut', connectionId: this.connectionId, id, pod, container, stream: streamName, data: buf.toString('utf8') } });
    };
    stdout.on('data', (b) => onData(b, 'stdout'));
    stderr.on('data', (b) => onData(b, 'stderr'));
    await exec.exec(namespace, pod, container || undefined, command, stdout, stderr, stdin, tty);
    this.execSessions.set(id, { stdin, stdout, stderr });
    return { success: true, data: { id } };
  }

  async execInput({ id, data }) {
    const s = this.execSessions.get(id);
    if (!s) throw new Error('exec session not found');
    s.stdin.write(data);
    return { success: true };
  }

  async execClose({ id }) {
    const s = this.execSessions.get(id);
    if (!s) return { success: true };
    try { s.stdin.end(); } catch (_) {}
    this.execSessions.delete(id);
    return { success: true };
  }

  _broadcast(message) {
    if (global.broadcast) global.broadcast(message);
  }
}

module.exports = K8sHandler;
