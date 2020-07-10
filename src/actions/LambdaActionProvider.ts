import { IActionProvider } from "./IActionProvider";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";
import { Globals } from "../util/Globals";

@IActionProvider.register
export class LambdaActionProvider {
    async registerCommands() {
        commands.registerCommand("cfn-resource-actions.lambdaInvoke", async (functionName: string) => {
            const payload = await window.showInputBox({ prompt: `Enter payload` });            
            const lambda = new AWS.Lambda();
            const response = await lambda.invoke({ FunctionName: functionName, Payload: payload as string}).promise();
            if (response.$response.httpResponse.statusCode === 200) {
                window.showInformationMessage("Function was successfully invoked");
                Globals.OutputChannel.appendLine(JSON.stringify(response?.$response?.data as string, null, 2));
                Globals.OutputChannel.show();
            } else {                
                window.showInformationMessage(`Error invoking function: ${response.$response.error}`);                           
            }
        });
    }

    public getPhysicalActions() {
        return {
            "AWS::Lambda::Function": (arg: any) => {
                return [{
                    title: `💻`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.openUrl",
                    arguments: [`https://${AWS.config.region}.console.aws.amazon.com/lambda/home?region=eu-west-1#/functions/${arg}?tab=configuration`]
                }, {
                    title: `Invoke`,
                    tooltip: "Invoke function",
                    command: "cfn-resource-actions.lambdaInvoke",
                    arguments: [arg]
                }, {
                    title: `Tail logs`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.runShellCommand",
                    arguments: [`aws logs tail /aws/lambda/${arg} --follow`]
                }];
            }
        };
    }

    public getLogicalActions() {
        return null;
    }

}