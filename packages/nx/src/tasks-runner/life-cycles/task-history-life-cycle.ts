import { serializeTarget } from '../../utils/serialize-target';
import { Task } from '../../config/task-graph';
import { output } from '../../utils/output';
import {
  // getHistoryForHashes,
  TaskHistory,
  // writeTaskRunsToHistory as writeTaskRunsToHistory,
} from '../../utils/task-history';
import { LifeCycle, TaskResult } from '../life-cycle';
import type { TaskRun } from '../../native';

export class TaskHistoryLifeCycle implements LifeCycle {
  private startTimings: Record<string, number> = {};
  private taskRuns = new Map<string, TaskRun>();
  private taskHistory = new TaskHistory();

  startTasks(tasks: Task[]): void {
    for (let task of tasks) {
      this.startTimings[task.id] = new Date().getTime();
    }
  }

  async endTasks(taskResults: TaskResult[]) {
    taskResults
      .map((taskResult) => ({
        hash: taskResult.task.hash,
        project: taskResult.task.target.project,
        target: taskResult.task.target.target,
        configuration: taskResult.task.target.configuration,
        code: taskResult.code,
        status: taskResult.status,
        start: new Date(
          taskResult.task.startTime ?? this.startTimings[taskResult.task.id]
        ).toUTCString(),
        end: new Date(taskResult.task.endTime ?? undefined).toUTCString(),
      }))
      .forEach((taskRun) => {
        this.taskRuns.set(taskRun.hash, taskRun);
      });
  }

  async endCommand() {
    const entries = Array.from(this.taskRuns);
    await this.taskHistory.recordTaskRuns(entries.map(([_, v]) => v));
    const flakyTasks = await this.taskHistory.getFlakyTasks(
      entries.map(([hash]) => hash)
    );
    // const history = await getHistoryForHashes(this.taskRuns.map((t) => t.hash));
    // const flakyTasks: string[] = [];
    //
    // // check if any hash has different exit codes => flaky
    // for (let hash in history) {
    //   if (
    //     history[hash].length > 1 &&
    //     history[hash].some((run) => run.code !== history[hash][0].code)
    //   ) {
    //     flakyTasks.push(
    //       serializeTarget(
    //         history[hash][0].project,
    //         history[hash][0].target,
    //         history[hash][0].configuration
    //       )
    //     );
    //   }
    // }
    if (flakyTasks.length > 0) {
      output.warn({
        title: `Nx detected ${
          flakyTasks.length === 1 ? 'a flaky task' : ' flaky tasks'
        }`,
        bodyLines: [
          ,
          ...flakyTasks.map((hash) => {
            const taskRun = this.taskRuns.get(hash);
            return `  ${serializeTarget(
              taskRun.project,
              taskRun.target,
              taskRun.configuration
            )}`;
          }),
          '',
          `Flaky tasks can disrupt your CI pipeline. Automatically retry them with Nx Cloud. Learn more at https://nx.dev/ci/features/flaky-tasks`,
        ],
      });
    }
  }
}
