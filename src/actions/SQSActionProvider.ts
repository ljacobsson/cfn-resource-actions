import { IActionProvider } from "./IActionProvider";
import { Globals } from "../util/Globals";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";

@IActionProvider.register
export class SQSActionProvider {

    async registerCommands(): Promise<void> {
        commands.registerCommand("cfn-resource-actions.sqsSend", async (queue: string) => {
            const payload = await window.showInputBox({ prompt: `Enter payload` });
            const sqs = new AWS.SQS();
            const response = await sqs.sendMessage({ QueueUrl: queue, MessageBody: payload as string }).promise();
            if (response.$response.httpResponse.statusCode === 200) {
                window.showInformationMessage("Message was successfully sent");
            } else {
                window.showInformationMessage(`Error publishing message: ${response.$response.error}`);
            }
        });

        commands.registerCommand("cfn-resource-actions.sqsPoll", async (queue: string) => {
            const sqs = new AWS.SQS();
            const queueName = queue.split("/").slice(-1)[0];
            window.showInformationMessage(`Polling ${queueName} for 1 minute`);
            Globals.OutputChannel.show();

            Globals.OutputChannel.appendLine(`\nPolling ${queueName} for 1 minute`);
            let runLoop = true;
            setTimeout(function () {
                runLoop = false;
            }, 60000);

            while (runLoop) {
                const messages = await sqs.receiveMessage({ QueueUrl: queue, WaitTimeSeconds: 20 }).promise();
                if (messages.Messages) {
                    for (const message of messages.Messages) {
                        Globals.OutputChannel.appendLine(message.Body as string);
                        await sqs.deleteMessage({ QueueUrl: queue, ReceiptHandle: message.ReceiptHandle as string }).promise();
                    }
                }
            }
            Globals.OutputChannel.appendLine(`Done polling`);

        });
    }

    public getPhysicalActions() {
        return {
            "AWS::SQS::Queue": (arg: any) => {
                return [{
                    title: `↗`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.openUrl",
                    arguments: [`https://${AWS.config.region}.console.aws.amazon.com/sqs/home?region=${AWS.config.region}#`]
                }, {
                    title: `Send`,
                    tooltip: "Send a message to the queue",
                    command: "cfn-resource-actions.sqsSend",
                    arguments: [arg]
                }, {
                    title: `Poll`,
                    tooltip: "Polls the queue for messages",
                    command: "cfn-resource-actions.sqsPoll",
                    arguments: [arg]
                }];
            }
        };
    }

    public getLogicalActions() {
        return null;
    }

}