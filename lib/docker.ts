import http from 'node:http';

export interface ContainerInfo {
  exists: boolean;
  running: boolean;
  status: string;
  id?: string;
  created?: string;
  startedAt?: string;
  cpuPercent?: number;
  memoryMb?: number;
}

export function dockerRequest<T = any>(
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: T }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: '/var/run/docker.sock',
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode || 200,
              data: raw ? (JSON.parse(raw) as T) : (null as any),
            });
          } catch {
            resolve({
              status: res.statusCode || 200,
              data: raw as any,
            });
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

export async function getContainerStatus(containerName: string): Promise<ContainerInfo> {
  try {
    const res = await dockerRequest<any>('GET', `/containers/${containerName}/json`);
    if (res.status === 404 || !res.data) {
      return { exists: false, running: false, status: 'not_found' };
    }

    const state = res.data.State || {};
    const running = Boolean(state.Running);
    const status = state.Status || (running ? 'running' : 'exited');

    let cpuPercent = 0;
    let memoryMb = 0;

    if (running) {
      try {
        const statsRes = await dockerRequest<any>(
          'GET',
          `/containers/${containerName}/stats?stream=false`
        );
        if (statsRes.status === 200 && statsRes.data) {
          const stats = statsRes.data;
          const memUsage = stats.memory_stats?.usage || 0;
          memoryMb = Math.round((memUsage / (1024 * 1024)) * 10) / 10;

          const cpuDelta =
            (stats.cpu_stats?.cpu_usage?.total_usage || 0) -
            (stats.precpu_stats?.cpu_usage?.total_usage || 0);
          const systemDelta =
            (stats.cpu_stats?.system_cpu_usage || 0) -
            (stats.precpu_stats?.system_cpu_usage || 0);
          const numCpus = stats.cpu_stats?.online_cpus || 1;

          if (systemDelta > 0 && cpuDelta > 0) {
            cpuPercent = Math.round(((cpuDelta / systemDelta) * numCpus * 100) * 10) / 10;
          }
        }
      } catch {
        // Stats parsing fallback
      }
    }

    return {
      exists: true,
      running,
      status,
      id: res.data.Id?.slice(0, 12),
      created: res.data.Created,
      startedAt: state.StartedAt,
      cpuPercent,
      memoryMb,
    };
  } catch (err: any) {
    return { exists: false, running: false, status: 'error' };
  }
}

export async function startContainer(containerName: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await dockerRequest('POST', `/containers/${containerName}/start`);
    if (res.status === 204 || res.status === 304) {
      return { ok: true };
    }
    return { ok: false, error: `Docker returned status ${res.status}: ${JSON.stringify(res.data)}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function stopContainer(
  containerName: string,
  timeoutSeconds = 5
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await dockerRequest('POST', `/containers/${containerName}/stop?t=${timeoutSeconds}`);
    if (res.status === 204 || res.status === 304) {
      return { ok: true };
    }
    return { ok: false, error: `Docker returned status ${res.status}: ${JSON.stringify(res.data)}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function getContainerLogs(containerName: string, tail = 80): Promise<string> {
  try {
    const res = await dockerRequest<string>(
      'GET',
      `/containers/${containerName}/logs?stdout=1&stderr=1&tail=${tail}&timestamps=1`
    );
    if (typeof res.data === 'string') {
      // Clean Docker multiplex stream header prefixes (8-byte headers per frame)
      return res.data.replace(/[\u0000-\u001F\u007F-\u009F]{8}/g, '');
    }
    return '';
  } catch (err: any) {
    return `Failed to read container logs: ${err.message}`;
  }
}
