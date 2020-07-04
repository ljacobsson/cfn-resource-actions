# cfn-resource-actions

## Features

VS Code extension that lets you perform actions against deployed AWS resources directly from the CloudFormation/SAM template.

The current version supports the following actions:

* AWS::Serverless::Function / AWS::Lambda::Function:
  * Open Lambda console for a given function in the browser
  * Tail logs in terminal output
* AWS::DynamoDB::Table / AWS::Serverless::SimpleTable:
  * Open DynamoDB console for a given table in the browser
  * Query table from VS code and get the result in the output tab


![Demo](images/demo.gif)

## Requirements

A configured AWS CLI with the following permissions: 
```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "StatementId",
      "Effect": "Allow",
      "Action": [
        "cloudformation:ListStackResources"
        "dynamodb:DescribeTable",
        "dynamodb:Query",
        "logs:CreateExportTask",
      ]
    }
  ]
}
```

## Using AWS SSO auth
In the global settings.json file, add the following parameters:
```
"cfn-resource-actions.sso.region": "eu-west-1",
"cfn-resource-actions.sso.role": "RoleToAssume",
"cfn-resource-actions.sso.startUrl": "https://you-sso-subdomain.awsapps.com/start",
"cfn-resource-actions.sso.accountId": "123456789012",
"cfn-resource-actions.sso.useSSO": true
```

## Known Issues

Does not reload base don updates to your template. To map with the latest version of the stack, disable and re-enable the extension

