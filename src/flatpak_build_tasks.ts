import * as vscode from 'vscode'
import { findManifests, exists } from './utils'
import * as store from "./store"


interface FlatpakBuildTaskDefinition extends vscode.TaskDefinition {
  taskName: string,
  command: string,
  group?: vscode.TaskGroup,
}

export class FlatpakBuildTasksProvider implements vscode.TaskProvider {
  static taskProviderType = 'flatpak'
  static taskSource = 'flatpak'

  public async provideTasks(): Promise<vscode.Task[]> {
    const isSandboxed = await exists('/.flatpak-info')
    const manifests = await findManifests(isSandboxed)

    const taskDefinitions: FlatpakBuildTaskDefinition[] = []
    if (manifests.length > 0) {
      manifests.forEach((manifest) => store.manifestFound(manifest))
      const manifest = manifests[0]

      const bareTaskDefinitions = [
        { taskName: "build", command: manifest.build(false).toString() },
        { taskName: "rebuild", command: manifest.build(true).toString().replace(",", " && ") },
        { taskName: "run", command: manifest.run().toString() },
        { taskName: "update dependencies", command: manifest.updateDependencies().toString() }
      ]

      for (const individualBareTaskDef of bareTaskDefinitions) {
        taskDefinitions.push(
          {
            type: FlatpakBuildTasksProvider.taskProviderType,
            taskName: individualBareTaskDef.taskName,
            command: individualBareTaskDef.command,
            group: vscode.TaskGroup.Build
          }
        )
      }
    } else {
      return [] as vscode.Task[]
    }

    const taskList: vscode.Task[] = [];
    for (const individualTaskDef of taskDefinitions) {
      const vscodeTask = this.buildTask(individualTaskDef)

      vscodeTask.group = individualTaskDef.group

      taskList.push(vscodeTask)
    }
    return taskList
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    const definition = task.definition as FlatpakBuildTaskDefinition

    if (definition.type === FlatpakBuildTasksProvider.taskProviderType && definition.command) {
      //const args = [definition.command].concat(definition.args ?? []);

      if (isWorkspaceFolder(task.scope)) {
        return this.buildTask(definition)
      }
    }

    return undefined;
  }

  buildTask(definition: FlatpakBuildTaskDefinition): vscode.Task {
    return new vscode.Task(
      definition,
      vscode.TaskScope.Workspace,
      `${definition.taskName}`,
      FlatpakBuildTasksProvider.taskProviderType,
      new vscode.ShellExecution(definition.command)
    )
  }
}

function isWorkspaceFolder(scope: vscode.WorkspaceFolder | vscode.TaskScope | undefined): scope is vscode.WorkspaceFolder {
  return (scope as vscode.WorkspaceFolder).name !== undefined;
}