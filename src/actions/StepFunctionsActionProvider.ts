import { IActionProvider } from "./IActionProvider";
import { Globals } from "../util/Globals";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";

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
      "AWS::StepFunctions::StateMachine": async (arg: any) => {
        const stepFunctions = new AWS.StepFunctions();
        const sfn = await stepFunctions
          .describeStateMachine({ stateMachineArn: arg })
          .promise();
        let logGroup;
        if (
          sfn.loggingConfiguration &&
          sfn.loggingConfiguration.destinations &&
          sfn.loggingConfiguration.destinations.length === 1
        ) {
          logGroup = sfn.loggingConfiguration.destinations[0].cloudWatchLogsLogGroup?.logGroupArn
            ?.split(":")[6];
        }
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
          {
            title: `Tail logs`,
            tooltip: "Tail logs",
            command: "cfn-resource-actions.runShellCommand",
            arguments: [
              `aws logs tail ${logGroup} --follow --region ${AWS.config.region}`,
            ],
          },
        ];
      },
    };
  }

  public getLogicalActions() {
    return null;
  }
}
