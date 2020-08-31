import { IActionProvider } from "./IActionProvider";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";
import { Globals } from "../util/Globals";
import { time } from "console";
const localSubscriber = require("@mhlabs/evb-cli/src/evb-local/listeners/localPatternListener");
let socketOpen = false;
const timeouts: NodeJS.Timeout[] = [];
@IActionProvider.register
export class EventsActionProvider {
    async registerCommands() {
        commands.registerCommand("cfn-resource-actions.eventsSchema", async (fragment: any) => {
            const schemas = new AWS.Schemas();
            let registryName = "aws.events";
            if (fragment?.Properties?.EventBusName || "default" !== "default") {
                registryName = "discovered-schemas";
            }
            const eventPattern = fragment?.Properties?.EventPattern;
            const schemaName = (`${eventPattern?.source}@${eventPattern["detail-type"]}` as string).replace(new RegExp("\\s", "g"), "");
            const response = await schemas.describeSchema({ RegistryName: registryName, SchemaName: schemaName }).promise();
            if (response.$response.httpResponse.statusCode === 200) {
                Globals.OutputChannel.appendLine(`Schema for ${schemaName} in registry ${registryName}`);
                Globals.OutputChannel.appendLine(JSON.stringify(JSON.parse(response?.Content as string), null, 2));
                Globals.OutputChannel.show();
            } else {
                window.showInformationMessage(`Error fetching schema ${schemaName} from ${registryName}: ${response.$response.error}`);
            }
        });

        commands.registerCommand("cfn-resource-actions.eventsUnsubscribe", async (fragment: any) => {
            if (socketOpen) {
                localSubscriber.disconnect();
                Globals.OutputChannel.appendLine("Closed connection");
                socketOpen = false;
                return;
            }
            Globals.OutputChannel.appendLine("No open connection");
        });

        commands.registerCommand("cfn-resource-actions.eventsSubscribe", async (fragment: any) => {
            if (socketOpen) {
                Globals.OutputChannel.appendLine("Restarting subscription");
                localSubscriber.disconnect();
            }
            Globals.OutputChannel.show();
            fragment.Properties.EventPattern = JSON.stringify(fragment.Properties.EventPattern);
            for(const timeout of timeouts) {
                timeout.unref();
            }
            timeouts.push(setTimeout(function () {
                if (socketOpen) {
                    Globals.OutputChannel.appendLine("Closed connection after 5 minutes");
                    localSubscriber.disconnect();
                    socketOpen = false;
                }
            }, 300000));
            const logger = { log: (msg: string) => Globals.OutputChannel.appendLine(msg), error: Globals.OutputChannel.appendLine };
            socketOpen = true;
            Globals.OutputChannel.appendLine("Subscribing to rule for 5 minutes");
            await localSubscriber.initConnection(
                fragment.Properties,
                "CfnResourceActionsRule",
                null, null, new AWS.CloudFormation(), logger
            );
        });
    }

    public getPhysicalActions() {
        return {
            "AWS::Events::Rule": (arg: string) => {
                const arnSplit = arg.split("/");
                let eventBusName = "default";
                const ruleName = arnSplit.slice(-1)[0];
                if (arnSplit.length === 3) {
                    eventBusName = arnSplit[1];
                }
                return [{
                    title: `↗`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.openUrl",
                    arguments: [`https://${AWS.config.region}.console.aws.amazon.com/events/home?region=${AWS.config.region}#/eventbus/${eventBusName}/rules/${ruleName}`]
                }];
            }
        };
    }

    public getLogicalActions() {
        return {
            "AWS::Events::Rule": (fragment: any) => {
                const list: any = [];
                if (fragment.Properties.EventPattern?.source && fragment.Properties.EventPattern["detail-type"]) {
                    list.push(
                        {
                            title: `Schema`,
                            tooltip: "Invoke function",
                            command: "cfn-resource-actions.eventsSchema",
                            arguments: [fragment]
                        });
                }
                if (fragment.Properties.EventPattern) {
                    list.push({
                        title: `■`,
                        tooltip: "Disconnect from event",
                        command: "cfn-resource-actions.eventsUnsubscribe",
                        arguments: [fragment]
                    });
                    list.push({
                        title: `▶`,
                        tooltip: "Subscribe to events",
                        command: "cfn-resource-actions.eventsSubscribe",
                        arguments: [fragment]
                    });
                }
                return list;
            }
        };
    }

}