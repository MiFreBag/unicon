// server/handlers/k8s_handler.js
const k8s = require('@kubernetes/client-node');
const yaml = require('js-yaml');
const { spawn } = require('child_process');

// Resource type definitions for k9s-like browsing
const RESOURCE_TYPES = {
  pods: { api: 'core', namespaced: true, kind: 'Pod' },
  deployments: { api: 'apps', namespaced: true, kind: 'Deployment' },
  services: { api: 'core', namespaced: true, kind: 'Service' },
  configmaps: { api: 'core', namespaced: true, kind: 'ConfigMap' },
  secrets: { api: 'core', namespaced: true, kind: 'Secret' },
  statefulsets: { api: 'apps', namespaced: true, kind: 'StatefulSet' },
  daemonsets: { api: 'apps', namespaced: true, kind: 'DaemonSet' },
  jobs: { api: 'batch', namespaced: true, kind: 'Job' },
  cronjobs: { api: 'batch', namespaced: true, kind: 'CronJob' },
  ingresses: { api: 'networking', namespaced: true, kind: 'Ingress' },
  persistentvolumeclaims: { api: 'core', namespaced: true, kind: 'PersistentVolumeClaim' },
  persistentvolumes: { api: 'core', namespaced: false, kind: 'PersistentVolume' },
  nodes: { api: 'core', namespaced: false, kind: 'Node' },
  namespaces: { api: 'core', namespaced: false, kind: 'Namespace' },
  events: { api: 'core', namespaced: true, kind: 'Event' },
  replicasets: { api: 'apps', namespaced: true, kind: 'ReplicaSet' },
  endpoints: { api: 'core', namespaced: true, kind: 'Endpoints' },
  serviceaccounts: { api: 'core', namespaced: true, kind: 'ServiceAccount' },
};

