import * as core from '@actions/core'
import * as ssm from '@aws-sdk/client-ssm'

import * as ssmExt from '../src/ssm'
export function getJSONInput(
  name: string,
  options?: core.InputOptions
): unknown {
  const val = core.getInput(name, options)
  if (val === '') {
    return undefined
  }
  try {
    return JSON.parse(val)
  } catch (e) {
    if (e instanceof Error)
      throw new TypeError(`Input ${name} is not a valid JSON: ${e.message}`)
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const DocumentName = core.getInput('document-name', { required: true })
    const Targets: ssm.Target[] = getJSONInput('targets', {
      required: true
    }) as ssm.Target[]
    const Parameters = getJSONInput('parameters', {
      required: false
    }) as Record<string, string[]>
    const waitUntilCommandExecuted = core.getBooleanInput(
      'wait-until-command-executed'
    )
    const logFailedCommandInvocations = core.getBooleanInput(
      'log-failed-command-invocations'
    )
    const maxWaitTime = parseInt(core.getInput('max-wait-time'))
    const client = new ssm.SSMClient({})

    const command = await client.send(
      new ssm.SendCommandCommand({
        DocumentName,
        Targets,
        Parameters
      })
    )
    const commandId = command.Command?.CommandId
    if (!commandId) {
      throw new Error('No command ID returned')
    }
    core.info(`Sent command ${commandId}`)
    core.setOutput('command-id', commandId)
    if (!waitUntilCommandExecuted) {
      return
    }
    core.info(`Waiting for command ${commandId} to complete`)
    try {
      await ssmExt.waitUntilCommandExecuted(
        { client, maxWaitTime },
        { CommandId: commandId }
      )
    } catch (error) {
      if (!logFailedCommandInvocations) throw error
      const failedCommandInvocations =
        await ssmExt.getAllFailedCommandInvocations(client, commandId)
      if (failedCommandInvocations)
        for (const invocation of failedCommandInvocations) {
          if (invocation.InstanceId) {
            core.startGroup(`Output of ${invocation.InstanceId}`)
            if (invocation.StandardOutputContent) {
              core.info(invocation.StandardOutputContent)
            }
            if (invocation.StandardErrorContent) {
              core.info(invocation.StandardErrorContent)
            }
            core.endGroup()
          }
        }
      throw error
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
