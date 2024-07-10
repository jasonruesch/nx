import { NxTaskHistory } from '../index';
import { join } from 'path';

describe('NxTaskHistory', () => {
  let taskHistory: NxTaskHistory;

  beforeEach(() => {
    taskHistory = new NxTaskHistory(join(__dirname, 'temp-db'));
  });

  it('should record task history', () => {
    taskHistory.recordTaskRuns([
      {
        hash: '123',
        code: 0,
        status: 'success',
        project: 'proj',
        target: 'build',
        start: new Date(Date.now() - 1000 * 60 * 60).toUTCString(),
        end: new Date(Date.now()).toUTCString(),
      },
    ]);
  });

  it('should query flaky tasks', () => {
    taskHistory.recordTaskRuns([
      {
        hash: '123',
        code: 1,
        status: 'failure',
        project: 'proj',
        target: 'build',
        start: new Date(Date.now() - 1000 * 60 * 60).toUTCString(),
        end: new Date(Date.now()).toUTCString(),
      },
      {
        hash: '123',
        code: 0,
        status: 'success',
        project: 'proj',
        target: 'build',
        start: new Date(Date.now() - 1000 * 60 * 60).toUTCString(),
        end: new Date(Date.now()).toUTCString(),
      },
      {
        hash: '234',
        code: 0,
        status: 'success',
        project: 'proj',
        target: 'build',
        start: new Date(Date.now() - 1000 * 60 * 60).toUTCString(),
        end: new Date(Date.now()).toUTCString(),
      },
    ]);
    const r = taskHistory.getFlakyTasks(['123', '234']);
    console.log(r);
    expect(r).toContain('123');
    expect(r).not.toContain('234');

    const r2 = taskHistory.getFlakyTasks([]);
    expect(r2).not.toContain('123');
    expect(r2).not.toContain('234');
  });
});