class K8sHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config || {};
    this.kc = null;
    this.core = null;
    this.apps = null;
    this.batch = null;
    this.networking = null;
    this.currentContext = null;
    this.logStreams = new Map();
    this.execSessions = new Map();
    this.watches = new Map();
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
      
      // Initialize all API clients
      this.core = this.kc.makeApiClient(k8s.CoreV1Api);
      this.apps = this.kc.makeApiClient(k8s.AppsV1Api);
      this.batch = this.kc.makeApiClient(k8s.BatchV1Api);
      this.networking = this.kc.makeApiClient(k8s.NetworkingV1Api);
      this.currentContext = this.kc.getCurrentContext();
      
      return { success: true, data: { context: this.currentContext } };
    } catch (e) {
      throw new Error(`K8s config load failed: ${e.message}`);
    }
  }

  async disconnect() {
    // Stop all watches
    for (const { abort } of this.watches.values()) {
      try { abort && abort(); } catch (_) {}
    }
    this.watches.clear();
    
    // Stop log streams
    for (const { cancel } of this.logStreams.values()) {
      try { cancel && cancel(); } catch (_) {}
    }
    this.logStreams.clear();
    
    // Close exec sessions
    for (const { stdin } of this.execSessions.values()) {
      try { stdin && stdin.end(); } catch (_) {}
    }
    this.execSessions.clear();
    
    // Stop port forwards
    if (this.portForwards) {
      for (const { proc } of this.portForwards.values()) {
        try { proc && proc.kill(); } catch (_) {}
      }
      this.portForwards.clear();
    }
    
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
    // Reinitialize all API clients for new context
    this.core = this.kc.makeApiClient(k8s.CoreV1Api);
    this.apps = this.kc.makeApiClient(k8s.AppsV1Api);
    this.batch = this.kc.makeApiClient(k8s.BatchV1Api);
    this.networking = this.kc.makeApiClient(k8s.NetworkingV1Api);
    return { success: true, data: { current: name } };
  }

  // Get available resource types
  getResourceTypes() {
    return { success: true, data: { resourceTypes: Object.keys(RESOURCE_TYPES) } };
  }

  async listNamespaces() {
    const res = await this.core.listNamespace();
    const items = (res.body.items || []).map(ns => ns.metadata?.name);
    return { success: true, data: { namespaces: items } };
  }

  // Generic resource listing
  async listResources(resourceType, namespace = this.config.namespace || 'default') {
    const config = RESOURCE_TYPES[resourceType];
    if (!config) throw new Error(`Unknown resource type: ${resourceType}`);

    let res;
    switch (resourceType) {
      case 'pods':
        res = config.namespaced 
          ? await this.core.listNamespacedPod(namespace)
          : await this.core.listPodForAllNamespaces();
        return { success: true, data: { items: this._formatPods(res.body.items || []) } };
      
      case 'deployments':
        res = config.namespaced
          ? await this.apps.listNamespacedDeployment(namespace)
          : await this.apps.listDeploymentForAllNamespaces();
        return { success: true, data: { items: this._formatDeployments(res.body.items || []) } };
      
      case 'services':
        res = config.namespaced
          ? await this.core.listNamespacedService(namespace)
          : await this.core.listServiceForAllNamespaces();
        return { success: true, data: { items: this._formatServices(res.body.items || []) } };
      
      case 'configmaps':
        res = config.namespaced
          ? await this.core.listNamespacedConfigMap(namespace)
          : await this.core.listConfigMapForAllNamespaces();
        return { success: true, data: { items: this._formatConfigMaps(res.body.items || []) } };
      
      case 'secrets':
        res = config.namespaced
          ? await this.core.listNamespacedSecret(namespace)
          : await this.core.listSecretForAllNamespaces();
        return { success: true, data: { items: this._formatSecrets(res.body.items || []) } };
      
      case 'statefulsets':
        res = config.namespaced
          ? await this.apps.listNamespacedStatefulSet(namespace)
          : await this.apps.listStatefulSetForAllNamespaces();
        return { success: true, data: { items: this._formatStatefulSets(res.body.items || []) } };
      
      case 'daemonsets':
        res = config.namespaced
          ? await this.apps.listNamespacedDaemonSet(namespace)
          : await this.apps.listDaemonSetForAllNamespaces();
        return { success: true, data: { items: this._formatDaemonSets(res.body.items || []) } };
      
      case 'jobs':
        res = config.namespaced
          ? await this.batch.listNamespacedJob(namespace)
          : await this.batch.listJobForAllNamespaces();
        return { success: true, data: { items: this._formatJobs(res.body.items || []) } };
      
      case 'cronjobs':
        res = config.namespaced
          ? await this.batch.listNamespacedCronJob(namespace)
          : await this.batch.listCronJobForAllNamespaces();
        return { success: true, data: { items: this._formatCronJobs(res.body.items || []) } };
      
      case 'ingresses':
        res = config.namespaced
          ? await this.networking.listNamespacedIngress(namespace)
          : await this.networking.listIngressForAllNamespaces();
        return { success: true, data: { items: this._formatIngresses(res.body.items || []) } };
      
      case 'persistentvolumeclaims':
        res = config.namespaced
          ? await this.core.listNamespacedPersistentVolumeClaim(namespace)
          : await this.core.listPersistentVolumeClaimForAllNamespaces();
        return { success: true, data: { items: this._formatPVCs(res.body.items || []) } };
      
      case 'persistentvolumes':
        res = await this.core.listPersistentVolume();
        return { success: true, data: { items: this._formatPVs(res.body.items || []) } };
      
      case 'nodes':
        res = await this.core.listNode();
        return { success: true, data: { items: this._formatNodes(res.body.items || []) } };
      
      case 'namespaces':
        res = await this.core.listNamespace();
        return { success: true, data: { items: this._formatNamespaces(res.body.items || []) } };
      
      case 'events':
        res = config.namespaced
          ? await this.core.listNamespacedEvent(namespace)
          : await this.core.listEventForAllNamespaces();
        return { success: true, data: { items: this._formatEvents(res.body.items || []) } };
      
      case 'replicasets':
        res = config.namespaced
          ? await this.apps.listNamespacedReplicaSet(namespace)
          : await this.apps.listReplicaSetForAllNamespaces();
        return { success: true, data: { items: this._formatReplicaSets(res.body.items || []) } };
      
      case 'endpoints':
        res = config.namespaced
          ? await this.core.listNamespacedEndpoints(namespace)
          : await this.core.listEndpointsForAllNamespaces();
        return { success: true, data: { items: this._formatEndpoints(res.body.items || []) } };
      
      case 'serviceaccounts':
        res = config.namespaced
          ? await this.core.listNamespacedServiceAccount(namespace)
          : await this.core.listServiceAccountForAllNamespaces();
        return { success: true, data: { items: this._formatServiceAccounts(res.body.items || []) } };
      
      default:
        throw new Error(`Resource type ${resourceType} not implemented`);
    }
  }

  // Describe resource (get YAML)
  async describeResource(resourceType, name, namespace = this.config.namespace || 'default') {
    const config = RESOURCE_TYPES[resourceType];
    if (!config) throw new Error(`Unknown resource type: ${resourceType}`);

    let res;
    switch (resourceType) {
      case 'pods':
        res = await this.core.readNamespacedPod(name, namespace);
        break;
      case 'deployments':
        res = await this.apps.readNamespacedDeployment(name, namespace);
        break;
      case 'services':
        res = await this.core.readNamespacedService(name, namespace);
        break;
      case 'configmaps':
        res = await this.core.readNamespacedConfigMap(name, namespace);
        break;
      case 'secrets':
        res = await this.core.readNamespacedSecret(name, namespace);
        break;
      case 'statefulsets':
        res = await this.apps.readNamespacedStatefulSet(name, namespace);
        break;
      case 'daemonsets':
        res = await this.apps.readNamespacedDaemonSet(name, namespace);
        break;
      case 'jobs':
        res = await this.batch.readNamespacedJob(name, namespace);
        break;
      case 'cronjobs':
        res = await this.batch.readNamespacedCronJob(name, namespace);
        break;
      case 'ingresses':
        res = await this.networking.readNamespacedIngress(name, namespace);
        break;
      case 'persistentvolumeclaims':
        res = await this.core.readNamespacedPersistentVolumeClaim(name, namespace);
        break;
      case 'persistentvolumes':
        res = await this.core.readPersistentVolume(name);
        break;
      case 'nodes':
        res = await this.core.readNode(name);
        break;
      case 'namespaces':
        res = await this.core.readNamespace(name);
        break;
      case 'replicasets':
        res = await this.apps.readNamespacedReplicaSet(name, namespace);
        break;
      case 'serviceaccounts':
        res = await this.core.readNamespacedServiceAccount(name, namespace);
        break;
      default:
        throw new Error(`Describe not implemented for ${resourceType}`);
    }

    // Clean up managed fields for cleaner YAML
    const obj = res.body;
    if (obj.metadata) {
      delete obj.metadata.managedFields;
    }

    return { 
      success: true, 
      data: { 
        resource: obj,
        yaml: yaml.dump(obj, { indent: 2, lineWidth: -1 })
      } 
    };
  }

  // Delete resource
  async deleteResource(resourceType, name, namespace = this.config.namespace || 'default') {
    const config = RESOURCE_TYPES[resourceType];
    if (!config) throw new Error(`Unknown resource type: ${resourceType}`);

    switch (resourceType) {
      case 'pods':
        await this.core.deleteNamespacedPod(name, namespace);
        break;
      case 'deployments':
        await this.apps.deleteNamespacedDeployment(name, namespace);
        break;
      case 'services':
        await this.core.deleteNamespacedService(name, namespace);
        break;
      case 'configmaps':
        await this.core.deleteNamespacedConfigMap(name, namespace);
        break;
      case 'secrets':
        await this.core.deleteNamespacedSecret(name, namespace);
        break;
      case 'statefulsets':
        await this.apps.deleteNamespacedStatefulSet(name, namespace);
        break;
      case 'daemonsets':
        await this.apps.deleteNamespacedDaemonSet(name, namespace);
        break;
      case 'jobs':
        await this.batch.deleteNamespacedJob(name, namespace);
        break;
      case 'cronjobs':
        await this.batch.deleteNamespacedCronJob(name, namespace);
        break;
      case 'ingresses':
        await this.networking.deleteNamespacedIngress(name, namespace);
        break;
      case 'persistentvolumeclaims':
        await this.core.deleteNamespacedPersistentVolumeClaim(name, namespace);
        break;
      case 'persistentvolumes':
        await this.core.deletePersistentVolume(name);
        break;
      case 'namespaces':
        await this.core.deleteNamespace(name);
        break;
      case 'replicasets':
        await this.apps.deleteNamespacedReplicaSet(name, namespace);
        break;
      case 'serviceaccounts':
        await this.core.deleteNamespacedServiceAccount(name, namespace);
        break;
      default:
        throw new Error(`Delete not implemented for ${resourceType}`);
    }

    return { success: true, data: { deleted: name } };
  }

  // Scale deployment/statefulset
  async scaleResource(resourceType, name, replicas, namespace = this.config.namespace || 'default') {
    if (!['deployments', 'statefulsets', 'replicasets'].includes(resourceType)) {
      throw new Error(`Scale not supported for ${resourceType}`);
    }

    const patch = { spec: { replicas: parseInt(replicas, 10) } };
    const options = { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } };

    switch (resourceType) {
      case 'deployments':
        await this.apps.patchNamespacedDeployment(name, namespace, patch, undefined, undefined, undefined, undefined, undefined, options);
        break;
      case 'statefulsets':
        await this.apps.patchNamespacedStatefulSet(name, namespace, patch, undefined, undefined, undefined, undefined, undefined, options);
        break;
      case 'replicasets':
        await this.apps.patchNamespacedReplicaSet(name, namespace, patch, undefined, undefined, undefined, undefined, undefined, options);
        break;
    }

    return { success: true, data: { scaled: name, replicas } };
  }

  // Restart deployment (rollout restart)
  async restartDeployment(name, namespace = this.config.namespace || 'default') {
    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
            }
          }
        }
      }
    };
    const options = { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } };
    await this.apps.patchNamespacedDeployment(name, namespace, patch, undefined, undefined, undefined, undefined, undefined, options);
    return { success: true, data: { restarted: name } };
  }

  // Apply YAML (create or update resource)
  async applyYaml(yamlContent, namespace = this.config.namespace || 'default') {
    const docs = yaml.loadAll(yamlContent);
    const results = [];

    for (const doc of docs) {
      if (!doc || !doc.kind) continue;
      
      const kind = doc.kind.toLowerCase();
      const name = doc.metadata?.name;
      const ns = doc.metadata?.namespace || namespace;
      
      try {
        // Try to get existing resource first
        let exists = false;
        try {
          await this.describeResource(kind + 's', name, ns);
          exists = true;
        } catch (_) {}

        // Use kubectl for simplicity - handles all resource types
        const result = await this.kubectl(`apply -f - -n ${ns}`, yamlContent);
        results.push({ name, kind, action: exists ? 'updated' : 'created', ...result });
      } catch (e) {
        results.push({ name, kind, error: e.message });
      }
    }

    return { success: true, data: { results } };
  }

  // Execute kubectl command
  async kubectl(args, stdin = null) {
    return new Promise((resolve, reject) => {
      const kubeconfigArg = this.config.kubeconfigPath 
        ? `--kubeconfig="${this.config.kubeconfigPath}"` 
        : '';
      const contextArg = this.currentContext 
        ? `--context=${this.currentContext}` 
        : '';
      
      const fullCmd = `kubectl ${kubeconfigArg} ${contextArg} ${args}`.trim();
      const proc = spawn('kubectl', [...(kubeconfigArg ? ['--kubeconfig', this.config.kubeconfigPath] : []), ...(contextArg ? ['--context', this.currentContext] : []), ...args.split(/\s+/)], {
        shell: true,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      if (stdin) {
        proc.stdin.write(stdin);
        proc.stdin.end();
      }

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, data: { output: stdout.trim() } });
        } else {
          reject(new Error(stderr || `kubectl exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`kubectl spawn error: ${err.message}`));
      });
    });
  }

  // Legacy listPods for backward compatibility
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

  // ========== PORT FORWARDING ==========
  
  /**
   * Start port forwarding to a pod
   * @param {Object} params - { namespace, pod, podPort, localPort }
   */
  async portForwardStart({ namespace = this.config.namespace || 'default', pod, podPort, localPort }) {
    if (!pod || !podPort) throw new Error('pod and podPort required');
    const local = localPort || podPort;
    const id = `pf-${pod}-${podPort}-${Date.now()}`;
    
    const args = [
      ...(this.config.kubeconfigPath ? ['--kubeconfig', this.config.kubeconfigPath] : []),
      ...(this.currentContext ? ['--context', this.currentContext] : []),
      '-n', namespace,
      'port-forward',
      `pod/${pod}`,
      `${local}:${podPort}`
    ];
    
    const proc = spawn('kubectl', args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let started = false;
    
    proc.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Forwarding from') && !started) {
        started = true;
        this._broadcast({ 
          type: 'k8s', 
          data: { 
            event: 'portForwardStarted', 
            connectionId: this.connectionId, 
            id, 
            pod, 
            localPort: local, 
            podPort 
          } 
        });
      }
    });
    
    proc.stderr.on('data', (data) => {
      this._broadcast({ 
        type: 'k8s', 
        data: { 
          event: 'portForwardError', 
          connectionId: this.connectionId, 
          id, 
          error: data.toString() 
        } 
      });
    });
    
    proc.on('close', (code) => {
      this.portForwards?.delete(id);
      this._broadcast({ 
        type: 'k8s', 
        data: { 
          event: 'portForwardClosed', 
          connectionId: this.connectionId, 
          id, 
          code 
        } 
      });
    });
    
    // Store the port forward
    if (!this.portForwards) this.portForwards = new Map();
    this.portForwards.set(id, { proc, pod, namespace, podPort, localPort: local });
    
    return { success: true, data: { id, localPort: local, podPort } };
  }
  
  /**
   * Stop a port forward session
   */
  async portForwardStop({ id }) {
    const pf = this.portForwards?.get(id);
    if (pf?.proc) {
      try { pf.proc.kill(); } catch (_) {}
    }
    this.portForwards?.delete(id);
    return { success: true };
  }
  
  /**
   * List active port forwards
   */
  listPortForwards() {
    const forwards = [];
    if (this.portForwards) {
      for (const [id, pf] of this.portForwards) {
        forwards.push({ id, pod: pf.pod, namespace: pf.namespace, localPort: pf.localPort, podPort: pf.podPort });
      }
    }
    return { success: true, data: { forwards } };
  }

  // ========== METRICS (kubectl top) ==========
  
  /**
   * Get pod metrics (requires metrics-server)
   */
  async getPodMetrics(namespace = this.config.namespace || 'default') {
    try {
      const metricsApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
      const res = namespace 
        ? await metricsApi.listNamespacedCustomObject('metrics.k8s.io', 'v1beta1', namespace, 'pods')
        : await metricsApi.listClusterCustomObject('metrics.k8s.io', 'v1beta1', 'pods');
      
      const items = (res.body.items || []).map(m => {
        const containers = m.containers || [];
        const totalCpu = containers.reduce((sum, c) => sum + this._parseCpu(c.usage?.cpu), 0);
        const totalMemory = containers.reduce((sum, c) => sum + this._parseMemory(c.usage?.memory), 0);
        
        return {
          name: m.metadata?.name,
          namespace: m.metadata?.namespace,
          cpu: this._formatCpu(totalCpu),
          memory: this._formatMemory(totalMemory),
          containers: containers.map(c => ({
            name: c.name,
            cpu: c.usage?.cpu,
            memory: c.usage?.memory,
          })),
        };
      });
      
      return { success: true, data: { metrics: items } };
    } catch (e) {
      // Metrics server might not be installed
      if (e.statusCode === 404) {
        return { success: false, error: 'Metrics server not available' };
      }
      throw e;
    }
  }
  
  /**
   * Get node metrics (requires metrics-server)
   */
  async getNodeMetrics() {
    try {
      const metricsApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
      const res = await metricsApi.listClusterCustomObject('metrics.k8s.io', 'v1beta1', 'nodes');
      
      const items = (res.body.items || []).map(m => ({
        name: m.metadata?.name,
        cpu: m.usage?.cpu,
        memory: m.usage?.memory,
        cpuParsed: this._formatCpu(this._parseCpu(m.usage?.cpu)),
        memoryParsed: this._formatMemory(this._parseMemory(m.usage?.memory)),
      }));
      
      return { success: true, data: { metrics: items } };
    } catch (e) {
      if (e.statusCode === 404) {
        return { success: false, error: 'Metrics server not available' };
      }
      throw e;
    }
  }
  
  // Parse CPU string (e.g., "100m", "1", "500n")
  _parseCpu(cpu) {
    if (!cpu) return 0;
    const str = String(cpu);
    if (str.endsWith('n')) return parseInt(str) / 1e9;
    if (str.endsWith('u')) return parseInt(str) / 1e6;
    if (str.endsWith('m')) return parseInt(str) / 1000;
    return parseFloat(str);
  }
  
  // Parse memory string (e.g., "128Mi", "1Gi")
  _parseMemory(mem) {
    if (!mem) return 0;
    const str = String(mem);
    const units = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, K: 1000, M: 1e6, G: 1e9 };
    for (const [unit, mult] of Object.entries(units)) {
      if (str.endsWith(unit)) {
        return parseInt(str) * mult;
      }
    }
    return parseInt(str);
  }
  
  // Format CPU cores (0.5 -> "500m")
  _formatCpu(cores) {
    if (cores < 0.001) return `${Math.round(cores * 1e6)}µ`;
    if (cores < 1) return `${Math.round(cores * 1000)}m`;
    return `${cores.toFixed(2)}`;
  }
  
  // Format memory bytes
  _formatMemory(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)}Ki`;
    if (bytes < 1024 ** 3) return `${Math.round(bytes / 1024 ** 2)}Mi`;
    return `${(bytes / 1024 ** 3).toFixed(1)}Gi`;
  }

  // ========== CONTAINER LISTING ==========
  
  /**
   * Get containers for a pod (for multi-container support)
   */
  async getContainers(namespace = this.config.namespace || 'default', pod) {
    if (!pod) throw new Error('pod required');
    const res = await this.core.readNamespacedPod(pod, namespace);
    const spec = res.body.spec || {};
    const status = res.body.status || {};
    
    const containers = (spec.containers || []).map(c => {
      const containerStatus = (status.containerStatuses || []).find(s => s.name === c.name);
      return {
        name: c.name,
        image: c.image,
        ready: containerStatus?.ready || false,
        restartCount: containerStatus?.restartCount || 0,
        state: containerStatus?.state ? Object.keys(containerStatus.state)[0] : 'unknown',
      };
    });
    
    const initContainers = (spec.initContainers || []).map(c => {
      const containerStatus = (status.initContainerStatuses || []).find(s => s.name === c.name);
      return {
        name: c.name,
        image: c.image,
        ready: containerStatus?.ready || false,
        restartCount: containerStatus?.restartCount || 0,
        state: containerStatus?.state ? Object.keys(containerStatus.state)[0] : 'unknown',
        isInit: true,
      };
    });
    
    return { success: true, data: { containers: [...initContainers, ...containers] } };
  }

  // Formatting helpers for k9s-like display
  _formatPods(items) {
    return items.map(p => {
      const containers = p.spec?.containers || [];
      const containerStatuses = p.status?.containerStatuses || [];
      const ready = containerStatuses.filter(c => c.ready).length;
      const restarts = containerStatuses.reduce((sum, c) => sum + (c.restartCount || 0), 0);
      const age = this._getAge(p.metadata?.creationTimestamp);
      
      return {
        name: p.metadata?.name,
        namespace: p.metadata?.namespace,
        ready: `${ready}/${containers.length}`,
        status: p.status?.phase,
        restarts,
        age,
        node: p.spec?.nodeName,
        ip: p.status?.podIP,
        containers: containers.map(c => c.name),
      };
    });
  }

  _formatDeployments(items) {
    return items.map(d => {
      const ready = d.status?.readyReplicas || 0;
      const desired = d.spec?.replicas || 0;
      const upToDate = d.status?.updatedReplicas || 0;
      const available = d.status?.availableReplicas || 0;
      
      return {
        name: d.metadata?.name,
        namespace: d.metadata?.namespace,
        ready: `${ready}/${desired}`,
        upToDate,
        available,
        age: this._getAge(d.metadata?.creationTimestamp),
        images: (d.spec?.template?.spec?.containers || []).map(c => c.image).join(', '),
      };
    });
  }

  _formatServices(items) {
    return items.map(s => ({
      name: s.metadata?.name,
      namespace: s.metadata?.namespace,
      type: s.spec?.type,
      clusterIP: s.spec?.clusterIP,
      externalIP: (s.status?.loadBalancer?.ingress || []).map(i => i.ip || i.hostname).join(', ') || '<none>',
      ports: (s.spec?.ports || []).map(p => `${p.port}${p.nodePort ? ':' + p.nodePort : ''}/${p.protocol}`).join(', '),
      age: this._getAge(s.metadata?.creationTimestamp),
    }));
  }

  _formatConfigMaps(items) {
    return items.map(cm => ({
      name: cm.metadata?.name,
      namespace: cm.metadata?.namespace,
      data: Object.keys(cm.data || {}).length,
      age: this._getAge(cm.metadata?.creationTimestamp),
    }));
  }

  _formatSecrets(items) {
    return items.map(s => ({
      name: s.metadata?.name,
      namespace: s.metadata?.namespace,
      type: s.type,
      data: Object.keys(s.data || {}).length,
      age: this._getAge(s.metadata?.creationTimestamp),
    }));
  }

  _formatStatefulSets(items) {
    return items.map(ss => ({
      name: ss.metadata?.name,
      namespace: ss.metadata?.namespace,
      ready: `${ss.status?.readyReplicas || 0}/${ss.spec?.replicas || 0}`,
      age: this._getAge(ss.metadata?.creationTimestamp),
    }));
  }

  _formatDaemonSets(items) {
    return items.map(ds => ({
      name: ds.metadata?.name,
      namespace: ds.metadata?.namespace,
      desired: ds.status?.desiredNumberScheduled || 0,
      current: ds.status?.currentNumberScheduled || 0,
      ready: ds.status?.numberReady || 0,
      upToDate: ds.status?.updatedNumberScheduled || 0,
      available: ds.status?.numberAvailable || 0,
      age: this._getAge(ds.metadata?.creationTimestamp),
    }));
  }

  _formatJobs(items) {
    return items.map(j => ({
      name: j.metadata?.name,
      namespace: j.metadata?.namespace,
      completions: `${j.status?.succeeded || 0}/${j.spec?.completions || 1}`,
      duration: j.status?.completionTime && j.status?.startTime 
        ? this._getDuration(j.status.startTime, j.status.completionTime)
        : '-',
      age: this._getAge(j.metadata?.creationTimestamp),
    }));
  }

  _formatCronJobs(items) {
    return items.map(cj => ({
      name: cj.metadata?.name,
      namespace: cj.metadata?.namespace,
      schedule: cj.spec?.schedule,
      suspend: cj.spec?.suspend ? 'True' : 'False',
      active: (cj.status?.active || []).length,
      lastSchedule: cj.status?.lastScheduleTime ? this._getAge(cj.status.lastScheduleTime) : '<none>',
      age: this._getAge(cj.metadata?.creationTimestamp),
    }));
  }

  _formatIngresses(items) {
    return items.map(i => {
      const rules = i.spec?.rules || [];
      const hosts = rules.map(r => r.host || '*').join(', ');
      const addresses = (i.status?.loadBalancer?.ingress || []).map(a => a.ip || a.hostname).join(', ');
      
      return {
        name: i.metadata?.name,
        namespace: i.metadata?.namespace,
        class: i.spec?.ingressClassName || '<none>',
        hosts,
        address: addresses || '<none>',
        ports: rules.some(r => (r.http?.paths || []).length > 0) ? '80' : '',
        age: this._getAge(i.metadata?.creationTimestamp),
      };
    });
  }

  _formatPVCs(items) {
    return items.map(pvc => ({
      name: pvc.metadata?.name,
      namespace: pvc.metadata?.namespace,
      status: pvc.status?.phase,
      volume: pvc.spec?.volumeName || '<none>',
      capacity: pvc.status?.capacity?.storage || '<none>',
      accessModes: (pvc.status?.accessModes || []).join(', '),
      storageClass: pvc.spec?.storageClassName || '<none>',
      age: this._getAge(pvc.metadata?.creationTimestamp),
    }));
  }

  _formatPVs(items) {
    return items.map(pv => ({
      name: pv.metadata?.name,
      capacity: pv.spec?.capacity?.storage,
      accessModes: (pv.spec?.accessModes || []).join(', '),
      reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy,
      status: pv.status?.phase,
      claim: pv.spec?.claimRef ? `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}` : '<none>',
      storageClass: pv.spec?.storageClassName || '<none>',
      age: this._getAge(pv.metadata?.creationTimestamp),
    }));
  }

  _formatNodes(items) {
    return items.map(n => {
      const conditions = n.status?.conditions || [];
      const ready = conditions.find(c => c.type === 'Ready');
      const roles = Object.keys(n.metadata?.labels || {})
        .filter(l => l.startsWith('node-role.kubernetes.io/'))
        .map(l => l.replace('node-role.kubernetes.io/', ''))
        .join(', ') || '<none>';
      
      return {
        name: n.metadata?.name,
        status: ready?.status === 'True' ? 'Ready' : 'NotReady',
        roles,
        age: this._getAge(n.metadata?.creationTimestamp),
        version: n.status?.nodeInfo?.kubeletVersion,
        internalIP: (n.status?.addresses || []).find(a => a.type === 'InternalIP')?.address,
        externalIP: (n.status?.addresses || []).find(a => a.type === 'ExternalIP')?.address || '<none>',
        os: n.status?.nodeInfo?.osImage,
        kernel: n.status?.nodeInfo?.kernelVersion,
        container: n.status?.nodeInfo?.containerRuntimeVersion,
      };
    });
  }

  _formatNamespaces(items) {
    return items.map(ns => ({
      name: ns.metadata?.name,
      status: ns.status?.phase,
      age: this._getAge(ns.metadata?.creationTimestamp),
    }));
  }

  _formatEvents(items) {
    return items.sort((a, b) => new Date(b.lastTimestamp || b.eventTime) - new Date(a.lastTimestamp || a.eventTime)).map(e => ({
      namespace: e.metadata?.namespace,
      lastSeen: this._getAge(e.lastTimestamp || e.eventTime),
      type: e.type,
      reason: e.reason,
      object: `${e.involvedObject?.kind}/${e.involvedObject?.name}`,
      message: e.message,
    }));
  }

  _formatReplicaSets(items) {
    return items.map(rs => ({
      name: rs.metadata?.name,
      namespace: rs.metadata?.namespace,
      desired: rs.spec?.replicas || 0,
      current: rs.status?.replicas || 0,
      ready: rs.status?.readyReplicas || 0,
      age: this._getAge(rs.metadata?.creationTimestamp),
    }));
  }

  _formatEndpoints(items) {
    return items.map(ep => {
      const addresses = (ep.subsets || []).flatMap(s => 
        (s.addresses || []).flatMap(a => 
          (s.ports || []).map(p => `${a.ip}:${p.port}`)
        )
      ).join(', ');
      
      return {
        name: ep.metadata?.name,
        namespace: ep.metadata?.namespace,
        endpoints: addresses || '<none>',
        age: this._getAge(ep.metadata?.creationTimestamp),
      };
    });
  }

  _formatServiceAccounts(items) {
    return items.map(sa => ({
      name: sa.metadata?.name,
      namespace: sa.metadata?.namespace,
      secrets: (sa.secrets || []).length,
      age: this._getAge(sa.metadata?.creationTimestamp),
    }));
  }

  _getAge(timestamp) {
    if (!timestamp) return '<unknown>';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 0) return `${diffDay}d`;
    if (diffHour > 0) return `${diffHour}h`;
    if (diffMin > 0) return `${diffMin}m`;
    return `${diffSec}s`;
  }

  _getDuration(start, end) {
    const diffMs = new Date(end) - new Date(start);
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffHour > 0) return `${diffHour}h${diffMin % 60}m`;
    if (diffMin > 0) return `${diffMin}m${diffSec % 60}s`;
    return `${diffSec}s`;
  }

  _broadcast(message) {
    if (global.broadcast) global.broadcast(message);
  }

  // ========== PULSE VIEW - CLUSTER HEALTH OVERVIEW ==========
  
  /**
   * Get cluster pulse/health overview (like k9s :pulse)
   */
  async getPulse() {
    try {
      // Get nodes
      const nodesRes = await this.core.listNode();
      const nodes = nodesRes.body.items || [];
      const readyNodes = nodes.filter(n => {
        const ready = (n.status?.conditions || []).find(c => c.type === 'Ready');
        return ready?.status === 'True';
      }).length;

      // Get namespaces
      const nsRes = await this.core.listNamespace();
      const namespaces = nsRes.body.items || [];

      // Get pods across all namespaces
      const podsRes = await this.core.listPodForAllNamespaces();
      const pods = podsRes.body.items || [];
      const podsByStatus = {
        running: pods.filter(p => p.status?.phase === 'Running').length,
        pending: pods.filter(p => p.status?.phase === 'Pending').length,
        failed: pods.filter(p => p.status?.phase === 'Failed').length,
        succeeded: pods.filter(p => p.status?.phase === 'Succeeded').length,
        unknown: pods.filter(p => !['Running', 'Pending', 'Failed', 'Succeeded'].includes(p.status?.phase)).length,
      };

      // Get deployments
      const deploysRes = await this.apps.listDeploymentForAllNamespaces();
      const deployments = deploysRes.body.items || [];
      const readyDeploys = deployments.filter(d => 
        d.status?.readyReplicas === d.spec?.replicas
      ).length;

      // Get recent events (warnings)
      const eventsRes = await this.core.listEventForAllNamespaces();
      const events = eventsRes.body.items || [];
      const warnings = events.filter(e => e.type === 'Warning')
        .sort((a, b) => new Date(b.lastTimestamp || b.eventTime) - new Date(a.lastTimestamp || a.eventTime))
        .slice(0, 10)
        .map(e => ({
          namespace: e.metadata?.namespace,
          age: this._getAge(e.lastTimestamp || e.eventTime),
          reason: e.reason,
          object: `${e.involvedObject?.kind}/${e.involvedObject?.name}`,
          message: e.message,
        }));

      // Try to get metrics if available
      let cpuUsage = null;
      let memoryUsage = null;
      try {
        const metricsApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
        const nodeMetrics = await metricsApi.listClusterCustomObject('metrics.k8s.io', 'v1beta1', 'nodes');
        const items = nodeMetrics.body.items || [];
        let totalCpu = 0;
        let totalMem = 0;
        for (const m of items) {
          totalCpu += this._parseCpu(m.usage?.cpu);
          totalMem += this._parseMemory(m.usage?.memory);
        }
        cpuUsage = this._formatCpu(totalCpu);
        memoryUsage = this._formatMemory(totalMem);
      } catch (_) {
        // Metrics not available
      }

      return {
        success: true,
        data: {
          cluster: {
            context: this.currentContext,
            version: nodes[0]?.status?.nodeInfo?.kubeletVersion,
          },
          nodes: {
            total: nodes.length,
            ready: readyNodes,
            notReady: nodes.length - readyNodes,
          },
          namespaces: namespaces.length,
          pods: {
            total: pods.length,
            ...podsByStatus,
          },
          deployments: {
            total: deployments.length,
            ready: readyDeploys,
          },
          metrics: cpuUsage ? { cpu: cpuUsage, memory: memoryUsage } : null,
          warnings,
        },
      };
    } catch (e) {
      throw new Error(`Failed to get pulse: ${e.message}`);
    }
  }

  // ========== NODE MANAGEMENT ==========
  
  /**
   * Cordon a node (mark unschedulable)
   */
  async cordonNode(name) {
    if (!name) throw new Error('name required');
    const patch = { spec: { unschedulable: true } };
    await this.core.patchNode(name, patch, undefined, undefined, undefined, undefined, undefined, {
      headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
    });
    return { success: true, data: { message: `Node ${name} cordoned` } };
  }

  /**
   * Uncordon a node (mark schedulable)
   */
  async uncordonNode(name) {
    if (!name) throw new Error('name required');
    const patch = { spec: { unschedulable: false } };
    await this.core.patchNode(name, patch, undefined, undefined, undefined, undefined, undefined, {
      headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
    });
    return { success: true, data: { message: `Node ${name} uncordoned` } };
  }

  /**
   * Drain a node (evict all pods, then cordon)
   * Note: This is a simplified drain - full drain would handle PDBs, DaemonSets, etc.
   */
  async drainNode(name, { force = false, ignoreDaemonSets = true, deleteEmptyDir = false } = {}) {
    if (!name) throw new Error('name required');
    
    // First cordon the node
    await this.cordonNode(name);
    
    // Get pods on this node
    const podsRes = await this.core.listPodForAllNamespaces();
    const nodePods = (podsRes.body.items || []).filter(p => p.spec?.nodeName === name);
    
    const evicted = [];
    const skipped = [];
    const errors = [];
    
    for (const pod of nodePods) {
      const podName = pod.metadata?.name;
      const ns = pod.metadata?.namespace;
      
      // Skip mirror pods (static pods)
      if (pod.metadata?.annotations?.['kubernetes.io/config.mirror']) {
        skipped.push({ name: podName, reason: 'mirror pod' });
        continue;
      }
      
      // Skip DaemonSet pods if ignoreDaemonSets
      const ownerRefs = pod.metadata?.ownerReferences || [];
      if (ignoreDaemonSets && ownerRefs.some(o => o.kind === 'DaemonSet')) {
        skipped.push({ name: podName, reason: 'DaemonSet pod' });
        continue;
      }
      
      // Check for local storage
      const volumes = pod.spec?.volumes || [];
      const hasEmptyDir = volumes.some(v => v.emptyDir);
      if (hasEmptyDir && !deleteEmptyDir && !force) {
        skipped.push({ name: podName, reason: 'has emptyDir volume' });
        continue;
      }
      
      try {
        // Try eviction first
        const eviction = {
          apiVersion: 'policy/v1',
          kind: 'Eviction',
          metadata: { name: podName, namespace: ns },
        };
        await this.core.createNamespacedPodEviction(podName, ns, eviction);
        evicted.push(podName);
      } catch (e) {
        if (force) {
          // Force delete
          try {
            await this.core.deleteNamespacedPod(podName, ns, undefined, undefined, 0);
            evicted.push(podName);
          } catch (deleteErr) {
            errors.push({ name: podName, error: deleteErr.message });
          }
        } else {
          errors.push({ name: podName, error: e.message });
        }
      }
    }
    
    return {
      success: true,
      data: {
        message: `Node ${name} drained`,
        evicted,
        skipped,
        errors,
      },
    };
  }

  // ========== EDIT YAML ==========
  
  /**
   * Update a resource from YAML
   */
  async applyYaml(yamlContent) {
    if (!yamlContent) throw new Error('yamlContent required');
    
    const doc = yaml.load(yamlContent);
    if (!doc || !doc.kind || !doc.metadata?.name) {
      throw new Error('Invalid YAML: missing kind or metadata.name');
    }
    
    const { kind, metadata, apiVersion } = doc;
    const name = metadata.name;
    const namespace = metadata.namespace || 'default';
    
    // Route to appropriate API based on kind
    let result;
    switch (kind) {
      case 'Pod':
        result = await this.core.replaceNamespacedPod(name, namespace, doc);
        break;
      case 'Deployment':
        result = await this.apps.replaceNamespacedDeployment(name, namespace, doc);
        break;
      case 'Service':
        result = await this.core.replaceNamespacedService(name, namespace, doc);
        break;
      case 'ConfigMap':
        result = await this.core.replaceNamespacedConfigMap(name, namespace, doc);
        break;
      case 'Secret':
        result = await this.core.replaceNamespacedSecret(name, namespace, doc);
        break;
      case 'StatefulSet':
        result = await this.apps.replaceNamespacedStatefulSet(name, namespace, doc);
        break;
      case 'DaemonSet':
        result = await this.apps.replaceNamespacedDaemonSet(name, namespace, doc);
        break;
      case 'Job':
        result = await this.batch.replaceNamespacedJob(name, namespace, doc);
        break;
      case 'CronJob':
        result = await this.batch.replaceNamespacedCronJob(name, namespace, doc);
        break;
      case 'Ingress':
        result = await this.networking.replaceNamespacedIngress(name, namespace, doc);
        break;
      case 'ServiceAccount':
        result = await this.core.replaceNamespacedServiceAccount(name, namespace, doc);
        break;
      case 'PersistentVolumeClaim':
        result = await this.core.replaceNamespacedPersistentVolumeClaim(name, namespace, doc);
        break;
      case 'Namespace':
        result = await this.core.replaceNamespace(name, doc);
        break;
      default:
        throw new Error(`Unsupported resource kind: ${kind}`);
    }
    
    return { success: true, data: { message: `${kind}/${name} updated` } };
  }

  /**
   * Get all available resource types
   */
  getAllResourceTypes() {
    return {
      success: true,
      data: {
        resourceTypes: Object.entries(RESOURCE_TYPES).map(([name, config]) => ({
          name,
          ...config,
        })),
      },
    };
  }
}

module.exports = K8sHandler;
module.exports.RESOURCE_TYPES = RESOURCE_TYPES;
