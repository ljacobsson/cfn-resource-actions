import { IActionProvider } from "./IActionProvider";
import AWS = require("aws-sdk");

export class LambdaActionProvider implements IActionProvider {
    async registerCommands() {
    }

    public getActions() {
        return {
            "AWS::Lambda::Function": (arg: any) => {
                return [{
                    title: `💻`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.openUrl",
                    arguments: [`https://${AWS.config.region}.console.aws.amazon.com/lambda/home?region=eu-west-1#/functions/${arg}?tab=configuration`]
                }, {
                    title: `Tail logs`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.runShellCommand",
                    arguments: [`aws logs tail /aws/lambda/${arg} --follow`]
                }];
            }
        };
    }
}