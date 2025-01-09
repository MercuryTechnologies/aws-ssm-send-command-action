import {
  checkStatus,
  checkResult,
  checkState,
  getAllFailedCommandInvocations,
  waitUntilCommandExecuted
} from '../src/ssm'
import * as ssmExt from '../src/ssm'
import * as ssm from '@aws-sdk/client-ssm'
import { mockClient } from 'aws-sdk-client-mock'
import { WaiterState } from '@smithy/util-waiter'
import 'aws-sdk-client-mock-jest'

describe('getAllFailedInvocations', () => {
  it('returns failures', async () => {
    const ssmMock = mockClient(ssm.SSMClient)
    ssmMock.on(ssm.SendCommandCommand).resolves({ Command: { CommandId: '3' } })
    ssmMock.on(ssm.ListCommandInvocationsCommand).resolves({
      CommandInvocations: [
        {
          CommandId: '3',
          InstanceId: 'i-123'
        }
      ]
    })
    ssmMock.on(ssm.GetCommandInvocationCommand).resolves({
      CommandId: '3',
      InstanceId: 'i-123'
    })
    const client = new ssm.SSMClient({})
    const failedInvocations = await getAllFailedCommandInvocations(client, '3')
    expect(ssmMock).toHaveReceivedCommand(ssm.ListCommandInvocationsCommand)
    expect(ssmMock).toHaveReceivedCommand(ssm.GetCommandInvocationCommand)
    expect(failedInvocations).toEqual([
      {
        CommandId: '3',
        InstanceId: 'i-123'
      }
    ])
  })
})

describe('checkStatus', () => {
  it('returns RETRY for PENDING and IN_PROGRESS', () => {
    expect(checkStatus(ssm.CommandStatus.PENDING)).toBe(WaiterState.RETRY)
    expect(checkStatus(ssm.CommandStatus.IN_PROGRESS)).toBe(WaiterState.RETRY)
  })
  it('returns SUCCESS for SUCCESS', () => {
    expect(checkStatus(ssm.CommandStatus.SUCCESS)).toBe(WaiterState.SUCCESS)
  })
  it('returns FAILURE for CANCELLING, CANCELLED, FAILED, and TIMED_OUT', () => {
    expect(checkStatus(ssm.CommandStatus.CANCELLING)).toBe(WaiterState.FAILURE)
    expect(checkStatus(ssm.CommandStatus.CANCELLED)).toBe(WaiterState.FAILURE)
    expect(checkStatus(ssm.CommandStatus.FAILED)).toBe(WaiterState.FAILURE)
    expect(checkStatus(ssm.CommandStatus.TIMED_OUT)).toBe(WaiterState.FAILURE)
  })
})

describe('checkResult', () => {
  it('calls checkStatus with the status', () => {
    const status = ssm.CommandStatus.SUCCESS
    const checkStatusSpy = jest.spyOn(ssmExt, 'checkStatus')
    checkResult({ Commands: [{ Status: status }], $metadata: {} })
    expect(checkStatusSpy).toHaveBeenCalledWith(status)
  })
  it('returns RETRY if there are no commands field', () => {
    expect(checkResult({ $metadata: {} })).toBe(WaiterState.RETRY)
  })
  it('returns RETRY if there are no commands', () => {
    expect(checkResult({ Commands: [], $metadata: {} })).toBe(WaiterState.RETRY)
  })
  it('returns RETRY if there is no status', () => {
    expect(checkResult({ Commands: [{}], $metadata: {} })).toBe(
      WaiterState.RETRY
    )
  })
})

describe('checkState', () => {
  it('calls client.send with ListCommandsCommand', async () => {
    const ssmMock = mockClient(ssm.SSMClient)
    const response = {
      Commands: [{ Status: ssm.CommandStatus.SUCCESS }]
    }
    ssmMock.on(ssm.ListCommandsCommand).resolves(response)
    const client = new ssm.SSMClient({})
    const result = await checkState(client, {})
    expect(ssmMock).toHaveReceivedCommand(ssm.ListCommandsCommand)
    expect(result).toEqual({ state: WaiterState.SUCCESS, reason: response })
  })
})

describe('waitUntilCommandExecuted', () => {
  it('calls createWaiter with checkState', async () => {
    const ssmMock = mockClient(ssm.SSMClient)
    const checkStateSpy = jest.spyOn(ssmExt, 'checkState')
    const reason = {
      Commands: [{ Status: ssm.CommandStatus.SUCCESS }]
    }
    ssmMock.on(ssm.ListCommandsCommand).resolves(reason)
    const client = new ssm.SSMClient({})
    const waiter = await waitUntilCommandExecuted(
      { client, maxWaitTime: 6 },
      { CommandId: 'commandId' }
    )
    expect(checkStateSpy).toHaveBeenCalled()
    expect(waiter.reason).toEqual(reason)
  })
})
