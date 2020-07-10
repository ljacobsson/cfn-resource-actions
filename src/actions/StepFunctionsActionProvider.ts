import { IActionProvider } from "./IActionProvider";
import { Globals } from "../util/Globals";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";

@IActionProvider.register
export class StepFunctionsActionProvider {

    async registerCommands(): Promise<void> {
        commands.registerCommand("cfn-resource-actions.stepFunctionsExecute", async (topicArn: string) => {
            const payload = await window.showInputBox({ prompt: `Enter input` });            
            const stepFunctions = new AWS.StepFunctions();
            const response = await stepFunctions.startExecution({ stateMachineArn: topicArn, input: payload}).promise();
            if (response.$response.httpResponse.statusCode === 200) {
                window.showInformationMessage("Execution was successfully started");
            } else {
                window.showInformationMessage(`Error executing state machine: ${response.$response.error}`);                           
            }
        });
    }

    public getPhysicalActions() {
        return {
            "AWS::StepFunctions::StateMachine": (arg: any) => {
                return [{
                    title: `💻`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.openUrl",
                    arguments: [`https://${AWS.config.region}.console.aws.amazon.com/states/home?region=${AWS.config.region}#/statemachines/view/${arg}`]
                },{
                    title: `Execute`,
                    tooltip: "Start execution",
                    command: "cfn-resource-actions.stepFunctionsExecute",
                    arguments: [arg]
                }];
            }
        };
    }

    public getLogicalActions() {
        return null;
    }

}