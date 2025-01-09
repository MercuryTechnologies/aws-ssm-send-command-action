/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as ssm from '@aws-sdk/client-ssm'
import * as main from '../src/main'
import * as ssmExt from '../src/ssm'
import { WaiterState } from '@smithy/util-waiter'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('getJSONInput', () => {
  const getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
  beforeEach(() => {
    jest.clearAllMocks()
  })
  it('returns an object from a JSON string', () => {
    getInputMock.mockReturnValue('{"key":"value"}')
    expect(main.getJSONInput('key')).toEqual({ key: 'value' })
    expect(getInputMock).toHaveBeenCalled()
  })
  it('returns undefined if the input is empty', () => {
    getInputMock.mockReturnValue('')
    expect(main.getJSONInput('key')).toBeUndefined()
    expect(getInputMock).toHaveBeenCalled()
  })
  it('throws error if syntax error', () => {
    getInputMock.mockReturnValue('{"key":"value"')
    expect(() => main.getJSONInput('key')).toThrow()
    expect(getInputMock).toHaveBeenCalled()
  })
})

describe('run', () => {
  const runMock = jest.spyOn(main, 'run')
  const getInputMock = jest.spyOn(core, 'getInput')
  const getBooleanInputMock = jest.spyOn(core, 'getBooleanInput')
  const setOutputMock = jest.spyOn(core, 'setOutput')
  const setFailedMock = jest.spyOn(core, 'setFailed')
  const infoMock = jest.spyOn(core, 'info')
  const startGroupMock = jest.spyOn(core, 'startGroup')
  const endGroupMock = jest.spyOn(core, 'endGroup')
  const waitUntilCommandExecutedMock = jest.spyOn(
    ssmExt,
    'waitUntilCommandExecuted'
  )
  const getAllFailedCommandInvocationsMock = jest.spyOn(
    ssmExt,
    'getAllFailedCommandInvocations'
  )
  const ssmMock = mockClient(ssm.SSMClient)

  beforeEach(() => {
    jest.clearAllMocks()
    ssmMock.reset()
    getInputMock.mockImplementation()
    getBooleanInputMock.mockImplementation()
    getBooleanInputMock.mockImplementation(name => {
      switch (name) {
        case 'wait-until-command-executed':
          return false
        case 'log-failed-command-invocations':
          return false
        default:
          return false
      }
    })
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'document-name':
          return 'name'
        case 'targets':
          return '[{"key":"value"}]'
        case 'max-wait-time':
          return '600'
        default:
          return ''
      }
    })
    setOutputMock.mockImplementation()
    setFailedMock.mockImplementation()
    waitUntilCommandExecutedMock.mockImplementation()
    getAllFailedCommandInvocationsMock.mockImplementation()
  })

  it('sends a command', async () => {
    ssmMock.on(ssm.SendCommandCommand).resolves({ Command: { CommandId: '3' } })
    await main.run()
    expect(getInputMock).toHaveBeenCalled()
    expect(getBooleanInputMock).toHaveBeenCalled()
    expect(ssmMock).toHaveReceivedCommand(ssm.SendCommandCommand)
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith('command-id', '3')
  })

  it('fails if send command sends weird output', async () => {
    ssmMock.on(ssm.SendCommandCommand).resolves({ Command: {} })
    await main.run()
    expect(getInputMock).toHaveBeenCalled()
    expect(getBooleanInputMock).toHaveBeenCalled()
    expect(ssmMock).toHaveReceivedCommand(ssm.SendCommandCommand)
    expect(setFailedMock).toHaveBeenCalled()
  })

  describe('failed invocations', () => {
    beforeEach(() => {
      ssmMock
        .on(ssm.SendCommandCommand)
        .resolves({ Command: { CommandId: '3' } })
      waitUntilCommandExecutedMock.mockRejectedValue(new Error('FAILURE'))
      getAllFailedCommandInvocationsMock.mockResolvedValue([
        {
          InstanceId: 'i-123',
          CommandId: '3',
          Status: 'Failed',
          StatusDetails: 'Failed',
          StandardErrorContent: 'no such file or directory',
          StandardOutputContent: 'output'
        },
        {
          InstanceId: 'i-456',
          CommandId: '3',
          Status: 'Failed',
          StatusDetails: 'Failed',
          StandardErrorContent: 'no connection',
          StandardOutputContent: 'output'
        }
      ])
    })
    it('Prints logs of all failed invocations', async () => {
      getBooleanInputMock.mockImplementation(name => {
        switch (name) {
          case 'wait-until-command-executed':
            return true
          case 'log-failed-command-invocations':
            return true
          default:
            return false
        }
      })
      await main.run()
      expect(runMock).toHaveBeenCalled()
      expect(getInputMock).toHaveBeenCalled()
      expect(getBooleanInputMock).toHaveBeenCalled()
      expect(ssmMock).toHaveReceivedCommand(ssm.SendCommandCommand)
      expect(waitUntilCommandExecutedMock).toHaveBeenCalled()
      expect(getAllFailedCommandInvocationsMock).toHaveBeenCalled()
      expect(setFailedMock).toHaveBeenCalledWith('FAILURE')
      expect(setOutputMock).toHaveBeenCalledWith('command-id', '3')

      expect(startGroupMock).toHaveBeenCalledWith('Output of i-123')
      expect(infoMock).toHaveBeenCalledWith('no such file or directory')

      expect(startGroupMock).toHaveBeenCalledWith('Output of i-456')
      expect(infoMock).toHaveBeenCalledWith('no connection')
      expect(endGroupMock).toHaveBeenCalledTimes(2)
    })

    it('Does not print logs of failed invocations if logFailedInvocations is false', async () => {
      getBooleanInputMock.mockImplementation(name => {
        switch (name) {
          case 'wait-until-command-executed':
            return true
          case 'log-failed-invocations':
            return false
          default:
            return false
        }
      })
      await main.run()
      expect(runMock).toHaveBeenCalled()
      expect(getInputMock).toHaveBeenCalled()
      expect(getBooleanInputMock).toHaveBeenCalled()
      expect(ssmMock).toHaveReceivedCommand(ssm.SendCommandCommand)
      expect(waitUntilCommandExecutedMock).toHaveBeenCalled()
      expect(getAllFailedCommandInvocationsMock).not.toHaveBeenCalled()
      expect(setFailedMock).toHaveBeenCalledWith('FAILURE')
      expect(setOutputMock).toHaveBeenCalledWith('command-id', '3')

      expect(startGroupMock).not.toHaveBeenCalled()
      expect(infoMock).not.toHaveBeenCalledWith('no such file or directory')
      expect(infoMock).not.toHaveBeenCalledWith('no connection')
      expect(endGroupMock).not.toHaveBeenCalled()
    })
  })

  it('Does not print logs of failed invocations if waiting was succesful', async () => {
    const getBooleanInputMock = jest
      .spyOn(core, 'getBooleanInput')
      .mockReturnValue(true)
    const getInputMock = jest
      .spyOn(core, 'getInput')
      .mockImplementation(name => {
        switch (name) {
          case 'document-name':
            return 'name'
          case 'targets':
            return '[{"key":"value"}]'
          case 'max-wait-time':
            return '600'
          default:
            return ''
        }
      })
    const ssmMock = mockClient(ssm.SSMClient)
    ssmMock.on(ssm.SendCommandCommand).resolves({ Command: { CommandId: '3' } })
    waitUntilCommandExecutedMock.mockResolvedValue({
      state: WaiterState.SUCCESS,
      reason: { Commands: [{ Status: ssm.CommandStatus.SUCCESS }] }
    })

    await main.run()

    expect(runMock).toHaveBeenCalled()
    expect(getInputMock).toHaveBeenCalled()
    expect(getBooleanInputMock).toHaveBeenCalled()
    expect(ssmMock).toHaveReceivedCommand(ssm.SendCommandCommand)
    expect(waitUntilCommandExecutedMock).toHaveBeenCalled()
    expect(getAllFailedCommandInvocationsMock).not.toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('calls setFailed on error', async () => {
    getInputMock.mockImplementation(() => {
      throw new Error('error')
    })
    await main.run()
    expect(runMock).toHaveBeenCalled()
    expect(getInputMock).toHaveBeenCalled()
    expect(setFailedMock).toHaveBeenCalledWith('error')
  })
})
