import { IActionProvider } from "./IActionProvider";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";
import { Globals } from "../util/Globals";
import { XRayUtil } from "../util/XRayUtil";
import { XRay } from "aws-sdk";

@IActionProvider.register
export class LambdaActionProvider {
    async registerCommands() {
        commands.registerCommand("cfn-resource-actions.lambdaInvoke", async (functionName: string) => {
            const payload = await window.showInputBox({ prompt: `Enter payload` });
            const lambda = new AWS.Lambda();
            const response = await lambda.invoke({ FunctionName: functionName, Payload: payload as string }).promise();
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

        const actions = {
            "AWS::Lambda::Function": (arg: any) => {

                const list = [{
                    title: `↗`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.openUrl",
                    arguments: [`https://${AWS.config.region}.console.aws.amazon.com/lambda/home?region=${AWS.config.region}#/functions/${arg}?tab=configuration`]
                }, {
                    title: `Invoke`,
                    tooltip: "Invoke function",
                    command: "cfn-resource-actions.lambdaInvoke",
                    arguments: [arg]
                }, {
                    title: `Tail logs`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.runShellCommand",
                    arguments: [`aws logs tail /aws/lambda/${arg} --follow --region ${AWS.config.region}`]
                }];
                const stats = XRayUtil.CurrentStats[arg];
                if (stats) {
                    if (stats.AverageDuration > 0) {
                        list.push({
                            title: `Avg. duration: ${stats.AverageDuration}s`,
                            tooltip: "Error rate",
                            command: "cfn-resource-actions.openUrl",
                            arguments: [`https://${AWS.config.region}.console.aws.amazon.com/xray/home?region=${AWS.config.region}#/traces?filter=service(id(name%3A%20%22${arg}%22%2C%20type%3A%20%22AWS%3A%3ALambda%3A%3AFunction%22))`]
                        });
                    }
                    if (stats.ErrorRate > 0) {
                        list.push({
                            title: `⚠ Error rate: ${stats.ErrorRate}%`,
                            tooltip: "Error rate",
                            command: "cfn-resource-actions.openUrl",
                            arguments: [`https://${AWS.config.region}.console.aws.amazon.com/xray/home?region=${AWS.config.region}#/traces?filter=service(id(name%3A%20%22${arg}%22%2C%20type%3A%20%22AWS%3A%3ALambda%3A%3AFunction%22))%20%7B%20(error%20%3D%20true%20%7C%7C%20fault%20%3D%20true)%20%7D`]
                        });
                    }
                    if (stats.ThrottleRate > 0) {
                        list.push({
                            title: `⚠ Throttle rate: ${stats.ThrottleRate}%`,
                            tooltip: "Throttle rate",
                            command: "cfn-resource-actions.openUrl",
                            arguments: [`https://${AWS.config.region}.console.aws.amazon.com/xray/home?region=${AWS.config.region}#/traces?filter=service(id(name%3A%20%22${arg}%22%2C%20type%3A%20%22AWS%3A%3ALambda%3A%3AFunction%22))%20%7B%20(throttle%20%3D%20true)%20%7D`]
                        });
                    }

                };
                return list;
            }
        };
        return actions;
    }

    public getLogicalActions() {
        return null;
    }

}