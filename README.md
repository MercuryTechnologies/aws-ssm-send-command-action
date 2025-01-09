# aws-ssm-send-command-action

[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

<!-- action-docs-description source="action.yml" -->

## Description

GitHub Action for sending commands to AWS Systems Manager. It is a wrapper
around the
[SendCommand](https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_SendCommand.html)
API call together with some additional features like waiting for the command to
finish and printing logs of failed command invocations.

<!-- action-docs-description source="action.yml" -->

## Usage

```yaml
- uses: MercuryTechnologies/aws-ssm-send-command-action@v0
  with:
    document-name: 'AWS-RunShellScript'
    targets: '[{"Key":"tag:Name","Values":["MyInstance"]}]'
    parameters: '{"commands":["echo Hello, World!"]}'
    wait-until-command-executed: true
    max-wait-time: 600
```

<!-- action-docs-inputs source="action.yml" -->

## Inputs

| name                             | description                                                                                                                                                                                                                                                                                                                                                               | required | default |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `document-name`                  | <p>The name of the AWS Systems Manager document (SSM document) to run. This can be a public document or a custom document. To run a shared document belonging to another account, specify the document Amazon Resource Name (ARN).</p>                                                                                                                                    | `true`   | `""`    |
| `targets`                        | <p>The targets to send the command to. Must be a JSON string of type <code>{Key: string, Values: string[]}[]</code>.</p> <ul> <li><code>Key=InstanceIds,Values=instance-id-1,instance-id-2,instance-id-3</code></li> <li><code>Key=tag:tag-key,Values=tag-value-1,tag-value-2</code></li> <li><code>Key=resource-groups:Name,Values=resource-group-name</code></li> </ul> | `true`   | `""`    |
| `parameters`                     | <p>The parameters to pass to the document, if any. Must be a JSON string of type <code>Record&lt;string, string[]&gt;</code></p>                                                                                                                                                                                                                                          | `false`  | `""`    |
| `wait-until-command-executed`    | <p>Whether to wait until the command has been executed</p>                                                                                                                                                                                                                                                                                                                | `false`  | `false` |
| `max-wait-time`                  | <p>The maximum time to wait for the command to finish</p>                                                                                                                                                                                                                                                                                                                 | `false`  | `600`   |
| `log-failed-command-invocations` | <p>Whether to print logs of failed command invocations. If the command target is targeting hundreds or thousands of instances, this can be expensive and slow.</p>                                                                                                                                                                                                        | `false`  | `false` |

<!-- action-docs-inputs source="action.yml" -->

<!-- action-docs-outputs source="action.yml" -->

## Outputs

| name         | description                                |
| ------------ | ------------------------------------------ |
| `command-id` | <p>The ID of the command that was sent</p> |

<!-- action-docs-outputs source="action.yml" -->

## Credentials

By default, this action relies on the
[default behavior of the AWS SDK for JavasSript](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html)
to determine AWS credentials and region. You can use
[the `aws-actions/configure-aws-credentials` action](https://github.com/aws-actions/configure-aws-credentials)
to configure the GitHub Actions environment with environment variables
containing AWS credentials and your desired region.

```yaml
- uses: 'aws-actions/configure-aws-credentials@v4'
  with:
    role-to-assume: 'arn:aws:iam::123456789012:role/MyRole'
    aws-region: 'us-west-2'
```

## Permissions

Sending a command requires the `ssm:SendCommand` permission. It's recommended to
write a policy that allows sending commands to specific resources, rather than
allowing all resources.

For example, the following policy only allow sending the `AWS-RunShellScript`
document to instances in the production environment

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AWSRunShellScript",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": "arn:aws:ssm:*:*:document/AWS-RunShellScript"
    },
    {
      "Sid": "ProductionInstances",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "StringEquals": {
          "ssm:ResourceTag/Environment": "production",
          "ssm:ResourceTag/Role": "webserver"
        }
      }
    }
  ]
}
```

When using `wait-until-command-executed` the following extra permissions are
required:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WaitUntilCommandExecuted",
      "Effect": "Allow",
      "Action": "ssm:ListCommands",
      "Resource": "*"
    }
  ]
}
```

When using `log-failed-command-invocations` the following extra permissions are
required:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "LogFailedCommandInvocations",
      "Effect": "Allow",
      "Action": ["ssm:ListCommandInvocations", "ssm:GetCommandInvocation"],
      "Resource": "*"
    }
  ]
}
```

<!-- action-docs-runs source="action.yml" -->

## Runs

This action is a `node20` action.

<!-- action-docs-runs source="action.yml" -->
