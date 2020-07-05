import { IActionProvider } from "./IActionProvider";
import { Globals } from "../util/Globals";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";

@IActionProvider.register
export class SNSActionProvider {

    async registerCommands(): Promise<void> {
        commands.registerCommand("cfn-resource-actions.snsPublish", async (topicArn: string) => {
            const payload = await window.showInputBox({ prompt: `Enter payload` });            
            const sns = new AWS.SNS();
            const response = await sns.publish({ TopicArn: topicArn, Message: payload as string}).promise();
            if (response.$response.httpResponse.statusCode === 200) {
                window.showInformationMessage("Message was successfully sent");
            } else {
                window.showInformationMessage(`Error publishing message: ${response.$response.error}`);                           
            }
        });
    }

    public getActions() {
        return {
            "AWS::SNS::Topic": (arg: any) => {
                return [{
                    title: `💻`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.openUrl",
                    arguments: [`https://${AWS.config.region}.console.aws.amazon.com/sns/v3/home?region=${AWS.config.region}#/topic/${arg}`]
                },{
                    title: `Publish message`,
                    tooltip: "Publish message on topic",
                    command: "cfn-resource-actions.snsPublish",
                    arguments: [arg]
                }];
            }
        };
    }
}