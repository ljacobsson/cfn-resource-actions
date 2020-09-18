import { IActionProvider } from "./IActionProvider";
import { Globals } from "../util/Globals";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";

@IActionProvider.register
export class S3ActionProvider {

    async registerCommands(): Promise<void> {
    }

    public getPhysicalActions() {
        return {
            "AWS::S3::Bucket": (arg: any) => {
                return [{
                    title: `↗`,
                    tooltip: "Go to AWS console for resource",
                    command: "cfn-resource-actions.openUrl",
                    arguments: [`https://console.aws.amazon.com/s3/buckets/${arg}/?tab=overview`]
                }];
            }
        };
    }

    public getLogicalActions() {
        return null;
    }

}