import * as vscode from "vscode";
import { IActionProvider } from "./IActionProvider";
import { Globals } from "../util/Globals";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";
import { TemplateParser } from "../util/TemplateParser";
import { CloudFormationUtil } from "../util/CloudFormationUtil";
import { StackResourceSummaries } from "aws-sdk/clients/cloudformation";
const fs = require("fs");
const path = require("path");

const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(
  "cfn-resource-actions"
);

@IActionProvider.register
export class StepFunctionsActionProvider {
  async registerCommands(): Promise<void> {
    commands.registerCommand(
      "cfn-resource-actions.stepFunctionsExecute",
      async (sfnArn: string) => {
        const payload = await window.showInputBox({ prompt: `Enter input` });
        const stepFunctions = new AWS.StepFunctions();
        const response = await stepFunctions
          .startExecution({ stateMachineArn: sfnArn, input: payload })
          .promise();
        if (response.$response.httpResponse.statusCode === 200) {
          window.showInformationMessage("Execution was successfully started");
        } else {
          window.showInformationMessage(
            `Error executing state machine: ${response.$response.error}`
          );
        }
      }
    );
    commands.registerCommand(
      "cfn-resource-actions.stepFunctionsTailLogs",
      async (sfnArn: string) => {
        const stepFunctions = new AWS.StepFunctions();
        const sfn = await stepFunctions
          .describeStateMachine({ stateMachineArn: sfnArn })
          .promise();
        if (
          sfn.loggingConfiguration &&
          sfn.loggingConfiguration.destinations &&
          sfn.loggingConfiguration.destinations.length === 1
        ) {
          const logGroup = sfn.loggingConfiguration.destinations[0].cloudWatchLogsLogGroup?.logGroupArn
            ?.split("/")
            .slice(-1)[0]
            .replace(":*", "");
        }
      }
    );
    commands.registerCommand(
      "cfn-resource-actions.stepFunctionsSync",
      async (
        sfnArn: string,
        logicalId: string,
        templateDoc: vscode.TextDocument
      ) => {
        try {

          const stepFunctions = new AWS.StepFunctions();
          const template = TemplateParser.parse(templateDoc.getText());
          let sfnDefinition =
            template.Resources[logicalId].Properties.Definition;
          const sfnDefinitionUri =
            template.Resources[logicalId].Properties.DefinitionUri;
          const stack = await CloudFormationUtil.getStackResources(
            await config.get("stackName")
          );
          if (sfnDefinition) {
            await this.recurse(sfnDefinition, stack?.StackResourceSummaries);
          } else if (sfnDefinitionUri) {
            const substitutions =
              template.Resources[logicalId].Properties.DefinitionSubstitutions;
            let asl = fs
              .readFileSync(
                path.join(
                  templateDoc.uri.fsPath.substring(
                    0,
                    templateDoc.uri.fsPath.lastIndexOf(path.sep)
                  ),
                  sfnDefinitionUri
                )
              )
              .toString();
            const matches = asl.match(/\${.+?}/g);
            for (const match of matches) {
              const parameter = match.match(/\${(.+)}/)[1];
              const substitution = substitutions[parameter];
              switch (Object.keys(substitution)[0]) {
                case "Fn::GetAtt":
                  asl = asl.replaceAll(
                    match,
                    this.getAttValue(
                      stack?.StackResourceSummaries,
                      substitution["Fn::GetAtt"][0],
                      substitution["Fn::GetAtt"][1]
                    )
                  );
                  break;
                case "Ref":
                  asl = asl.replaceAll(
                    match,
                    this.refValue(
                      stack?.StackResourceSummaries,
                      substitution["Ref"]
                    )
                  );
                  break;
                case "Fn::Sub":
                  asl = asl.replaceAll(
                    match,
                    await this.subStringValue(substitution["Fn::Sub"])
                  );
                  break;
              }
            }
            sfnDefinition = JSON.parse(asl);
          }
          try {
            const sfn = await stepFunctions
              .updateStateMachine({
                stateMachineArn: sfnArn,
                definition: JSON.stringify(sfnDefinition, null, 2),
              })
              .promise();
            window.showInformationMessage(`State machine updated successfully`);
          } catch (err) {
            window.showErrorMessage(
              `Error updating state machine: ${err.message}`
            );
          }
        } catch (err) {
          window.showErrorMessage(err.message);
          console.log(err);
        }
      }
    );
  }
  private async recurse(
    obj: any,
    stackResources: StackResourceSummaries | undefined
  ) {
    for (const key in obj) {
      let value = obj[key];
      if (value != undefined) {
        if (value && typeof value === "object") {
          if (Object.keys(obj[key])[0] === "Fn::GetAtt") {
            const resourceName = obj[key]["Fn::GetAtt"][0];
            let arn = this.getAttValue(
              stackResources,
              resourceName,
              obj[key]["Fn::GetAtt"][1]
            );
            obj[key] = arn;
          }
          if (Object.keys(obj[key])[0] === "Fn::Sub") {
            let subString = obj[key]["Fn::Sub"];
            subString = await this.subStringValue(subString);
            obj[key] = subString;
          }
          if (Object.keys(obj[key])[0] === "Ref") {
            const resourceName = obj[key]["Ref"];
            const resource = this.refValue(stackResources, resourceName);
            obj[key] = resource?.PhysicalResourceId;
          }
          await this.recurse(value, stackResources);
        } else {
        }
      }
    }
  }

