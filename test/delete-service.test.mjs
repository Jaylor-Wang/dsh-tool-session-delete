import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

// Import our SessionDeleteService via relative path
const mod = await import('../lib/index.js');
const { SessionDeleteService } = mod;

test('SessionDeleteService describe and full delete lifecycle', async (t) => {
  const sessionId = 'session-01234567-89ab-cdef-0123-456789abcdef';
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-test-session-'));
  const sessionDir = path.join(tempDir, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
  const logFile = path.join(sessionDir, 'session.v4.jsonl.zstd');
  await fs.writeFile(logFile, 'mock-log-bytes-content-12345');

  const calls = {
    parallel: [],
    flushed: [],
    archived: [],
    unarchived: [],
    unpinned: [],
    workspaceDetached: [],
    projCacheDeleted: [],
    agentDetached: [],
    sessionDetached: []
  };

  const mockLiveSession = {
    header: { id: sessionId, cwd: 'E:/Github/workspace' },
    id: sessionId
  };

  const mockAgent = {
    id: sessionId
  };

  const mockContext = {
    logger: {
      warn: () => {}
    },
    parallel: async (event, payload) => {
      calls.parallel.push({ event, payload });
    },
    waterfall: async (event, payload, fallback) => {
      return [{ kind: 'schedule', items: [{ id: 'rem-1', label: 'Reminder 1' }] }];
    },
    get: (serviceName) => {
      if (serviceName === 'workspaceRegistry') {
        return {
          archiveSession: async (id, opts) => { calls.archived.push({ id, opts }); },
          unarchiveSession: async (id) => { calls.unarchived.push(id); },
          unpinSession: async (id) => { calls.unpinned.push(id); },
          list: () => [
            { id: 'ws-main', sessionIds: [sessionId, 'other-session'], detachSession: async (id) => { calls.workspaceDetached.push({ ws: 'ws-main', id }); } }
          ]
        };
      }
      if (serviceName === 'storageDomain') {
        return {
          get: (domainName) => {
            if (domainName === 'session_projcache') {
              return {
                table: (tableName) => ({
                  delete: async (id) => {
                    calls.projCacheDeleted.push({ domain: domainName, table: tableName, id });
                    return true;
                  }
                })
              };
            }
            return undefined;
          }
        };
      }
      if (serviceName === 'agents') {
        return {
          store: new Map([[sessionId, mockAgent]]),
          detachEntered: (entry) => { calls.agentDetached.push(entry); }
        };
      }
      return undefined;
    },
    sessions: {
      get: (id) => (id === sessionId ? mockLiveSession : undefined),
      flush: async (session) => { calls.flushed.push(session.id); },
      store: new Map([[sessionId, mockLiveSession]]),
      detachEntered: (entry) => { calls.sessionDetached.push(entry); }
    },
    sessionPersistence: {
      stat: async (id) => ({
        header: { id: sessionId, cwd: 'E:/Github/workspace' },
        sizeBytes: 10240
      }),
      locate: (header) => ({ path: logFile })
    }
  };

  const service = new SessionDeleteService(mockContext);

  await t.test('describe reports correct facts, size, and activity', async () => {
    const desc = await service.describe({ sessionId });
    assert.equal(desc.sessionId, sessionId);
    assert.equal(desc.live, true);
    assert.equal(desc.cwd, 'E:/Github/workspace');
    assert.equal(desc.sizeBytes, 10240);
    assert.equal(desc.activity.length, 1);
    assert.equal(desc.activity[0].kind, 'schedule');
  });

  await t.test('deleteSession executes complete defensive sequence and cleans up disk', async () => {
    const res = await service.deleteSession({ sessionId });
    assert.equal(res.sessionId, sessionId);
    assert.equal(res.deleted, true);

    // 1. Quiesce
    assert.equal(calls.archived.length, 1);
    assert.deepEqual(calls.parallel, [{ event: 'workspace/session-stop', payload: { sessionId } }]);
    assert.deepEqual(calls.flushed, [sessionId]);

    // 2. Disk log unlinked
    const logStillExists = await fs.stat(logFile).then(() => true, () => false);
    assert.equal(logStillExists, false, 'session log file must be removed from disk');
    const dirStillExists = await fs.stat(sessionDir).then(() => true, () => false);
    assert.equal(dirStillExists, false, 'session directory must be removed from disk');

    // 3. Projection cache cleared
    assert.deepEqual(calls.projCacheDeleted, [{ domain: 'session_projcache', table: 'sessions', id: sessionId }]);

    // 4. Teardown and unpinning
    assert.deepEqual(calls.unarchived, [sessionId]);
    assert.deepEqual(calls.unpinned, [sessionId], 'unpinSession must be called');
    assert.deepEqual(calls.workspaceDetached, [{ ws: 'ws-main', id: sessionId }]);
    assert.equal(calls.agentDetached.length, 1);
    assert.equal(calls.sessionDetached.length, 1);
  });

  await t.test('unpinSession failures do not block the release lifecycle', async () => {
    const brokenContext = {
      ...mockContext,
      get: (serviceName) => {
        if (serviceName === 'workspaceRegistry') {
          return {
            unarchiveSession: async () => {},
            unpinSession: async () => { throw new Error('Simulated registry lock'); },
            list: () => []
          };
        }
        return mockContext.get(serviceName);
      }
    };
    const robustService = new SessionDeleteService(brokenContext);
    // Should not throw even if unpinSession throws
    await assert.doesNotReject(async () => {
      await robustService.release(sessionId);
    });
  });

  // Cleanup outer temp dir
  await fs.rm(tempDir, { recursive: true, force: true });
});
