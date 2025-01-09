import * as ssm from '@aws-sdk/client-ssm'
import {
  createWaiter,
  WaiterState,
  WaiterResult,
  WaiterConfiguration,
  checkExceptions
} from '@smithy/util-waiter'

export async function getAllFailedCommandInvocations(
  client: ssm.SSMClient,
  commandId: string
): Promise<ssm.GetCommandInvocationResult[]> {
  const failedInvocations: ssm.GetCommandInvocationResult[] = []
  const invocations = await client.send(
    new ssm.ListCommandInvocationsCommand({
      CommandId: commandId,
      Filters: [{ key: 'Status', value: 'Failed' }]
    })
  )

  if (invocations.CommandInvocations) {
    for (const invocation of invocations.CommandInvocations) {
      const instanceId = invocation.InstanceId
      if (instanceId) {
        const response = await client.send(
          new ssm.GetCommandInvocationCommand({
            CommandId: commandId,
            InstanceId: instanceId
          })
        )
        failedInvocations.push(response)
      }
    }
  }
  return failedInvocations
}

export const checkStatus = (status: ssm.CommandStatus): WaiterState => {
  switch (status) {
    case ssm.CommandStatus.PENDING:
    case ssm.CommandStatus.IN_PROGRESS:
      return WaiterState.RETRY
    case ssm.CommandStatus.SUCCESS:
      return WaiterState.SUCCESS
    case ssm.CommandStatus.CANCELLING:
    case ssm.CommandStatus.CANCELLED:
    case ssm.CommandStatus.FAILED:
    case ssm.CommandStatus.TIMED_OUT:
      return WaiterState.FAILURE
  }
}

export const checkResult = (
  result: ssm.ListCommandsCommandOutput
): WaiterState => {
  for (const command of result.Commands || []) {
    if (!command.Status) {
      return WaiterState.RETRY
    }
    return checkStatus(command.Status)
  }
  return WaiterState.RETRY
}

export const checkState = async (
  client: ssm.SSMClient,
  input: ssm.ListCommandsCommandInput
): Promise<WaiterResult> => {
  const result = await client.send(new ssm.ListCommandsCommand(input))
  const reason = result
  const state = checkResult(result)
  return { state, reason }
}

/**
 * Variant of ssm.waitUntilCommmandExecuted that uses ListCommandsCommand
 * instead of GetCommandInvocation and waits for a whole command to
 * finish instead of a specific command invocation.
 *
 * This is needed because SendCommand does not immediately return the affected
 * InstanceIds when called so it's impossible to use the
 * ssm.waitUntilCommandExecuted waiter as it requires us to pass in the instance
 * id.
 *
 * Instead we use ListCommands which gives us the status of the whole command
 * including all its invocations.
 *
 * @param input  The input to ListCommandsCommand for polling.
 * @param params Waiter configuration options.
 */
export const waitUntilCommandExecuted = async (
  params: WaiterConfiguration<ssm.SSMClient>,
  input: ssm.ListCommandsCommandInput
): Promise<WaiterResult> => {
  const serviceDefaults = { minDelay: 5, maxDelay: 120 }
  const result = await createWaiter(
    { ...serviceDefaults, ...params },
    input,
    checkState
  )
  return checkExceptions(result)
}