  private refValue(
    stackResources: AWS.CloudFormation.StackResourceSummaries | undefined,
    resourceName: any
  ) {
    return stackResources?.filter(
      (p) => p.LogicalResourceId === resourceName
    )[0];
  }

  private async subStringValue(subString: any) {
    subString = subString?.replace(
      /\${AWS::Region}/g,
      AWS.config.region as string
    );
    subString = subString?.replace(
      /\${AWS::AccountId}/g,
      Globals.AccountId as string
    );
    subString = subString?.replace(
      /\${AWS::StackName}/g,
      (await config.get("stackName")) as string
    );
    subString = subString?.replace(/\${AWS::Partition}/g, "aws");
    return subString;
  }

  private getAttValue(
    stackResources: AWS.CloudFormation.StackResourceSummaries | undefined,
    resourceName: any,
    getAtt: any
  ) {
    const resource = stackResources?.filter(
      (p) => p.LogicalResourceId === resourceName
    )[0];
    let arn = resource?.PhysicalResourceId;
    if (getAtt === "Arn") {
      switch (resource?.ResourceType) {
        case "AWS::Lambda::Function":
          arn = `arn:aws:lambda:${AWS.config.region}:${Globals.AccountId}:function:${resource.PhysicalResourceId}`;
          break;
        case "AWS::StepFunctions::StateMachine":
          arn = `arn:aws:states:${AWS.config.region}:${Globals.AccountId}:stateMachine:${resource.PhysicalResourceId}`;
          break;
        case "AWS::DynamoDB::Table":
          arn = `arn:aws:dynamodb:${AWS.config.region}:${Globals.AccountId}:table:${resource.PhysicalResourceId}`;
          break;
        case "AWS::ECS::Cluster":
          arn = `arn:aws:ecs:${AWS.config.region}:${Globals.AccountId}:cluster:${resource.PhysicalResourceId}`;
          break;
        case "AWS::SQS::Queue":
          arn = `arn:aws:sqs:${AWS.config.region}:${Globals.AccountId}:queue:${resource.PhysicalResourceId}`;
          break;
      }
    }
    return arn;
  }

  public getPhysicalActions() {
    return {
      "AWS::Serverless::StateMachine": (arg: any) => {
        return [
          {
            title: `↗`,
            tooltip: "Go to AWS console for resource",
            command: "cfn-resource-actions.openUrl",
            arguments: [
              `https://${AWS.config.region}.console.aws.amazon.com/states/home?region=${AWS.config.region}#/statemachines/view/${arg}`,
            ],
          },
          {
            title: `Execute`,
            tooltip: "Start execution",
            command: "cfn-resource-actions.stepFunctionsExecute",
            arguments: [arg],
          },
        ];
      },
      "AWS::StepFunctions::StateMachine": async (
        arn: string,
        logicalId: string,
        template: any
      ) => {
        const stepFunctions = new AWS.StepFunctions();
        const sfn = await stepFunctions
          .describeStateMachine({ stateMachineArn: arn })
          .promise();
        let logGroup;
        if (
          sfn.loggingConfiguration &&
          sfn.loggingConfiguration.destinations &&
          sfn.loggingConfiguration.destinations.length === 1
        ) {
          logGroup = sfn.loggingConfiguration.destinations[0].cloudWatchLogsLogGroup?.logGroupArn?.split(
            ":"
          )[6];
        }
        return [
          {
            title: `↗`,
            tooltip: "Go to AWS console for resource",
            command: "cfn-resource-actions.openUrl",
            arguments: [
              `https://${AWS.config.region}.console.aws.amazon.com/states/home?region=${AWS.config.region}#/statemachines/view/${arn}`,
            ],
          },
          {
            title: `Execute`,
            tooltip: "Start execution",
            command: "cfn-resource-actions.stepFunctionsExecute",
            arguments: [arn],
          },
          {
            title: `Tail logs`,
            tooltip: "Tail logs",
            command: "cfn-resource-actions.runShellCommand",
            arguments: [
              `aws logs tail ${logGroup} --follow --region ${AWS.config.region}`,
            ],
          },
          {
            title: `Sync`,
            tooltip: "Sync",
            command: "cfn-resource-actions.stepFunctionsSync",
            arguments: [arn, logicalId, template],
          },
        ];
      },
    };
  }

  public getLogicalActions() {
    return null;
  }
}
