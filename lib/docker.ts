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

export function dockerBufferRequest(
  method: string,
  path: string,
  body?: any
): Promise<{ status: number; data: Buffer }> {
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
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 200,
            data: Buffer.concat(chunks),
          });
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

export async function restartContainer(
  containerName: string,
  timeoutSeconds = 5
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await dockerRequest('POST', `/containers/${containerName}/restart?t=${timeoutSeconds}`);
    if (res.status === 204 || res.status === 200 || res.status === 304) {
      return { ok: true };
    }
    return { ok: false, error: `Docker returned status ${res.status}: ${JSON.stringify(res.data)}` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export interface LogEntry {
  id: string;
  timestamp: string;
  stream: 'stdout' | 'stderr';
  level: 'info' | 'warn' | 'error' | 'debug' | 'http';
  message: string;
  raw: string;
}

export async function getParsedContainerLogs(
  containerName: string,
  tail = 200
): Promise<{ entries: LogEntry[]; rawText: string; error?: string }> {
  try {
    const res = await dockerBufferRequest(
      'GET',
      `/containers/${containerName}/logs?stdout=1&stderr=1&tail=${tail}&timestamps=1`
    );
    if (res.status !== 200) {
      return {
        entries: [],
        rawText: `Error: Docker daemon returned status ${res.status}: ${res.data.toString('utf8')}`,
        error: `Docker status ${res.status}`,
      };
    }

    const buf = res.data;
    let offset = 0;
    const entries: LogEntry[] = [];
    const textLines: string[] = [];

    while (offset + 8 <= buf.length) {
      const streamByte = buf[offset];
      const stream: 'stdout' | 'stderr' = streamByte === 2 ? 'stderr' : 'stdout';
      const size = buf.readUInt32BE(offset + 4);
      offset += 8;

      if (size > 0 && offset + size <= buf.length) {
        const lineStr = buf.toString('utf8', offset, offset + size);
        offset += size;

        // Split multi-line payloads within a frame if any
        const subLines = lineStr.split('\n');
        for (let i = 0; i < subLines.length; i++) {
          const l = subLines[i];
          if (!l.trim() && i === subLines.length - 1) continue;

          // Docker timestamp format: 2026-09-15T23:28:51.717292546Z <rest>
          let timestamp = '';
          let msg = l;
          const tsMatch = l.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z)\s+(.*)$/);
          if (tsMatch) {
            timestamp = tsMatch[1];
            msg = tsMatch[3];
          }

          // Strip ANSI formatting for level detection
          const cleanText = msg.replace(/\u001b\[[0-9;]*m/g, '');

          // Detect level
          let level: LogEntry['level'] = stream === 'stderr' ? 'warn' : 'info';
          const lower = cleanText.toLowerCase();

          if (
            lower.includes('error') ||
            lower.includes('fatal') ||
            lower.includes('exception') ||
            lower.includes('fail') ||
            lower.includes('rejected') ||
            lower.includes('err_') ||
            lower.includes('trace:')
          ) {
            level = 'error';
          } else if (
            lower.includes('warn') ||
            lower.includes('no certificate') ||
            lower.includes('terminating') ||
            lower.includes('unauthorized') ||
            lower.includes('forbidden')
          ) {
            level = 'warn';
          } else if (
            /\b(get|post|put|patch|delete|options)\s+\/[^\s]*/i.test(cleanText) ||
            cleanText.includes('→ 200') ||
            cleanText.includes('→ 204') ||
            cleanText.includes('→ 404') ||
            cleanText.includes('→ 500')
          ) {
            level = 'http';
          } else if (lower.includes('debug') || lower.includes('verbose')) {
            level = 'debug';
          }

          entries.push({
            id: `log-${entries.length + 1}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: timestamp || new Date().toISOString(),
            stream,
            level,
            message: msg,
            raw: l,
          });
          textLines.push(l);
        }
      } else {
        break;
      }
    }

    return {
      entries,
      rawText: textLines.join('\n'),
    };
  } catch (err: any) {
    return {
      entries: [],
      rawText: `Failed to read container logs: ${err.message}`,
      error: err.message,
    };
  }
}

export async function getContainerLogs(containerName: string, tail = 80): Promise<string> {
  const res = await getParsedContainerLogs(containerName, tail);
  return res.rawText;
}
